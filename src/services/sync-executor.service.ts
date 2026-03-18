import {
	createQueuedSyncRunSnapshot,
	emitSyncRun,
	type SyncRunMode,
	type SyncRunSnapshot,
	type SyncTrigger,
	updateSyncRunSnapshot,
} from '~/events';
import { SyncRunKind } from '~/model/sync-record.model';
import { SyncEngine, SyncStartMode } from '~/sync';
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

			const plan = await sync.preparePlan(request.runKind);
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

			if (sync.isCancelled) {
				run = updateSyncRunSnapshot(run, {
					stage: 'cancelled',
					timestamps: {
						endedAt: Date.now(),
					},
				});
				emitSyncRun(run);
				logger.warn('Sync cancelled during planning', this.createTerminalLogMetadata(run), {
					category: 'sync.lifecycle',
				});
				return { executed: true, run };
			}

			if (!plan.hasActionableTasks) {
				run = updateSyncRunSnapshot(run, {
					stage: 'completed_noop',
					resultSummary: {
						totalTasks: run.planSummary?.totalTasks ?? 0,
						succeededTasks: 0,
						failedTasks: 0,
						failed: [],
					},
					timestamps: {
						endedAt: Date.now(),
					},
				});
				emitSyncRun(run);
				logger.info('Sync completed with no changes', this.createTerminalLogMetadata(run), {
					category: 'sync.lifecycle',
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

	private createTerminalLogMetadata(run: SyncRunSnapshot) {
		return {
			event: 'terminal_outcome',
			trigger: run.trigger,
			sources: run.sources,
			mode: run.mode,
			runKind: run.runKind,
			stage: run.stage,
			timestamps: run.timestamps,
			planSummary: run.planSummary,
			progressSummary: run.progressSummary,
			resultSummary: run.resultSummary,
			errorSummary: run.errorSummary,
		};
	}

	private toRunMode(mode: SyncStartMode): SyncRunMode {
		return mode === SyncStartMode.MANUAL_SYNC ? 'manual' : 'auto';
	}
}
