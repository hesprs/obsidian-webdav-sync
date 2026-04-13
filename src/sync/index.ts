import type { WebDAVClient } from 'webdav';
import { Vault } from 'obsidian';
import type { SyncExecutionRequest } from '~/services/sync-executor.service';
import DeleteConfirmModal from '~/components/DeleteConfirmModal';
import TaskListConfirmModal from '~/components/TaskListConfirmModal';
import {
	syncRun,
	syncCancel,
	type SyncFailedTaskInfo,
	type SyncPlanningProgress,
	type SyncPlanSummary,
	type SyncProgressSummary,
	type SyncRunSnapshot,
	updateSyncRunSnapshot,
} from '~/events';
import { finalizeSyncRun } from '~/events/sync-terminate';
import t from '~/i18n';
import { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/types';
import breakableSleep from '~/utils/breakable-sleep';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import getTaskName from '~/utils/get-task-name';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-item';
import WebDAVSyncPlugin from '..';
import TwoWaySyncDecider from './decision/two-way.decider';
import {
	isSyncCancelledError,
	SyncCancelledError,
	SyncRetryExhaustedError,
	toError,
} from './errors';
import AddRecordTask from './tasks/add-record.task';
import CleanRecordTask from './tasks/clean-record.task';
import MkdirRemoteTask from './tasks/mkdir-remote.task';
import PushTask from './tasks/push.task';
import RemoveLocalTask from './tasks/remove-local.task';
import { BaseTask, TaskError, type TaskResult } from './tasks/task.interface';
import { optimizeTasks } from './utils/optimize-tasks';

export enum SyncStartMode {
	MANUAL_SYNC = 'manual_sync',
	AUTO_SYNC = 'auto_sync',
}

interface SyncResultSummary {
	totalTasks: number;
	succeededTasks: number;
	failedTasks: number;
	failed: SyncFailedTaskInfo[];
}

export class SyncEngine {
	isCancelled: boolean = false;

	private unsubscribeSyncCancel: () => void;

	constructor(
		private plugin: WebDAVSyncPlugin,
		private options: {
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
		onProgress?: (progress: SyncPlanningProgress) => void,
	): Promise<BaseTask[]> {
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
		tasks: passedTasks,
		run,
	}: {
		request: SyncExecutionRequest;
		tasks?: BaseTask[];
		run: SyncRunSnapshot;
	}): Promise<SyncRunSnapshot> {
		try {
			this.runKind = request.runKind;

			const settings = this.settings;
			let tasks = passedTasks ?? (await this.preparePlan(request.runKind));
			let currentRun = updateSyncRunSnapshot(run, {
				planSummary: this.summarizePlan(tasks),
			});
			syncRun(currentRun);
			logger.info(
				'Execution started',
				{
					event: 'execution_started',
					trigger: currentRun.trigger,
					sources: currentRun.sources,
					mode: currentRun.mode,
					runKind: currentRun.runKind,
					planSummary: currentRun.planSummary,
					progressSummary: currentRun.progressSummary,
					timestamps: currentRun.timestamps,
				},
				{ category: 'sync.lifecycle' },
			);

			if (tasks.length === 0) {
				currentRun = finalizeSyncRun(currentRun, {
					stage: 'completed_noop',
					patch: {
						resultSummary: {
							totalTasks: 0,
							succeededTasks: 0,
							failedTasks: 0,
							failed: [],
						},
					},
				});
				return currentRun;
			}

			const displayableTasks = tasks.filter((t) => this.isDisplayableTask(t));
			const notDisplayableTasks = tasks.filter((t) => !this.isDisplayableTask(t));

			if (this.isCancelled) {
				currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
				return currentRun;
			}

			if (
				request.mode === SyncStartMode.MANUAL_SYNC &&
				settings.confirmBeforeSync &&
				displayableTasks.length > 0
			) {
				currentRun = updateSyncRunSnapshot(currentRun, {
					stage: 'awaiting_confirmation',
					planSummary: {
						...this.summarizePlan(tasks),
						requiresConfirmation: true,
					},
					timestamps: {
						confirmationStartedAt: Date.now(),
					},
				});
				syncRun(currentRun);
				const confirmExec = await new TaskListConfirmModal(
					this.app,
					displayableTasks,
				).openAndWait();
				if (confirmExec.confirm) tasks = [...notDisplayableTasks, ...confirmExec.tasks];
				else {
					currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
					return currentRun;
				}
			}

			// Check for RemoveLocalTask during auto-sync and ask for confirmation
			if (
				request.mode === SyncStartMode.AUTO_SYNC &&
				settings.confirmBeforeDeleteInAutoSync
			) {
				const removeLocalTasks = tasks.filter((t) => t instanceof RemoveLocalTask);
				const otherTasks = tasks.filter((t) => !(t instanceof RemoveLocalTask));
				if (removeLocalTasks.length > 0) {
					currentRun = updateSyncRunSnapshot(currentRun, {
						stage: 'awaiting_confirmation',
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

			const optimizedTaskGroups = optimizeTasks(tasks, settings.maxConcurrentSyncTasks);
			const optimizedTasks = optimizedTaskGroups.flat();
			const allTasksResult: TaskResult[] = [];

			const totalDisplayableTasks = optimizedTasks.filter((task) =>
				this.isDisplayableTask(task),
			);

			// Track all completed tasks across all batches
			const allCompletedTasks: BaseTask[] = [];
			currentRun = updateSyncRunSnapshot(currentRun, {
				stage: 'executing',
				planSummary: this.summarizePlan(optimizedTasks),
				progressSummary: this.createProgressSummary(
					totalDisplayableTasks,
					allCompletedTasks,
				),
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
				stage: this.isCancelled ? 'cancelled' : failedCount > 0 ? 'failed' : 'completed',
				patch: {
					progressSummary: this.createProgressSummary(
						totalDisplayableTasks,
						allCompletedTasks,
					),
					resultSummary,
					errorSummary:
						failedCount > 0
							? {
									message: t('sync.completeWithFailed', { failedCount }),
								}
							: undefined,
				},
			});
			return currentRun;
		} catch (error) {
			const failedRun = finalizeSyncRun(run, {
				stage: isSyncCancelledError(error) ? 'cancelled' : 'failed',
				error,
			});
			return failedRun;
		} finally {
			this.unsubscribeSyncCancel();
		}
	}

	summarizePlan(tasks: BaseTask[]): SyncPlanSummary {
		return {
			totalTasks: tasks.length,
			requiresConfirmation: false,
			requiresDeleteConfirmation: false,
			warnings: [],
		};
	}

	private async convertDeleteToUpload(tasks: RemoveLocalTask[]) {
		const final: (PushTask | MkdirRemoteTask)[] = [];
		for (const task of tasks) {
			const options = task.options;
			const local = await statVaultItem(this.vault, options.localPath);
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
		tasks: BaseTask[],
		totalDisplayableTasks: BaseTask[],
		allCompletedTasks: BaseTask[],
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
		const results: TaskResult[] = settledResults.map((result, index) => {
			if (result.status === 'fulfilled') return result.value;
			const reason = result.reason;
			return {
				success: false,
				error: new TaskError(
					reason instanceof Error ? reason.message : String(reason),
					tasks[index],
					reason instanceof Error ? reason : undefined,
				),
			};
		});

		for (let i = 0; i < tasks.length; ++i) {
			const task = tasks[i];
			const taskResult = results[i];
			const taskName = task.toJSON().taskName;
			if (!taskResult.success) {
				logger.warn(
					'Task execution failed',
					{
						index: i + 1,
						totalTasks: tasksToDisplay.length,
						taskName,
						localPath: task.localPath,
						remotePath: task.remotePath,
						error: taskResult.error,
					},
					{ category: 'sync.task' },
				);
			}
		}

		return { run: currentRun, results };
	}

	private createProgressSummary(
		totalDisplayableTasks: BaseTask[],
		allCompletedTasks: BaseTask[],
	): SyncProgressSummary {
		return {
			totalTasks: totalDisplayableTasks.length,
			completedTasks: allCompletedTasks.length,
			completed: allCompletedTasks.map((task) => ({
				taskName: getTaskName(task),
				localPath: task.localPath,
				remotePath: task.remotePath,
			})),
		};
	}

	private createResultSummary(results: TaskResult[]): SyncResultSummary {
		const failed: SyncFailedTaskInfo[] = [];

		for (const result of results) {
			if (!result.success && result.error) {
				const task = result.error.task;
				failed.push({
					taskName: getTaskName(task),
					localPath: task.options.localPath,
					errorMessage: result.error.message,
				});
			}
		}

		return {
			totalTasks: results.length,
			succeededTasks: results.filter((result) => result.success).length,
			failedTasks: failed.length,
			failed,
		};
	}

	/**
	 * Automatically handle 503 errors and retry task execution
	 */
	private async executeWithRetry(task: BaseTask): Promise<TaskResult> {
		let attempt = 0;
		while (true) {
			if (this.isCancelled) {
				return {
					success: false,
					error: new TaskError(t('sync.cancelled'), task),
				};
			}
			const taskResult = await task.exec();
			if (!taskResult.success && isRetryableError(taskResult.error)) {
				attempt++;
				logger.warn(
					'Retrying task after transient error',
					{
						attempt,
						taskName: getTaskName(task),
						localPath: task.localPath,
						remotePath: task.remotePath,
						error: taskResult.error,
					},
					{ category: 'sync.retry' },
				);
				await breakableSleep(syncCancel, 5000);
				if (this.isCancelled) {
					return {
						success: false,
						error: new TaskError(t('sync.cancelled'), task),
					};
				}
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
					logger.error('WebDAV operation failed', { error }, { category: 'sync.retry' });
					throw toError(error, 'WebDAV operation failed');
				}

				retryCount++;
				const retryError = toError(error, 'WebDAV operation failed');
				if (retryCount >= 3) {
					logger.error(
						'WebDAV connection failed after retries',
						{ retryCount, error: retryError },
						{ category: 'sync.retry' },
					);
					throw new SyncRetryExhaustedError(undefined, retryError);
				}

				logger.warn(
					'Retrying WebDAV operation after transient error',
					{ retryCount, error: retryError },
					{ category: 'sync.retry' },
				);
				await breakableSleep(syncCancel, 5000);
				this.throwIfCancelled();
			}
		}
	}

	private throwIfCancelled = () => {
		if (!this.isCancelled) return;
		logger.warn('WebDAV operation cancelled', undefined, {
			category: 'sync.retry',
		});
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
			vaultName: this.vault.getName(),
			remoteBaseDir: this.remoteBaseDir,
			serverUrl: this.settings.serverUrl,
			account: this.settings.account,
		});
	}
}
