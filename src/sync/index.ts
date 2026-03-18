import type { WebDAVClient } from 'webdav';
import { chunk } from 'lodash-es';
import { Platform, Vault } from 'obsidian';
import { Subscription } from 'rxjs';
import type { SyncExecutionRequest } from '~/services/sync-executor.service';
import DeleteConfirmModal from '~/components/DeleteConfirmModal';
import TaskListConfirmModal from '~/components/TaskListConfirmModal';
import {
	emitSyncRun,
	onCancelSync,
	type SyncFailedTaskInfo,
	type SyncPlanSummary,
	type SyncProgressSummary,
	type SyncRunSnapshot,
	type SyncRunWarning,
	updateSyncRunSnapshot,
} from '~/events';
import IFileSystem from '~/fs/fs.interface';
import { LocalVaultFileSystem } from '~/fs/local-vault';
import { RemoteWebDAVFileSystem } from '~/fs/webdav';
import i18n from '~/i18n';
import { SyncRunKind } from '~/model/sync-record.model';
import { normalizeRemoteDir, remoteDirname } from '~/platform/path/remote-path';
import { vaultDirname } from '~/platform/path/vault-path';
import { useSettings } from '~/settings';
import { SyncRecord } from '~/storage';
import breakableSleep from '~/utils/breakable-sleep';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import getTaskName from '~/utils/get-task-name';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-vault-item';
import { ResumableWebDAVTraversal } from '~/utils/traverse-webdav';
import WebDAVSyncPlugin from '..';
import TwoWaySyncDecider from './decision/two-way.decider';
import CleanRecordTask from './tasks/clean-record.task';
import MkdirRemoteTask from './tasks/mkdir-remote.task';
import NoopTask from './tasks/noop.task';
import PushTask from './tasks/push.task';
import RemoveLocalTask from './tasks/remove-local.task';
import RemoveRemoteTask from './tasks/remove-remote.task';
import SkippedTask from './tasks/skipped.task';
import { BaseTask, TaskError, type TaskResult } from './tasks/task.interface';
import { mergeMkdirTasks } from './utils/merge-mkdir-tasks';
import { mergeRemoveRemoteTasks } from './utils/merge-remove-remote-tasks';
import { updateMtimeInRecord as updateMtimeInRecordUtil } from './utils/update-records';

export enum SyncStartMode {
	MANUAL_SYNC = 'manual_sync',
	AUTO_SYNC = 'auto_sync',
}

export interface PreparedSyncPlan {
	readonly tasks: BaseTask[];
	readonly hasActionableTasks: boolean;
}

interface SyncResultSummary {
	totalTasks: number;
	succeededTasks: number;
	failedTasks: number;
	failed: SyncFailedTaskInfo[];
}

// TODO: split into multiple modules
export class SyncEngine {
	remoteFs: IFileSystem;
	localFS: IFileSystem;
	isCancelled: boolean = false;

	private subscriptions: Subscription[] = [];

	constructor(
		private plugin: WebDAVSyncPlugin,
		private options: {
			vault: Vault;
			token: string;
			remoteServerUrl?: string;
			remoteBaseDir: string;
			webdav: WebDAVClient;
			syncStateStore: WebDAVSyncPlugin['syncStateStore'];
		},
	) {
		this.options = Object.freeze(this.options);
		this.remoteFs = new RemoteWebDAVFileSystem(this.options);
		this.localFS = new LocalVaultFileSystem({
			vault: this.options.vault,
			syncRecord: this.createSyncRecord(),
		});
		this.subscriptions.push(
			onCancelSync().subscribe(() => {
				this.isCancelled = true;
			}),
		);
	}

	runKind: SyncRunKind = SyncRunKind.NORMAL;

	async preparePlan(runKind: SyncRunKind = SyncRunKind.NORMAL): Promise<PreparedSyncPlan> {
		this.runKind = runKind;
		const syncRecord = this.createSyncRecord();
		await this.ensureRemoteBaseDirReady(syncRecord);

		if (this.isCancelled) {
			return {
				tasks: [],
				hasActionableTasks: false,
			};
		}

		const tasks = await new TwoWaySyncDecider(this, syncRecord).decide();

		if (runKind === SyncRunKind.NORMAL) {
			const remoteRecord = await syncRecord.getRemoteRecord();
			await syncRecord.setRemoteRecord({
				...remoteRecord,
				lastNormalSyncAt: Date.now(),
				source: 'normal-sync',
			});
		}

		const hasActionableTasks = tasks.some((task) => this.isActionableTask(task));

		return Object.freeze({
			tasks,
			hasActionableTasks,
		});
	}

	async start({
		request,
		plan,
		run,
	}: {
		request: SyncExecutionRequest;
		plan?: PreparedSyncPlan;
		run: SyncRunSnapshot;
	}): Promise<SyncRunSnapshot> {
		try {
			this.runKind = request.runKind;

			const settings = this.settings;
			const syncRecord = this.createSyncRecord();
			const preparedPlan = plan ?? (await this.preparePlan(request.runKind));
			const tasks = preparedPlan.tasks;
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
				currentRun = updateSyncRunSnapshot(currentRun, {
					stage: 'completed_noop',
					resultSummary: {
						totalTasks: 0,
						succeededTasks: 0,
						failedTasks: 0,
						failed: [],
					},
					timestamps: {
						endedAt: Date.now(),
					},
				});
				emitSyncRun(currentRun);
				return currentRun;
			}

			const noopTasks = tasks.filter((task) => task instanceof NoopTask);
			const skippedTasks = tasks.filter((task) => task instanceof SkippedTask);
			let confirmedTasks = tasks.filter((task) => this.isActionableTask(task));

			const firstTaskIdxNeedingConfirmation = confirmedTasks.findIndex(
				(t) => !(t instanceof CleanRecordTask),
			);

			if (this.isCancelled) {
				currentRun = this.emitTerminalRun(currentRun, 'cancelled');
				return currentRun;
			}

			if (
				request.mode === SyncStartMode.MANUAL_SYNC &&
				settings.confirmBeforeSync &&
				firstTaskIdxNeedingConfirmation > -1
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
				const confirmExec = await new TaskListConfirmModal(this.app, confirmedTasks).open();
				if (confirmExec.confirm) confirmedTasks = confirmExec.tasks;
				else {
					currentRun = this.emitTerminalRun(currentRun, 'cancelled');
					return currentRun;
				}
			}

			// Check for RemoveLocalTask during auto-sync and ask for confirmation
			if (
				request.mode === SyncStartMode.AUTO_SYNC &&
				settings.confirmBeforeDeleteInAutoSync
			) {
				const removeLocalTasks = confirmedTasks.filter(
					(t) => t instanceof RemoveLocalTask,
				) as RemoveLocalTask[];
				if (removeLocalTasks.length > 0) {
					currentRun = updateSyncRunSnapshot(currentRun, {
						stage: 'awaiting_confirmation',
						planSummary: {
							...this.summarizePlan(tasks),
							requiresDeleteConfirmation: true,
							warnings: [
								...this.getPlanWarnings(tasks),
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
					).open();

					confirmedTasks = await this.rebuildConfirmedTasksAfterDeleteConfirmation({
						confirmedTasks,
						originalTasks: tasks,
						tasksToDelete,
						tasksToReupload,
						syncRecord,
					});
				}
			}

			const confirmedTasksUniq = Array.from(
				new Set([...confirmedTasks, ...noopTasks, ...skippedTasks]),
			);

			// Merge mkdir tasks with parent-child relationships to reduce API calls
			const mkdirTasks = confirmedTasksUniq.filter((t) => t instanceof MkdirRemoteTask);
			const removeRemoteTasks = confirmedTasksUniq.filter(
				(t) => t instanceof RemoveRemoteTask,
			);
			const otherTasks = confirmedTasksUniq.filter(
				(t) => !(t instanceof MkdirRemoteTask || t instanceof RemoveRemoteTask),
			);
			const mergedMkdirTasks = mergeMkdirTasks(mkdirTasks);
			const mergedRemoveRemoteTasks = mergeRemoveRemoteTasks(removeRemoteTasks);
			const optimizedTasks = [...mergedRemoveRemoteTasks, ...mergedMkdirTasks, ...otherTasks];

			const chunkSize = 200;
			const taskChunks = chunk(optimizedTasks, chunkSize);
			const allTasksResult: TaskResult[] = [];

			const totalDisplayableTasks = optimizedTasks.filter((task) =>
				this.isDisplayableTask(task),
			);

			// Track all completed tasks across all chunks
			const allCompletedTasks: BaseTask[] = [];
			currentRun = updateSyncRunSnapshot(currentRun, {
				stage: 'executing',
				planSummary: this.summarizePlan(tasks, optimizedTasks),
				progressSummary: this.createProgressSummary(
					totalDisplayableTasks,
					allCompletedTasks,
				),
				timestamps: {
					executionStartedAt: Date.now(),
				},
			});
			emitSyncRun(currentRun);

			for (const taskChunk of taskChunks) {
				const chunkExecution = await this.execTasks(
					currentRun,
					taskChunk,
					totalDisplayableTasks,
					allCompletedTasks,
				);
				currentRun = chunkExecution.run;
				allTasksResult.push(...chunkExecution.results);
				await this.updateMtimeInRecord(taskChunk, chunkExecution.results);

				if (this.isCancelled) break;
			}

			const resultSummary = this.createResultSummary(allTasksResult);
			const failedCount = resultSummary.failedTasks;
			currentRun = updateSyncRunSnapshot(currentRun, {
				stage: this.isCancelled ? 'cancelled' : failedCount > 0 ? 'failed' : 'completed',
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
				timestamps: {
					endedAt: Date.now(),
				},
			});
			emitSyncRun(currentRun);
			this.logTerminalRun(currentRun);
			return currentRun;
		} catch (error) {
			const failedRun = this.emitTerminalRun(run, 'failed', error);
			return failedRun;
		} finally {
			this.subscriptions.forEach((sub) => sub.unsubscribe());
		}
	}

	summarizePlan(tasks: BaseTask[], executableTasks: BaseTask[] = tasks): SyncPlanSummary {
		const noopTasks = tasks.filter((task) => task instanceof NoopTask).length;
		const skippedTasks = tasks.filter((task) => task instanceof SkippedTask).length;
		const actionableTasks = executableTasks.filter(
			(task) => !(task instanceof NoopTask || task instanceof SkippedTask),
		).length;

		return {
			totalTasks: tasks.length,
			actionableTasks,
			noopTasks,
			skippedTasks,
			hasActionableTasks: actionableTasks > 0,
			requiresConfirmation: false,
			requiresDeleteConfirmation: false,
			warnings: this.getPlanWarnings(executableTasks),
		};
	}

	private isActionableTask(task: BaseTask): boolean {
		return !(task instanceof NoopTask || task instanceof SkippedTask);
	}

	private isDisplayableTask(task: BaseTask): boolean {
		return !(task instanceof NoopTask || task instanceof CleanRecordTask);
	}

	private createSyncRecord() {
		return new SyncRecord(this.getStateKey(), this.remoteBaseDir, this.plugin.syncStateStore);
	}

	private async createTraversal() {
		const settings = await useSettings();
		return new ResumableWebDAVTraversal({
			remoteServerUrl: this.options.remoteServerUrl || this.settings.serverUrl,
			token: this.options.token,
			remoteBaseDir: this.options.remoteBaseDir,
			stateKey: getSyncStateKey({
				vaultName: this.vault.getName(),
				remoteBaseDir: this.remoteBaseDir,
				serverUrl: this.options.remoteServerUrl || settings.serverUrl,
				account: settings.account,
			}),
			syncStateStore: this.plugin.syncStateStore,
			saveInterval: 1,
		});
	}

	private async clearStoredRemoteSnapshot() {
		const traversal = await this.createTraversal();
		await traversal.clearStoredSnapshot();
	}

	private async rebuildConfirmedTasksAfterDeleteConfirmation({
		confirmedTasks,
		originalTasks,
		tasksToDelete,
		tasksToReupload,
		syncRecord,
	}: {
		confirmedTasks: BaseTask[];
		originalTasks: BaseTask[];
		tasksToDelete: RemoveLocalTask[];
		tasksToReupload: RemoveLocalTask[];
		syncRecord: SyncRecord;
	}): Promise<BaseTask[]> {
		const { mkdirTasks, pushTasks } = await this.buildReuploadTasks({
			confirmedTasks,
			originalTasks,
			tasksToReupload,
			syncRecord,
		});
		const deleteTaskSet = this.filterDeleteTasks(tasksToDelete, tasksToReupload);
		const otherTasks: BaseTask[] = [];
		const deleteTasks: RemoveLocalTask[] = [];

		for (const task of confirmedTasks) {
			if (!(task instanceof RemoveLocalTask)) {
				otherTasks.push(task);
				continue;
			}

			if (deleteTaskSet.has(task)) {
				deleteTasks.push(task);
			}
		}

		return [...mkdirTasks, ...otherTasks, ...pushTasks, ...deleteTasks];
	}

	private async buildReuploadTasks({
		confirmedTasks,
		originalTasks,
		tasksToReupload,
		syncRecord,
	}: {
		confirmedTasks: BaseTask[];
		originalTasks: BaseTask[];
		tasksToReupload: RemoveLocalTask[];
		syncRecord: SyncRecord;
	}): Promise<{
		mkdirTasks: MkdirRemoteTask[];
		pushTasks: PushTask[];
	}> {
		const mkdirTasksMap = new Map<string, MkdirRemoteTask>();
		const pushTasks: PushTask[] = [];
		const knownRemotePaths = new Set<string>();

		for (const task of tasksToReupload) {
			const stat = await statVaultItem(this.vault, task.localPath);
			if (!stat) {
				continue;
			}

			await this.ensureReuploadParentDir({
				confirmedTasks,
				knownRemotePaths,
				localPath: task.localPath,
				mkdirTasksMap,
				originalTasks,
				remotePath: task.remotePath,
				syncRecord,
			});

			if (stat.isDir) {
				mkdirTasksMap.set(task.remotePath, new MkdirRemoteTask(task.options));
				continue;
			}

			pushTasks.push(new PushTask(task.options));
		}

		return {
			mkdirTasks: Array.from(mkdirTasksMap.values()),
			pushTasks,
		};
	}

	private async ensureReuploadParentDir({
		confirmedTasks,
		knownRemotePaths,
		localPath,
		mkdirTasksMap,
		originalTasks,
		remotePath,
		syncRecord,
	}: {
		confirmedTasks: BaseTask[];
		knownRemotePaths: Set<string>;
		localPath: string;
		mkdirTasksMap: Map<string, MkdirRemoteTask>;
		originalTasks: BaseTask[];
		remotePath: string;
		syncRecord: SyncRecord;
	}): Promise<void> {
		const parentLocalPath = vaultDirname(localPath);
		const parentRemotePath = normalizeRemoteDir(remoteDirname(remotePath));

		if (parentLocalPath === '.' || parentLocalPath === '') {
			return;
		}

		const parentAlreadyHandled =
			mkdirTasksMap.has(parentRemotePath) ||
			knownRemotePaths.has(parentRemotePath) ||
			this.hasMkdirTaskForPath(originalTasks, parentRemotePath) ||
			this.hasMkdirTaskForPath(confirmedTasks, parentRemotePath);

		if (parentAlreadyHandled) {
			return;
		}

		try {
			await this.webdav.stat(parentRemotePath);
			this.markRemotePathAndParentsAsExisting(knownRemotePaths, parentRemotePath);
		} catch {
			mkdirTasksMap.set(
				parentRemotePath,
				new MkdirRemoteTask({
					vault: this.vault,
					webdav: this.webdav,
					remoteBaseDir: this.remoteBaseDir,
					remotePath: parentRemotePath,
					localPath: parentLocalPath,
					syncRecord,
				}),
			);
		}
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
			if (knownRemotePaths.has(currentPath)) {
				return;
			}

			knownRemotePaths.add(currentPath);
			currentPath = normalizeRemoteDir(remoteDirname(currentPath));
		}
	}

	private filterDeleteTasks(
		tasksToDelete: RemoveLocalTask[],
		tasksToReupload: RemoveLocalTask[],
	): Set<RemoveLocalTask> {
		const deleteTaskSet = new Set(tasksToDelete);

		for (const reuploadTask of tasksToReupload) {
			let currentPath = reuploadTask.localPath;

			while (currentPath && currentPath !== '.' && currentPath !== '') {
				currentPath = vaultDirname(currentPath);
				if (currentPath === '.' || currentPath === '') {
					break;
				}

				for (const deleteTask of deleteTaskSet) {
					if (deleteTask.localPath === currentPath) {
						deleteTaskSet.delete(deleteTask);
						break;
					}
				}
			}
		}

		return deleteTaskSet;
	}

	private async ensureRemoteBaseDirReady(syncRecord: SyncRecord) {
		const webdav = this.webdav;
		const remoteBaseDir = normalizeRemoteDir(this.options.remoteBaseDir);

		let remoteBaseDirExists = await this.retryWebDAVCall(() => webdav.exists(remoteBaseDir));

		if (!remoteBaseDirExists)
			await Promise.all([syncRecord.drop(), this.clearStoredRemoteSnapshot()]);

		while (!remoteBaseDirExists) {
			if (this.isCancelled) return;

			try {
				await webdav.createDirectory(this.options.remoteBaseDir, {
					recursive: true,
				});
				remoteBaseDirExists = true;
				continue;
			} catch (error) {
				if (isRetryableError(error)) {
					await breakableSleep(onCancelSync(), 5000);
					if (this.isCancelled) return;
					remoteBaseDirExists = await this.retryWebDAVCall(() =>
						webdav.exists(remoteBaseDir),
					);
					continue;
				}

				throw error;
			}
		}
	}

	private async execTasks(
		run: SyncRunSnapshot,
		tasks: BaseTask[],
		totalDisplayableTasks: BaseTask[],
		allCompletedTasks: BaseTask[],
	) {
		let currentRun = run;
		const res: TaskResult[] = [];
		const tasksToDisplay = tasks.filter((task) => this.isDisplayableTask(task));

		for (let i = 0; i < tasks.length; ++i) {
			const task = tasks[i];
			if (this.isCancelled) {
				break;
			}

			const taskResult = await this.executeWithRetry(task);
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

			res[i] = taskResult;
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

		return {
			run: currentRun,
			results: res,
		};
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

	private getPlanWarnings(tasks: BaseTask[]): SyncRunWarning[] {
		const warnings: SyncRunWarning[] = [];
		if (tasks.length > 500 && Platform.isDesktopApp) {
			warnings.push({
				code: 'large_task_count',
				messageKey: 'sync.suggestUseClientForManyTasks',
			});
		}
		return warnings;
	}

	private emitTerminalRun(
		run: SyncRunSnapshot,
		stage: 'cancelled' | 'failed',
		error?: unknown,
	): SyncRunSnapshot {
		const normalizedError = error instanceof Error ? error : undefined;
		const nextRun = updateSyncRunSnapshot(run, {
			stage,
			errorSummary: normalizedError
				? {
						message: normalizedError.message,
						name: normalizedError.name,
					}
				: undefined,
			timestamps: {
				endedAt: Date.now(),
			},
		});
		emitSyncRun(nextRun);
		this.logTerminalRun(nextRun, normalizedError);
		return nextRun;
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

	async updateMtimeInRecord(tasks: BaseTask[], results: TaskResult[]) {
		return updateMtimeInRecordUtil(this.vault, tasks, results, 10);
	}

	private async retryWebDAVCall<T>(operation: () => Promise<T>) {
		let retryCount = 0;
		while (true) {
			if (this.isCancelled || retryCount >= 3) {
				if (this.isCancelled) {
					logger.warn('WebDAV operation cancelled', undefined, {
						category: 'sync.retry',
					});
				} else {
					logger.error(
						'WebDAV connection failed after retries',
						{ retryCount },
						{ category: 'sync.retry' },
					);
				}
				throw new Error('Sync Aborted');
			}

			try {
				return await operation();
			} catch (error) {
				if (!isRetryableError(error)) {
					logger.error('WebDAV operation failed', { error }, { category: 'sync.retry' });
					break;
				}

				retryCount++;
				logger.warn(
					'Retrying WebDAV operation after transient error',
					{ retryCount, error },
					{ category: 'sync.retry' },
				);
				await breakableSleep(onCancelSync(), 5000);
			}
		}
	}

	private logTerminalRun(run: SyncRunSnapshot, error?: Error) {
		const metadata = {
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
			error,
		};

		if (run.stage === 'failed') {
			logger.error('Sync failed', metadata, { category: 'sync.lifecycle' });
			return;
		}

		if (run.stage === 'cancelled') {
			logger.warn('Sync cancelled', metadata, { category: 'sync.lifecycle' });
			return;
		}

		if (run.stage === 'completed_noop') {
			logger.info('Sync completed with no changes', metadata, { category: 'sync.lifecycle' });
			return;
		}

		logger.info('Sync completed', metadata, { category: 'sync.lifecycle' });
	}

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
		return this.options.remoteBaseDir;
	}

	get settings() {
		return this.plugin.settings;
	}

	private getStateKey() {
		return getSyncStateKey({
			vaultName: this.vault.getName(),
			remoteBaseDir: this.remoteBaseDir,
			serverUrl: this.options.remoteServerUrl || this.settings.serverUrl,
			account: this.settings.account,
		});
	}
}
