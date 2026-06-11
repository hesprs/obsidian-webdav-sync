import type {
	SyncFailedTaskInfo,
	SyncProgressSummary,
	SyncRunSnapshot,
	ProgressPatch,
	SyncPlanSummary,
	SyncResultSummary,
} from '~/events';
import type { RemoteFs, VaultFs } from '~/fs-new';
import type { SyncExecutionRequest } from '~/services/sync-executor.service';
import DeleteConfirmModal from '~/components/DeleteConfirmModal';
import { syncRun, syncCancel, updateSyncRunSnapshot } from '~/events';
import finalizeSyncRun from '~/events/sync-terminate';
import t from '~/i18n';
import { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/types';
import getStateKey from '~/utils/get-state-key';
import { getTaskName } from '~/utils/get-task-info';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';
import type { BaseTask, TaskResult } from './tasks/task.interface';
import TwoWaySyncDecider from './decision/two-way.decider';
import { SyncCancelledError, isSyncCancelledError } from './errors';
import AddRecordTask from './tasks/add-record.task';
import CleanRecordTask from './tasks/clean-record.task';
import MkdirRemoteTask from './tasks/mkdir-remote.task';
import PushTask from './tasks/push.task';
import RemoveLocalTask from './tasks/remove-local.task';
import { TaskError } from './tasks/task.interface';
import optimizeTasks from './utils/optimize-tasks';

export default class SyncEngine {
	isCancelled = false;

	private readonly unsubscribeSyncCancel: () => void;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly options: {
			vaultFs: VaultFs;
			webdavFs: RemoteFs;
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
							completed: 0,
							failed: 0,
							failedTasks: [],
							total: 0,
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
						this.plugin.app,
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
			const failedCount = resultSummary.failed;
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
			total: tasks.length,
			warnings: [],
		};
	}

	private async convertDeleteToUpload(tasks: Array<RemoveLocalTask>) {
		const final: Array<PushTask | MkdirRemoteTask> = [];
		for (const task of tasks) {
			const options = task.options;
			const local = await this.vault.stat(options.key);
			if (!local)
				throw new Error(`Local file item not found during reupload: ${options.key}`);
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
		const { webdav } = this;
		if (await webdav.exists('/')) return;
		await syncRecord.drop();
		this.throwIfCancelled();
		await webdav.mkdir('/', true);
	}

	private async execTaskGroup(
		run: SyncRunSnapshot,
		tasks: Array<BaseTask>,
		totalDisplayableTasks: Array<BaseTask>,
		allCompletedTasks: Array<BaseTask>,
	) {
		let currentRun = run;
		const settledResults = await Promise.allSettled(
			tasks.map(async (task) => {
				const result = await task.exec();
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
					key: task.key,
					taskName,
				});
		}

		return { results, run: currentRun };
	}

	private createProgressSummary(
		totalDisplayableTasks: Array<BaseTask>,
		allCompletedTasks: Array<BaseTask>,
	): SyncProgressSummary {
		return {
			completed: allCompletedTasks.length,
			completedTasks: allCompletedTasks.map((task) => ({
				path: task.key,
				taskName: task.name ?? 'sync',
			})),
			total: totalDisplayableTasks.length,
		};
	}

	private createResultSummary(results: Array<TaskResult>): SyncResultSummary {
		const failedTasks: Array<SyncFailedTaskInfo> = [];

		for (const result of results)
			if (!result.success && result.error) {
				const task = result.error.task;
				failedTasks.push({
					errorMessage: result.error.message,
					key: task.key,
					name: task.name,
				});
			}

		return {
			completed: results.filter((result) => result.success).length,
			failed: failedTasks.length,
			failedTasks,
			total: results.length,
		};
	}

	private readonly throwIfCancelled = () => {
		if (!this.isCancelled) return;
		logger.warn('WebDAV operation cancelled');
		throw new SyncCancelledError();
	};

	get webdav() {
		return this.options.webdavFs;
	}

	get vault() {
		return this.options.vaultFs;
	}

	get settings() {
		return this.plugin.settings;
	}

	private getStateKey() {
		return getStateKey(this.webdav, this.vault);
	}
}
