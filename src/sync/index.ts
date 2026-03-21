import type { WebDAVClient } from 'webdav';
import { chunk } from 'lodash-es';
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
import { ResumableWebDAVTraversal } from '~/utils/traverse-webdav';
import type { PlannedPathSnapshot } from './decision/sync-decision.interface';
import WebDAVSyncPlugin from '..';
import TwoWaySyncDecider from './decision/two-way.decider';
import {
	isSyncCancelledError,
	SyncCancelledError,
	SyncRetryExhaustedError,
	toError,
} from './errors';
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

interface ReuploadSnapshotIndex {
	byLocalPath: Map<string, PlannedPathSnapshot[]>;
	byRemotePath: Map<string, PlannedPathSnapshot[]>;
	knownRemoteDirPaths: Set<string>;
	localPaths: Set<string>;
	remotePaths: Set<string>;
}

// TODO: split into multiple modules
export class SyncEngine {
	remoteFs: RemoteWebDAVFileSystem;
	localFS: LocalVaultFileSystem;
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
		this.localFS = new LocalVaultFileSystem(this.options);
		this.subscriptions.push(
			onCancelSync().subscribe(() => {
				this.isCancelled = true;
			}),
		);
	}

	runKind: SyncRunKind = SyncRunKind.NORMAL;

	async preparePlan(
		runKind: SyncRunKind = SyncRunKind.NORMAL,
		options?: {
			onPlanningProgress?: (progress: SyncPlanningProgress) => Promise<void> | void;
		},
	): Promise<PreparedSyncPlan> {
		this.runKind = runKind;
		const syncRecord = this.createSyncRecord();
		await this.ensureRemoteBaseDirReady(syncRecord);
		this.throwIfCancelled();

		const tasks = await new TwoWaySyncDecider(this, syncRecord).decide({
			onPlanningProgress: options?.onPlanningProgress,
		});
		this.throwIfCancelled();

		if (runKind === SyncRunKind.NORMAL) {
			const remoteRecord = await syncRecord.getRemoteRecord();
			await syncRecord.setRemoteRecord({
				...remoteRecord,
				lastNormalSyncAt: Date.now(),
				source: 'normal-sync',
			});
			this.throwIfCancelled();
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

			const noopTasks = tasks.filter((task) => task instanceof NoopTask);
			const skippedTasks = tasks.filter((task) => task instanceof SkippedTask);
			let confirmedTasks = tasks.filter((task) => this.isActionableTask(task));

			const firstTaskIdxNeedingConfirmation = confirmedTasks.findIndex(
				(t) => !(t instanceof CleanRecordTask),
			);

			if (this.isCancelled) {
				currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
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
					currentRun = finalizeSyncRun(currentRun, { stage: 'cancelled' });
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

				if (this.isCancelled) break;
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
			warnings: [],
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

			if (deleteTaskSet.has(task)) deleteTasks.push(task);
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
		const snapshotIndex = this.buildReuploadSnapshotIndex([
			...originalTasks,
			...confirmedTasks,
			...tasksToReupload,
		]);
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
				confirmedTasks,
				knownRemotePaths,
				localPath: task.localPath,
				mkdirTasksMap,
				originalTasks,
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
		confirmedTasks,
		knownRemotePaths,
		localPath,
		mkdirTasksMap,
		originalTasks,
		remotePath,
		snapshotIndex,
		syncRecord,
	}: {
		confirmedTasks: BaseTask[];
		knownRemotePaths: Set<string>;
		localPath: string;
		mkdirTasksMap: Map<string, MkdirRemoteTask>;
		originalTasks: BaseTask[];
		remotePath: string;
		snapshotIndex: ReuploadSnapshotIndex;
		syncRecord: SyncRecord;
	}): void {
		const parentLocalPath = vaultDirname(localPath);
		const parentRemotePath = normalizeRemoteDir(remoteDirname(remotePath));

		if (parentLocalPath === '.' || parentLocalPath === '') return;

		const parentAlreadyHandled =
			mkdirTasksMap.has(parentRemotePath) ||
			knownRemotePaths.has(parentRemotePath) ||
			this.hasMkdirTaskForPath(originalTasks, parentRemotePath) ||
			this.hasMkdirTaskForPath(confirmedTasks, parentRemotePath) ||
			snapshotIndex.knownRemoteDirPaths.has(parentRemotePath);

		if (parentAlreadyHandled) {
			return;
		}

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
						const parentRemotePath = normalizeRemoteDir(
							remoteDirname(snapshot.remotePath),
						);
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
				if (currentPath === '.' || currentPath === '') break;

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

		if (!remoteBaseDirExists) await syncRecord.drop();

		while (!remoteBaseDirExists) {
			this.throwIfCancelled();

			try {
				await webdav.createDirectory(this.options.remoteBaseDir, {
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
			if (this.isCancelled) break;

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

	private throwIfCancelled(): void {
		if (!this.isCancelled) return;
		logger.warn('WebDAV operation cancelled', undefined, {
			category: 'sync.retry',
		});
		throw new SyncCancelledError();
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
