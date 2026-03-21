import {
	createQueuedSyncRunSnapshot,
	emitSyncRun,
	type SyncRunMode,
	type SyncRunSnapshot,
	type SyncTrigger,
	updateSyncRunSnapshot,
} from '~/events';
import { finalizeSyncRun } from '~/events/sync-terminate';
import { SyncRunKind } from '~/model/sync-record.model';
import { type PreparedSyncPlan, SyncEngine, SyncStartMode } from '~/sync';
import { isSyncCancelledError } from '~/sync/errors';
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
			const configDir = this.plugin.app.vault.configDir;
			const hasConfigDirRule = this.plugin.settings.filterRules.exclusionRules.some(
				(rule) => rule.expr === configDir,
			);
			if (!hasConfigDirRule) {
				this.plugin.settings.filterRules.exclusionRules.push({
					expr: configDir,
					options: { caseSensitive: false },
				});
				await this.plugin.saveSettings();
			}

			const sync = new SyncEngine(this.plugin, {
				vault: this.plugin.app.vault,
				token: this.plugin.getToken(),
				remoteServerUrl: this.plugin.settings.serverUrl,
				remoteBaseDir: this.plugin.remoteBaseDir,
				webdav: await this.plugin.webDAVService.createWebDAVClient(),
				syncStateStore: this.plugin.syncStateStore,
			});

			let run = createQueuedSyncRunSnapshot({
				runId: request.runId,
				trigger: request.trigger,
				sources: request.sources,
				mode: this.toRunMode(request.mode),
				runKind: request.runKind,
				queuedAt: request.queuedAt,
			});
			emitSyncRun(run);

			run = updateSyncRunSnapshot(run, {
				stage: 'planning',
				planningProgress: {
					subStage: 'loading_records',
					totalWorkUnits: 0,
					completedWorkUnits: 0,
					currentItem: this.plugin.remoteBaseDir,
				},
				timestamps: {
					planningStartedAt: Date.now(),
				},
			});
			emitSyncRun(run);
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

			let plan: PreparedSyncPlan;
			try {
				plan = await sync.preparePlan(request.runKind, {
					onPlanningProgress: (planningProgress) => {
						run = updateSyncRunSnapshot(run, {
							planningProgress,
						});
						emitSyncRun(run);
					},
				});
			} catch (error) {
				run = finalizeSyncRun(run, {
					stage: isSyncCancelledError(error) ? 'cancelled' : 'failed',
					error,
				});
				return { executed: true, run };
			}

			run = updateSyncRunSnapshot(run, {
				planSummary: sync.summarizePlan(plan.tasks),
			});
			emitSyncRun(run);
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

			if (!plan.hasActionableTasks) {
				run = finalizeSyncRun(run, {
					stage: 'completed_noop',
					patch: {
						resultSummary: {
							totalTasks: run.planSummary?.totalTasks ?? 0,
							succeededTasks: 0,
							failedTasks: 0,
							failed: [],
						},
					},
				});
				return { executed: true, run };
			}

			run = await sync.start({
				request,
				plan,
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
