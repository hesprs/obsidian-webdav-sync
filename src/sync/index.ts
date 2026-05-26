import type { Vault } from 'obsidian';
import type { WebDAVClient } from 'webdav';
import type {
	SyncFailedTaskInfo,
	SyncProgressSummary,
	SyncRunSnapshot,
	ProgressPatch,
	SyncPlanSummary,
} from '~/events';
import type { SyncExecutionRequest } from '~/services/sync-executor.service';
import DeleteConfirmModal from '~/components/DeleteConfirmModal';
import { syncRun, syncCancel, updateSyncRunSnapshot } from '~/events';
import finalizeSyncRun from '~/events/sync-terminate';
import { statItem } from '~/fs/vault';
import t from '~/i18n';
import { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/types';
import breakableSleep from '~/utils/breakable-sleep';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import { getTaskName } from '~/utils/get-task-info';
import isRetryableError from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';
import type { BaseTask, TaskResult } from './tasks/task.interface';
import TwoWaySyncDecider from './decision/two-way.decider';
import {
	SyncCancelledError,
	SyncRetryExhaustedError,
	isSyncCancelledError,
	toError,
} from './errors';
import AddRecordTask from './tasks/add-record.task';
import CleanRecordTask from './tasks/clean-record.task';
import MkdirRemoteTask from './tasks/mkdir-remote.task';
import PushTask from './tasks/push.task';
import RemoveLocalTask from './tasks/remove-local.task';
import { TaskError } from './tasks/task.interface';
import optimizeTasks from './utils/optimize-tasks';

type SyncResultSummary = {
	totalTasks: number;
	succeededTasks: number;
	failedTasks: number;
	failed: Array<SyncFailedTaskInfo>;
};

export default class SyncEngine {
	isCancelled = false;

	private readonly unsubscribeSyncCancel: () => void;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly options: {
			vault: Vault;
			webdav: WebDAVClient;
			token: string;
		},
	) {
		this.options = Object.freeze(this.options);
		this.unsubscribeSyncCancel = syncCancel.subscribe(() => (this.isCancelled = true));
	}

	runKind: SyncRunKind = SyncRunKind.normal;

	async preparePlan(
		runKind: SyncRunKind = SyncRunKind.normal,
		onProgress?: (progress: ProgressPatch) => void,
	): Promise<Array<BaseTask>> {
		this.runKind = runKind;
		const syncRecord = this.createSyncRecord();
		await this.ensureRemoteBaseDirReady(syncRecord);
		this.throwIfCancelled();

		const tasks = await new TwoWaySyncDecider(this, this.options.token, syncRecord).decide({
			onProgress,
			throwIfCancelled: this.throwIfCancelled,
		});
		this.throwIfCancelled();

		return tasks;
	}

	async start({
		request,
		tasks,
		run,
	}: {
		request: SyncExecutionRequest;
		tasks: Array<BaseTask>;
		run: SyncRunSnapshot;
	}): Promise<SyncRunSnapshot> {
		try {
			this.runKind = request.runKind;

			const settings = this.settings;
			let currentRun = updateSyncRunSnapshot(run, {
				planSummary: this.summarizePlan(tasks),
			});
			syncRun(currentRun);
			logger.info('Execution started');

			if (tasks.length === 0) {
				currentRun = finalizeSyncRun(currentRun, {
					patch: {
						resultSummary: {
							failed: [],
							failedTasks: 0,
							succeededTasks: 0,
							totalTasks: 0,
						},
					},
					stage: 'completed_noop',
				});
				return currentRun;
			}

			const displayableTasks = tasks.filter((task) => this.isDisplayableTask(task));
			const notDisplayableTasks = tasks.filter((task) => !this.isDisplayableTask(task));

			if (this.isCancelled) {
				currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
				return currentRun;
			}

			if (
				request.trigger === 'manual' &&
				settings.confirmBeforeSync &&
				displayableTasks.length > 0
			) {
				currentRun = updateSyncRunSnapshot(currentRun, {
					planSummary: {
						...this.summarizePlan(tasks),
						requiresConfirmation: true,
					},
					stage: 'awaiting_confirmation',
					timestamps: {
						confirmationStartedAt: Date.now(),
					},
				});
				syncRun(currentRun);
				const confirmExec =
					await this.plugin.observabilityService.confirmManualTasks(displayableTasks);
				if (confirmExec.confirmed)
					tasks = [...notDisplayableTasks, ...confirmExec.selectedTasks];
				else {
					currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
					return currentRun;
				}
			}

			// Check for RemoveLocalTask during auto-sync and ask for confirmation
			if (request.trigger !== 'manual' && settings.confirmBeforeDeleteInAutoSync) {
				const removeLocalTasks = tasks.filter((task) => task instanceof RemoveLocalTask);
				const otherTasks = tasks.filter((task) => !(task instanceof RemoveLocalTask));
				if (removeLocalTasks.length > 0) {
					currentRun = updateSyncRunSnapshot(currentRun, {
						planSummary: {
							...this.summarizePlan(tasks),
							requiresDeleteConfirmation: true,
							warnings: [
								{
									code: 'delete_confirmation',
									messageKey: 'deleteConfirm.warningNotice',
								},
							],
						},
						stage: 'awaiting_confirmation',
						timestamps: {
							confirmationStartedAt:
								currentRun.timestamps.confirmationStartedAt ?? Date.now(),
						},
					});
					syncRun(currentRun);
					const { tasksToDelete, tasksToReupload } = await new DeleteConfirmModal(
						this.app,
						removeLocalTasks,
					).openAndWait();

					const reuploadTasks = await this.convertDeleteToUpload(tasksToReupload);

					tasks = [...tasksToDelete, ...reuploadTasks, ...otherTasks];
				}
			}

			const optimizedTaskGroups = optimizeTasks(
				tasks,
				settings.maxSyncTaskConcurrency,
				settings.maxThroughputConcurrency,
			);
			const optimizedTasks = optimizedTaskGroups.flat();
			const allTasksResult: Array<TaskResult> = [];

			const totalDisplayableTasks = optimizedTasks.filter((task) =>
				this.isDisplayableTask(task),
			);

			// Track all completed tasks across all batches
			const allCompletedTasks: Array<BaseTask> = [];
			currentRun = updateSyncRunSnapshot(currentRun, {
				planSummary: this.summarizePlan(optimizedTasks),
				progressSummary: this.createProgressSummary(
					totalDisplayableTasks,
					allCompletedTasks,
				),
				stage: 'executing',
				timestamps: { executionStartedAt: Date.now() },
			});
			syncRun(currentRun);

			for (const taskGroup of optimizedTaskGroups) {
				if (this.isCancelled) break;

				const groupExecution = await this.execTaskGroup(
					currentRun,
					taskGroup,
					totalDisplayableTasks,
					allCompletedTasks,
				);
				currentRun = groupExecution.run;
				allTasksResult.push(...groupExecution.results);
			}

			const resultSummary = this.createResultSummary(allTasksResult);
			const failedCount = resultSummary.failedTasks;
			currentRun = finalizeSyncRun(currentRun, {
				patch: {
					errorSummary:
						failedCount > 0
							? {
									message: t('sync.completeWithFailed', { failedCount }),
								}
							: undefined,
					progressSummary: this.createProgressSummary(
						totalDisplayableTasks,
						allCompletedTasks,
					),
					resultSummary,
				},
				stage: this.isCancelled ? 'cancelled' : failedCount > 0 ? 'failed' : 'completed',
			});
			return currentRun;
		} catch (error) {
			const failedRun = finalizeSyncRun(run, {
				error,
				stage: isSyncCancelledError(error) ? 'cancelled' : 'failed',
			});
			return failedRun;
		} finally {
			this.unsubscribeSyncCancel();
		}
	}

	summarizePlan(tasks: Array<BaseTask>): SyncPlanSummary {
		return {
			requiresConfirmation: false,
			requiresDeleteConfirmation: false,
			totalTasks: tasks.length,
			warnings: [],
		};
	}

	private async convertDeleteToUpload(tasks: Array<RemoveLocalTask>) {
		const final: Array<PushTask | MkdirRemoteTask> = [];
		for (const task of tasks) {
			const options = task.options;
			const local = await statItem(this.vault, options.localPath);
			if (!local)
				throw new Error(`Local file item not found during reupload: ${options.localPath}`);
			if (local.isDir) final.push(new MkdirRemoteTask({ ...options, local }));
			else final.push(new PushTask({ ...options, local }));
		}
		return final;
	}

	private isDisplayableTask(task: BaseTask): boolean {
		return !(task instanceof CleanRecordTask) && !(task instanceof AddRecordTask);
	}

	private createSyncRecord() {
		return new SyncRecord(
			this.getStateKey(),
			this.plugin.syncStateStore,
			this.plugin.baseTextStore,
			this.plugin.fileChunkStore,
		);
	}

	private async ensureRemoteBaseDirReady(syncRecord: SyncRecord) {
		const webdav = this.webdav;
		const remoteBaseDir = this.remoteBaseDir;

		let remoteBaseDirExists = await this.retryWebDAVCall(() => webdav.exists(remoteBaseDir));

		if (!remoteBaseDirExists) await syncRecord.drop();

		while (!remoteBaseDirExists) {
			this.throwIfCancelled();

			try {
				await webdav.createDirectory(remoteBaseDir, {
					recursive: true,
				});
				remoteBaseDirExists = true;
				continue;
			} catch (error) {
				if (isRetryableError(error)) {
					await breakableSleep(syncCancel, 5000);
					this.throwIfCancelled();
					// oxlint-disable-next-line no-useless-assignment
					remoteBaseDirExists = await this.retryWebDAVCall(() =>
						webdav.exists(remoteBaseDir),
					);
					continue;
				}
				throw error;
			}
		}
	}

	private async execTaskGroup(
		run: SyncRunSnapshot,
		tasks: Array<BaseTask>,
		totalDisplayableTasks: Array<BaseTask>,
		allCompletedTasks: Array<BaseTask>,
	) {
		let currentRun = run;
		const tasksToDisplay = tasks.filter((task) => this.isDisplayableTask(task));
		const settledResults = await Promise.allSettled(
			tasks.map(async (task) => {
				const result = await this.executeWithRetry(task);
				if (this.isDisplayableTask(task)) {
					allCompletedTasks.push(task);
					currentRun = updateSyncRunSnapshot(currentRun, {
						progressSummary: this.createProgressSummary(
							totalDisplayableTasks,
							allCompletedTasks,
						),
					});
					syncRun(currentRun);
				}
				return result;
			}),
		);
		const results: Array<TaskResult> = settledResults.map((result, index) => {
			if (result.status === 'fulfilled') return result.value;
			const reason = result.reason;
			return {
				error: new TaskError(
					reason instanceof Error ? reason.message : String(reason),
					tasks[index],
					reason instanceof Error ? reason : undefined,
				),
				success: false,
			};
		});

		for (let i = 0; i < tasks.length; ++i) {
			const task = tasks[i];
			const taskResult = results[i];
			const taskName = getTaskName(task.name);
			if (!taskResult.success)
				logger.warn('Task execution failed', {
					error: taskResult.error,
					index: i + 1,
					localPath: task.localPath,
					remotePath: task.remotePath,
					taskName,
					totalTasks: tasksToDisplay.length,
				});
		}

		return { results, run: currentRun };
	}

	private createProgressSummary(
		totalDisplayableTasks: Array<BaseTask>,
		allCompletedTasks: Array<BaseTask>,
	): SyncProgressSummary {
		return {
			completed: allCompletedTasks.map((task) => ({
				path: task.localPath,
				taskName: task.name ?? 'sync',
			})),
			completedTasks: allCompletedTasks.length,
			totalTasks: totalDisplayableTasks.length,
		};
	}

	private createResultSummary(results: Array<TaskResult>): SyncResultSummary {
		const failed: Array<SyncFailedTaskInfo> = [];

		for (const result of results)
			if (!result.success && result.error) {
				const task = result.error.task;
				failed.push({
					errorMessage: result.error.message,
					localPath: task.options.localPath,
					name: task.name,
				});
			}

		return {
			failed,
			failedTasks: failed.length,
			succeededTasks: results.filter((result) => result.success).length,
			totalTasks: results.length,
		};
	}

	/**
	 * Automatically handle 503 errors and retry task execution
	 */
	private async executeWithRetry(task: BaseTask): Promise<TaskResult> {
		let attempt = 0;
		while (true) {
			if (this.isCancelled)
				return {
					error: new TaskError(t('sync.cancelled'), task),
					success: false,
				};

			const taskResult = await task.exec();
			if (!taskResult.success && isRetryableError(taskResult.error)) {
				attempt++;
				logger.warn('Retrying task after transient error', {
					attempt,
					error: taskResult.error,
					localPath: task.localPath,
					remotePath: task.remotePath,
					taskName: getTaskName(task.name),
				});
				await breakableSleep(syncCancel, 5000);
				if (this.isCancelled)
					return {
						error: new TaskError(t('sync.cancelled'), task),
						success: false,
					};

				continue;
			}
			return taskResult;
		}
	}

	private async retryWebDAVCall<T>(operation: () => Promise<T>) {
		let retryCount = 0;
		while (true) {
			this.throwIfCancelled();

			try {
				return await operation();
			} catch (error) {
				if (!isRetryableError(error)) {
					logger.error('WebDAV operation failed', error);
					throw toError(error, 'WebDAV operation failed');
				}

				retryCount++;
				const retryError = toError(error, 'WebDAV operation failed');
				const err = error as { status?: number; res?: { status?: number } };
				const statusCode = err.status ?? err.res?.status;
				// 401 (Unauthorized) may be transient — use longer wait and higher retry cap
				const retry401Cfg = this.settings.retry401;
				const retry401IntervalCfg = this.settings.retry401Interval;
				const maxRetries = statusCode === 401
					? (retry401Cfg.enabled ? retry401Cfg.value : 10)
					: 3;
				const waitMs = statusCode === 401
					? (retry401IntervalCfg.enabled ? retry401IntervalCfg.value : 30) * 1000
					: 5000;
				if (retryCount >= maxRetries) {
					logger.error('WebDAV connection failed after retries', {
						error: retryError,
						retryCount,
						statusCode,
					});
					throw new SyncRetryExhaustedError(undefined, retryError);
				}

				logger.warn('Retrying WebDAV operation after transient error', {
					error: retryError,
					retryCount,
					statusCode,
				});
				await breakableSleep(syncCancel, waitMs);
				this.throwIfCancelled();
			}
		}
	}

	private readonly throwIfCancelled = () => {
		if (!this.isCancelled) return;
		logger.warn('WebDAV operation cancelled');
		throw new SyncCancelledError();
	};

	get app() {
		return this.plugin.app;
	}

	get webdav() {
		return this.options.webdav;
	}

	get vault() {
		return this.options.vault;
	}

	get remoteBaseDir() {
		return this.settings.remoteDir;
	}

	get settings() {
		return this.plugin.settings;
	}

	private getStateKey() {
		return getSyncStateKey({
			account: this.settings.account,
			remoteBaseDir: this.remoteBaseDir,
			serverUrl: this.settings.serverUrl,
			vaultName: this.vault.getName(),
		});
	}
}
