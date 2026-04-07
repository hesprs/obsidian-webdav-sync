import type { WebDAVClient } from 'webdav';
import { Vault } from 'obsidian';
import { Subscription } from 'rxjs';
import type { SyncExecutionRequest } from '~/services/sync-executor.service';
import DeleteConfirmModal from '~/components/DeleteConfirmModal';
import TaskListConfirmModal from '~/components/TaskListConfirmModal';
import {
	emitSyncRun,
	onCancelSync,
	type SyncFailedTaskInfo,
	type SyncPlanningProgress,
	type SyncPlanSummary,
	type SyncProgressSummary,
	type SyncRunSnapshot,
	updateSyncRunSnapshot,
} from '~/events';
import { finalizeSyncRun } from '~/events/sync-terminate';
import i18n from '~/i18n';
import { remoteDirname, vaultDirname } from '~/platform/path';
import { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/types';
import breakableSleep from '~/utils/breakable-sleep';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import getTaskName from '~/utils/get-task-name';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import type { PlannedPathSnapshot } from './decision/sync-decision.interface';
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

interface ReuploadSnapshotIndex {
	byLocalPath: Map<string, PlannedPathSnapshot[]>;
	byRemotePath: Map<string, PlannedPathSnapshot[]>;
	knownRemoteDirPaths: Set<string>;
	localPaths: Set<string>;
	remotePaths: Set<string>;
}

// TODO: split into multiple modules
export class SyncEngine {
	isCancelled: boolean = false;

	private subscriptions: Subscription[] = [];

	constructor(
		private plugin: WebDAVSyncPlugin,
		private options: {
			vault: Vault;
			webdav: WebDAVClient;
			token: string;
		},
	) {
		this.options = Object.freeze(this.options);
		this.subscriptions.push(
			onCancelSync().subscribe(() => {
				this.isCancelled = true;
			}),
		);
	}

	runKind: SyncRunKind = SyncRunKind.normal;

	async preparePlan(
		runKind: SyncRunKind = SyncRunKind.normal,
		options?: {
			onPlanningProgress?: (progress: SyncPlanningProgress) => Promise<void> | void;
		},
	): Promise<BaseTask[]> {
		this.runKind = runKind;
		const syncRecord = this.createSyncRecord();
		await this.ensureRemoteBaseDirReady(syncRecord);
		this.throwIfCancelled();

		const tasks = await new TwoWaySyncDecider(this, this.options.token, syncRecord).decide({
			onPlanningProgress: options?.onPlanningProgress,
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
			const syncRecord = this.createSyncRecord();
			let tasks = passedTasks ?? (await this.preparePlan(request.runKind));
			let currentRun = updateSyncRunSnapshot(run, {
				planSummary: this.summarizePlan(tasks),
			});
			emitSyncRun(currentRun);
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
				emitSyncRun(currentRun);
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
					emitSyncRun(currentRun);
					const { tasksToDelete, tasksToReupload } = await new DeleteConfirmModal(
						this.app,
						removeLocalTasks,
					).openAndWait();

					tasks = this.rebuildConfirmedTasksAfterDeleteConfirmation({
						tasks,
						tasksToDelete,
						tasksToReupload,
						syncRecord,
					});
				}
			}

			const optimizedTaskGroups = optimizeTasks(tasks);
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
			emitSyncRun(currentRun);

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
									message: i18n.t('sync.completeWithFailed', { failedCount }),
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
			this.subscriptions.forEach((sub) => sub.unsubscribe());
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

	private rebuildConfirmedTasksAfterDeleteConfirmation({
		tasks,
		tasksToDelete,
		tasksToReupload,
		syncRecord,
	}: {
		tasks: BaseTask[];
		tasksToDelete: RemoveLocalTask[];
		tasksToReupload: RemoveLocalTask[];
		syncRecord: SyncRecord;
	}): BaseTask[] {
		const { mkdirTasks, pushTasks } = this.buildReuploadTasks({
			tasks,
			tasksToReupload,
			syncRecord,
		});
		const deleteTaskSet = this.filterDeleteTasks(tasksToDelete, tasksToReupload);
		const otherTasks: BaseTask[] = [];
		const deleteTasks: RemoveLocalTask[] = [];

		for (const task of tasks) {
			if (!(task instanceof RemoveLocalTask)) {
				otherTasks.push(task);
				continue;
			}

			if (deleteTaskSet.has(task)) deleteTasks.push(task);
		}

		return [...mkdirTasks, ...otherTasks, ...pushTasks, ...deleteTasks];
	}

	private buildReuploadTasks({
		tasks,
		tasksToReupload,
		syncRecord,
	}: {
		tasks: BaseTask[];
		tasksToReupload: RemoveLocalTask[];
		syncRecord: SyncRecord;
	}): {
		mkdirTasks: MkdirRemoteTask[];
		pushTasks: PushTask[];
	} {
		const snapshotIndex = this.buildReuploadSnapshotIndex([...tasks, ...tasksToReupload]);
		const mkdirTasksMap = new Map<string, MkdirRemoteTask>();
		const pushTasks: PushTask[] = [];
		const knownRemotePaths = new Set<string>(snapshotIndex.knownRemoteDirPaths);

		for (const task of tasksToReupload) {
			const plannedSnapshot = this.findPlannedSnapshot(
				snapshotIndex,
				task.localPath,
				task.remotePath,
			);

			this.ensureReuploadParentDir({
				tasks,
				knownRemotePaths,
				localPath: task.localPath,
				mkdirTasksMap,
				remotePath: task.remotePath,
				snapshotIndex,
				syncRecord,
			});

			const isDirectory = this.isReuploadDirectoryPath(
				task.localPath,
				task.remotePath,
				plannedSnapshot,
				snapshotIndex,
			);

			if (isDirectory) {
				const reuploadMkdirOptions = {
					...task.options,
				} as MkdirRemoteTask['options'] & {
					local?: PlannedPathSnapshot['local'];
					remote?: PlannedPathSnapshot['remote'];
				};
				reuploadMkdirOptions.local = plannedSnapshot?.local;
				reuploadMkdirOptions.remote = plannedSnapshot?.remote;

				mkdirTasksMap.set(task.remotePath, new MkdirRemoteTask(reuploadMkdirOptions));
				this.markRemotePathAndParentsAsExisting(knownRemotePaths, task.remotePath);
				continue;
			}

			const reuploadPushOptions = {
				...task.options,
			} as PushTask['options'] & {
				local?: PlannedPathSnapshot['local'];
				remote?: PlannedPathSnapshot['remote'];
			};
			reuploadPushOptions.local = plannedSnapshot?.local;
			reuploadPushOptions.remote = plannedSnapshot?.remote;

			pushTasks.push(new PushTask(reuploadPushOptions));
		}

		return {
			mkdirTasks: Array.from(mkdirTasksMap.values()),
			pushTasks,
		};
	}

	private ensureReuploadParentDir({
		tasks,
		knownRemotePaths,
		localPath,
		mkdirTasksMap,
		remotePath,
		snapshotIndex,
		syncRecord,
	}: {
		tasks: BaseTask[];
		knownRemotePaths: Set<string>;
		localPath: string;
		mkdirTasksMap: Map<string, MkdirRemoteTask>;
		remotePath: string;
		snapshotIndex: ReuploadSnapshotIndex;
		syncRecord: SyncRecord;
	}): void {
		const parentLocalPath = vaultDirname(localPath);
		const parentRemotePath = remoteDirname(remotePath);

		if (parentLocalPath === '.' || parentLocalPath === '') return;

		const parentAlreadyHandled =
			mkdirTasksMap.has(parentRemotePath) ||
			knownRemotePaths.has(parentRemotePath) ||
			this.hasMkdirTaskForPath(tasks, parentRemotePath) ||
			snapshotIndex.knownRemoteDirPaths.has(parentRemotePath);

		if (parentAlreadyHandled) return;

		const parentSnapshot = this.findPlannedSnapshot(
			snapshotIndex,
			parentLocalPath,
			parentRemotePath,
		);

		const parentMkdirOptions = {
			vault: this.vault,
			webdav: this.webdav,
			remoteBaseDir: this.remoteBaseDir,
			remotePath: parentRemotePath,
			localPath: parentLocalPath,
			syncRecord,
		} as MkdirRemoteTask['options'] & {
			local?: PlannedPathSnapshot['local'];
			remote?: PlannedPathSnapshot['remote'];
		};
		parentMkdirOptions.local = parentSnapshot?.local;
		parentMkdirOptions.remote = parentSnapshot?.remote;

		mkdirTasksMap.set(parentRemotePath, new MkdirRemoteTask(parentMkdirOptions));
		this.markRemotePathAndParentsAsExisting(knownRemotePaths, parentRemotePath);
	}

	private buildReuploadSnapshotIndex(tasks: BaseTask[]): ReuploadSnapshotIndex {
		const byLocalPath = new Map<string, PlannedPathSnapshot[]>();
		const byRemotePath = new Map<string, PlannedPathSnapshot[]>();
		const knownRemoteDirPaths = new Set<string>();
		const localPaths = new Set<string>();
		const remotePaths = new Set<string>();

		for (const task of tasks) {
			const plannedSnapshots = this.getTaskPlannedPathSnapshots(task);
			for (const snapshot of plannedSnapshots) {
				if (snapshot.localPath) {
					localPaths.add(snapshot.localPath);
					const localItems = byLocalPath.get(snapshot.localPath) ?? [];
					localItems.push(snapshot);
					byLocalPath.set(snapshot.localPath, localItems);
				}

				if (snapshot.remotePath) {
					remotePaths.add(snapshot.remotePath);
					const remoteItems = byRemotePath.get(snapshot.remotePath) ?? [];
					remoteItems.push(snapshot);
					byRemotePath.set(snapshot.remotePath, remoteItems);

					if (snapshot.remote?.stat.isDir) {
						this.markRemotePathAndParentsAsExisting(
							knownRemoteDirPaths,
							snapshot.remotePath,
						);
					} else if (snapshot.remote?.stat) {
						const parentRemotePath = remoteDirname(snapshot.remotePath);
						this.markRemotePathAndParentsAsExisting(
							knownRemoteDirPaths,
							parentRemotePath,
						);
					}
				}
			}
		}

		return {
			byLocalPath,
			byRemotePath,
			knownRemoteDirPaths,
			localPaths,
			remotePaths,
		};
	}

	private getTaskPlannedPathSnapshots(task: BaseTask): PlannedPathSnapshot[] {
		const options = task.options as BaseTask['options'] & {
			local?: PlannedPathSnapshot['local'];
			remote?: PlannedPathSnapshot['remote'];
			additionalPaths?: PlannedPathSnapshot[];
		};
		const plannedPaths: PlannedPathSnapshot[] = [
			{
				localPath: task.localPath,
				remotePath: task.remotePath,
				local: options.local,
				remote: options.remote,
			},
		];

		if (Array.isArray(options.additionalPaths)) plannedPaths.push(...options.additionalPaths);

		return plannedPaths;
	}

	private findPlannedSnapshot(
		snapshotIndex: ReuploadSnapshotIndex,
		localPath: string,
		remotePath: string,
	): PlannedPathSnapshot | undefined {
		const localMatches = snapshotIndex.byLocalPath.get(localPath) ?? [];
		const exactLocal = localMatches.find((snapshot) => snapshot.remotePath === remotePath);
		if (exactLocal) {
			return exactLocal;
		}

		const remoteMatches = snapshotIndex.byRemotePath.get(remotePath) ?? [];
		const exactRemote = remoteMatches.find((snapshot) => snapshot.localPath === localPath);
		if (exactRemote) return exactRemote;

		return localMatches[0] ?? remoteMatches[0];
	}

	private isReuploadDirectoryPath(
		localPath: string,
		remotePath: string,
		plannedSnapshot: PlannedPathSnapshot | undefined,
		snapshotIndex: ReuploadSnapshotIndex,
	): boolean {
		if (plannedSnapshot?.local?.stat) return plannedSnapshot.local.stat.isDir;
		if (plannedSnapshot?.remote?.stat) return plannedSnapshot.remote.stat.isDir;

		for (const candidateLocalPath of snapshotIndex.localPaths) {
			if (candidateLocalPath.startsWith(localPath + '/')) return true;
		}
		for (const candidateRemotePath of snapshotIndex.remotePaths) {
			if (candidateRemotePath.startsWith(remotePath + '/')) return true;
		}

		return true;
	}

	private hasMkdirTaskForPath(tasks: BaseTask[], remotePath: string): boolean {
		return tasks.some(
			(task) => task instanceof MkdirRemoteTask && task.remotePath === remotePath,
		);
	}

	private markRemotePathAndParentsAsExisting(
		knownRemotePaths: Set<string>,
		remotePath: string,
	): void {
		let currentPath = remotePath;

		while (currentPath && currentPath !== '.' && currentPath !== '' && currentPath !== '/') {
			if (knownRemotePaths.has(currentPath)) return;
			knownRemotePaths.add(currentPath);
			currentPath = remoteDirname(currentPath);
		}
	}

	private filterDeleteTasks(
		tasksToDelete: RemoveLocalTask[],
		tasksToReupload: RemoveLocalTask[],
	): Set<RemoveLocalTask> {
		const deleteTaskMap = new Map(tasksToDelete.map((task) => [task.localPath, task]));

		for (const reuploadTask of tasksToReupload) {
			let currentPath = reuploadTask.localPath;

			while (currentPath && currentPath !== '.' && currentPath !== '') {
				currentPath = vaultDirname(currentPath);
				if (currentPath === '.' || currentPath === '') break;

				const deleteTask = deleteTaskMap.get(currentPath);
				if (deleteTask) deleteTaskMap.delete(currentPath);
			}
		}

		return new Set(deleteTaskMap.values());
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
					await breakableSleep(onCancelSync(), 5000);
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
			tasks.map((task) => this.executeWithRetry(task)),
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

			// Only add substantial tasks to completed list for progress display
			if (this.isDisplayableTask(task)) {
				allCompletedTasks.push(task);
				currentRun = updateSyncRunSnapshot(currentRun, {
					progressSummary: this.createProgressSummary(
						totalDisplayableTasks,
						allCompletedTasks,
					),
				});
				emitSyncRun(currentRun);
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
			completed: [...allCompletedTasks],
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
					error: new TaskError(i18n.t('sync.cancelled'), task),
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
				await breakableSleep(onCancelSync(), 5000);
				if (this.isCancelled) {
					return {
						success: false,
						error: new TaskError(i18n.t('sync.cancelled'), task),
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
				await breakableSleep(onCancelSync(), 5000);
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
