import type WebDAVSyncPlugin from '~';
import type { SyncRunMode, SyncRunSnapshot, SyncTrigger } from '~/events';
import type { BaseTask } from '~/sync/tasks/task.interface';
import type { SyncRunKind } from '~/types';
import { createQueuedSyncRunSnapshot, syncRun, updateSyncRunSnapshot } from '~/events';
import finalizeSyncRun from '~/events/sync-terminate';
import { SyncEngine, SyncStartMode } from '~/sync';
import { isSyncCancelledError } from '~/sync/errors';
import logger from '~/utils/logger';
import waitUntil from '~/utils/wait-until';

export type SyncOptions = {
	mode: SyncStartMode;
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

		await waitUntil(() => !this.plugin.isSyncing, 500);

		logger.pushContext({
			category: 'sync',
			runId: request.runId,
		});

		try {
			const sync = new SyncEngine(this.plugin, {
				token: this.plugin.getToken(),
				vault: this.plugin.app.vault,
				webdav: this.plugin.webDAVService.createWebDAVClient(),
			});

			let run = createQueuedSyncRunSnapshot({
				mode: this.toRunMode(request.mode),
				queuedAt: request.queuedAt,
				runId: request.runId,
				runKind: request.runKind,
				sources: request.sources,
				trigger: request.trigger,
			});
			run = updateSyncRunSnapshot(run, {
				stage: 'pre_connecting',
				timestamps: { planningStartedAt: Date.now() },
			});
			syncRun(run);

			logger.info(
				'Planning started',
				{
					event: 'planning_started',
					mode: run.mode,
					planningStartedAt: run.timestamps.planningStartedAt,
					queuedAt: run.timestamps.queuedAt,
					runKind: run.runKind,
					sources: run.sources,
					trigger: run.trigger,
				},
				{ category: 'sync.lifecycle' },
			);

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
			logger.info(
				'Planning finished',
				{
					event: 'planning_finished',
					mode: run.mode,
					planSummary: run.planSummary,
					runKind: run.runKind,
					sources: run.sources,
					trigger: run.trigger,
				},
				{ category: 'sync.lifecycle' },
			);

			run = await sync.start({
				request,
				run,
				tasks,
			});

			return { executed: true, run };
		} finally {
			logger.popContext();
		}
	}

	private toRunMode(mode: SyncStartMode): SyncRunMode {
		return mode === SyncStartMode.MANUAL_SYNC ? 'manual' : 'auto';
	}
}
