import type { BaseTask } from '~/sync/tasks/task.interface';
import {
	createQueuedSyncRunSnapshot,
	syncRun,
	SyncPlanningSubStage,
	type SyncRunMode,
	type SyncRunSnapshot,
	type SyncTrigger,
	updateSyncRunSnapshot,
} from '~/events';
import { finalizeSyncRun } from '~/events/sync-terminate';
import { SyncEngine, SyncStartMode } from '~/sync';
import { isSyncCancelledError } from '~/sync/errors';
import { SyncRunKind } from '~/types';
import logger from '~/utils/logger';
import waitUntil from '~/utils/wait-until';
import type WebDAVSyncPlugin from '..';

export interface SyncOptions {
	mode: SyncStartMode;
	runKind: SyncRunKind;
}

export interface SyncExecutionRequest extends SyncOptions {
	runId: string;
	trigger: SyncTrigger;
	sources: SyncTrigger[];
	queuedAt: number;
}

export interface SyncExecutionResult {
	executed: boolean;
	run: SyncRunSnapshot | null;
}

// TODO: don't instantiate SyncEngine every time
export default class SyncExecutorService {
	constructor(private plugin: WebDAVSyncPlugin) {}

	async executeSync(request: SyncExecutionRequest): Promise<SyncExecutionResult> {
		if (this.plugin.isSyncing) return { executed: false, run: null };

		if (!this.plugin.isAccountConfigured()) return { executed: false, run: null };

		await waitUntil(() => this.plugin.isSyncing === false, 500);

		logger.pushContext({
			runId: request.runId,
			category: 'sync',
		});

		try {
			const sync = new SyncEngine(this.plugin, {
				vault: this.plugin.app.vault,
				token: this.plugin.getToken(),
				webdav: this.plugin.webDAVService.createWebDAVClient(),
			});

			let run = createQueuedSyncRunSnapshot({
				runId: request.runId,
				trigger: request.trigger,
				sources: request.sources,
				mode: this.toRunMode(request.mode),
				runKind: request.runKind,
				queuedAt: request.queuedAt,
			});
			syncRun(run);

			run = updateSyncRunSnapshot(run, {
				stage: 'planning',
				planningProgress: {
					subStage: SyncPlanningSubStage.preConnecting,
					totalWorkUnits: 0,
					completedWorkUnits: 0,
					currentItem: this.plugin.settings.remoteDir,
				},
				timestamps: {
					planningStartedAt: Date.now(),
				},
			});
			syncRun(run);
			logger.info(
				'Planning started',
				{
					event: 'planning_started',
					trigger: run.trigger,
					sources: run.sources,
					mode: run.mode,
					runKind: run.runKind,
					queuedAt: run.timestamps.queuedAt,
					planningStartedAt: run.timestamps.planningStartedAt,
				},
				{ category: 'sync.lifecycle' },
			);

			let tasks: BaseTask[] | null = null;
			try {
				tasks = await sync.preparePlan(request.runKind, (planningProgress) => {
					run = updateSyncRunSnapshot(run, { planningProgress });
					syncRun(run);
				});
			} catch (error) {
				run = finalizeSyncRun(run, {
					stage: isSyncCancelledError(error) ? 'cancelled' : 'failed',
					error,
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
					trigger: run.trigger,
					sources: run.sources,
					mode: run.mode,
					runKind: run.runKind,
					planSummary: run.planSummary,
				},
				{ category: 'sync.lifecycle' },
			);

			run = await sync.start({
				request,
				tasks,
				run,
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
