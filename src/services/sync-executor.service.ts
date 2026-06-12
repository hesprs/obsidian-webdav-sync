import type WebDAVSyncPlugin from '~';
import type { SyncRunSnapshot, SyncTrigger } from '~/events';
import type { BaseTask } from '~/sync';
import type { SyncRunKind } from '~/types';
import { createQueuedSyncRunSnapshot, syncRun, updateSyncRunSnapshot } from '~/events';
import finalizeSyncRun from '~/events/sync-terminate';
import { createVaultFs, createWebdavFs } from '~/fs';
import { SyncEngine, isSyncCancelledError } from '~/sync';
import logger from '~/utils/logger';

export type SyncOptions = {
	runKind: SyncRunKind;
};

export type SyncExecutionRequest = {
	runId: string;
	trigger: SyncTrigger;
	sources: Array<SyncTrigger>;
	queuedAt: number;
} & SyncOptions;

export type SyncExecutionResult = {
	executed: boolean;
	run?: SyncRunSnapshot;
};

export default class SyncExecutorService {
	constructor(private readonly plugin: WebDAVSyncPlugin) {}

	async executeSync(request: SyncExecutionRequest): Promise<SyncExecutionResult> {
		if (this.plugin.isSyncing) return { executed: false };
		if (!this.plugin.isAccountConfigured()) return { executed: false };
		logger.pushRunId(request.runId);

		try {
			const sync = new SyncEngine(this.plugin, {
				token: this.plugin.getToken(),
				vaultFs: createVaultFs(this.plugin),
				webdavFs: createWebdavFs(this.plugin),
			});

			let run = createQueuedSyncRunSnapshot({
				queuedAt: request.queuedAt,
				runId: request.runId,
				runKind: request.runKind,
				sources: request.sources,
				trigger: request.trigger,
			});
			run = updateSyncRunSnapshot(run, {
				serverUrl: this.plugin.settings.serverUrl,
				stage: 'pre_connecting',
				timestamps: { planningStartedAt: Date.now() },
			});
			syncRun(run);
			logger.info('Planning started');

			let tasks: Array<BaseTask> | undefined;
			try {
				tasks = await sync.preparePlan(request.runKind, (patch) => {
					run = updateSyncRunSnapshot(run, patch);
					syncRun(run);
				});
			} catch (error) {
				run = finalizeSyncRun(run, {
					error,
					stage: isSyncCancelledError(error) ? 'cancelled' : 'failed',
				});
				return { executed: true, run };
			}

			run = updateSyncRunSnapshot(run, {
				planSummary: sync.summarizePlan(tasks),
			});
			syncRun(run);
			logger.info(`Planning finished with ${tasks.length} tasks`);

			run = await sync.start({
				request,
				run,
				tasks,
			});

			return { executed: true, run };
		} finally {
			logger.popRunId();
		}
	}
}
