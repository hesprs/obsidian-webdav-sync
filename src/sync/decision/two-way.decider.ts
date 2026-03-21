import type { SyncPlanningProgress } from '~/events';
import type { BinaryLike } from '~/platform/binary';
import type { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/model/sync-record.model';
import { joinRemotePath } from '~/platform/path/remote-path';
import type { SyncEngine } from '..';
import type {
	CleanRecordTaskOptions,
	ConflictTaskOptions,
	FilenameErrorTaskOptions,
	MkdirLocalTaskOptions,
	MkdirRemoteTaskOptions,
	PlannedLocalSnapshot,
	PlannedRemoteSnapshot,
	PullTaskOptions,
	PushTaskOptions,
	RemoveLocalTaskOptions,
	RemoveRemoteTaskOptions,
	SkippedTaskOptions,
	SyncDecisionInput,
	TaskFactory,
	TaskOptions,
} from './sync-decision.interface';
import CleanRecordTask from '../tasks/clean-record.task';
import ConflictResolveTask from '../tasks/conflict-resolve.task';
import FilenameErrorTask from '../tasks/filename-error.task';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import NoopTask from '../tasks/noop.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import SkippedTask from '../tasks/skipped.task';
import { BaseTask } from '../tasks/task.interface';
import { twoWayDecider } from './two-way.decider.function';

export default class TwoWaySyncDecider {
	constructor(
		protected sync: SyncEngine,
		protected syncRecordStorage: SyncRecord,
	) {}

	protected getSyncRecordStorage() {
		return this.syncRecordStorage;
	}

	get webdav() {
		return this.sync.webdav;
	}

	get settings() {
		return this.sync.settings;
	}

	get vault() {
		return this.sync.vault;
	}

	get remoteBaseDir() {
		return this.sync.remoteBaseDir;
	}

	async decide(options?: {
		onPlanningProgress?: (progress: SyncPlanningProgress) => Promise<void> | void;
	}): Promise<BaseTask[]> {
		const syncRecordStorage = this.getSyncRecordStorage();
		const reportPlanningProgress = async (progress: SyncPlanningProgress) => {
			await options?.onPlanningProgress?.(progress);
		};

		await reportPlanningProgress({
			subStage: 'loading_records',
			totalWorkUnits: 3,
			completedWorkUnits: 0,
			currentItem: this.remoteBaseDir,
		});

		const previousLocalRecords = await syncRecordStorage.getLocalRecords();
		await reportPlanningProgress({
			subStage: 'loading_records',
			totalWorkUnits: 3,
			completedWorkUnits: 1,
			currentItem: this.remoteBaseDir,
		});

		const previousRemoteRecord = await syncRecordStorage.getRemoteRecord();
		await reportPlanningProgress({
			subStage: 'loading_records',
			totalWorkUnits: 3,
			completedWorkUnits: 2,
			currentItem: this.remoteBaseDir,
		});

		const previousRemoteStats = previousRemoteRecord
			? await this.sync.remoteFs.walk({ remoteSource: 'stored-record' })
			: [];
		await reportPlanningProgress({
			subStage: 'loading_records',
			totalWorkUnits: 3,
			completedWorkUnits: 3,
			currentItem: this.remoteBaseDir,
		});

		await reportPlanningProgress({
			subStage: 'walking_local',
			totalWorkUnits: 1,
			completedWorkUnits: 0,
			currentItem: this.vault.getRoot().path,
		});
		const currentLocalStats = await this.sync.localFS.walk();
		await reportPlanningProgress({
			subStage: 'walking_local',
			totalWorkUnits: 1,
			completedWorkUnits: 1,
			currentItem: this.vault.getRoot().path,
		});

		await reportPlanningProgress({
			subStage: 'walking_remote',
			totalWorkUnits: this.sync.runKind === SyncRunKind.NUMB ? 1 : 0,
			completedWorkUnits: 0,
			currentItem: this.remoteBaseDir,
		});
		const currentRemoteStats =
			this.sync.runKind === SyncRunKind.NUMB
				? previousRemoteStats
				: await this.sync.remoteFs.walk({
						freshness: 'fresh',
						onTraversalProgress: async (progress) => {
							await reportPlanningProgress({
								subStage: 'walking_remote',
								totalWorkUnits: progress.totalDirectories,
								completedWorkUnits: progress.processedDirectories,
								currentItem: progress.currentDirectory ?? this.remoteBaseDir,
							});
						},
					});

		if (this.sync.runKind === SyncRunKind.NUMB) {
			await reportPlanningProgress({
				subStage: 'walking_remote',
				totalWorkUnits: 1,
				completedWorkUnits: 1,
				currentItem: this.remoteBaseDir,
			});
		}

		// 创建共用的task选项
		const commonTaskOptions = {
			webdav: this.webdav,
			vault: this.vault,
			remoteBaseDir: this.remoteBaseDir,
			syncRecord: syncRecordStorage,
		};

		// 创建Task工厂
		const taskFactory: TaskFactory = {
			createPullTask: (options: PullTaskOptions) =>
				new PullTask({
					...commonTaskOptions,
					...options,
					remoteSize:
						options.remoteSize ??
						(options.remote?.stat && !options.remote.stat.isDir
							? options.remote.stat.size
							: 0),
				}),
			createPushTask: (options: PushTaskOptions) =>
				new PushTask({ ...commonTaskOptions, ...options }),
			createConflictResolveTask: (options: ConflictTaskOptions) =>
				new ConflictResolveTask({ ...commonTaskOptions, ...options }),
			createNoopTask: (options: TaskOptions) =>
				new NoopTask({ ...commonTaskOptions, ...options }),
			createRemoveLocalTask: (options: RemoveLocalTaskOptions) =>
				new RemoveLocalTask({ ...commonTaskOptions, ...options }),
			createRemoveRemoteTask: (options: RemoveRemoteTaskOptions) =>
				new RemoveRemoteTask({ ...commonTaskOptions, ...options }),
			createMkdirLocalTask: (options: MkdirLocalTaskOptions) =>
				new MkdirLocalTask({ ...commonTaskOptions, ...options }),
			createMkdirRemoteTask: (options: MkdirRemoteTaskOptions) =>
				new MkdirRemoteTask({ ...commonTaskOptions, ...options }),
			createCleanRecordTask: (options: CleanRecordTaskOptions) =>
				new CleanRecordTask({ ...commonTaskOptions, ...options }),
			createFilenameErrorTask: (options: FilenameErrorTaskOptions) =>
				new FilenameErrorTask({ ...commonTaskOptions, ...options }),
			createSkippedTask: (options: SkippedTaskOptions) =>
				new SkippedTask({ ...commonTaskOptions, ...options }),
		};

		const compareFileContent = async (filePath: string, baseText: string): Promise<boolean> => {
			const file = this.vault.getFileByPath(filePath);
			if (!file) return false;
			const currentContent = await this.vault.read(file);
			return currentContent === baseText;
		};

		const plannedLocalFileSnapshots = new Map<
			string,
			Promise<PlannedLocalSnapshot | undefined>
		>();
		const plannedRemoteFileSnapshots = new Map<
			string,
			Promise<PlannedRemoteSnapshot | undefined>
		>();
		const plannedLocalFolderSnapshots = new Map<string, PlannedLocalSnapshot | undefined>();
		const plannedRemoteFolderSnapshots = new Map<string, PlannedRemoteSnapshot | undefined>();

		const createPlannedLocalFileSnapshot = async (
			localPath: string,
			localStat: PlannedLocalSnapshot['stat'],
		): Promise<PlannedLocalSnapshot | undefined> => {
			const cached = plannedLocalFileSnapshots.get(localPath);
			if (cached) return await cached;

			const promise = (async (): Promise<PlannedLocalSnapshot | undefined> => {
				if (localStat.isDir) return undefined;
				const file = this.vault.getFileByPath(localPath);
				if (!file) throw new Error(`Cannot plan local file snapshot: ${localPath}`);

				const content = await this.vault.readBinary(file);
				return {
					stat: localStat,
					content,
					abstractFile: file,
				};
			})();

			plannedLocalFileSnapshots.set(localPath, promise);
			return await promise;
		};

		const createPlannedRemoteFileSnapshot = async (
			remotePath: string,
			remoteStat: PlannedRemoteSnapshot['stat'],
		): Promise<PlannedRemoteSnapshot | undefined> => {
			const cached = plannedRemoteFileSnapshots.get(remotePath);
			if (cached) {
				return await cached;
			}

			const promise = (async (): Promise<PlannedRemoteSnapshot | undefined> => {
				if (remoteStat.isDir) return undefined;
				const absoluteRemotePath = joinRemotePath(this.remoteBaseDir, remotePath);
				const content = (await this.webdav.getFileContents(absoluteRemotePath, {
					format: 'binary',
					details: false,
				})) as BinaryLike;

				return {
					stat: remoteStat,
					content,
				};
			})();

			plannedRemoteFileSnapshots.set(remotePath, promise);
			return await promise;
		};

		const createPlannedLocalFolderSnapshot = async (
			localPath: string,
			localStat: PlannedLocalSnapshot['stat'],
		): Promise<PlannedLocalSnapshot | undefined> => {
			const cached = plannedLocalFolderSnapshots.get(localPath);
			if (cached) {
				return cached;
			}

			const abstractFile = this.vault.getAbstractFileByPath(localPath);
			const snapshot: PlannedLocalSnapshot = {
				stat: localStat,
				abstractFile: abstractFile ?? undefined,
			};
			plannedLocalFolderSnapshots.set(localPath, snapshot);
			return snapshot;
		};

		const createPlannedRemoteFolderSnapshot = async (
			remotePath: string,
			remoteStat: PlannedRemoteSnapshot['stat'],
		): Promise<PlannedRemoteSnapshot | undefined> => {
			const cached = plannedRemoteFolderSnapshots.get(remotePath);
			if (cached) {
				return cached;
			}

			const snapshot: PlannedRemoteSnapshot = {
				stat: remoteStat,
			};
			plannedRemoteFolderSnapshots.set(remotePath, snapshot);
			return snapshot;
		};

		const decisionInput: SyncDecisionInput = {
			settings: {
				skipLargeFiles: this.settings.skipLargeFiles,
				conflictStrategy: this.settings.conflictStrategy,
				useGitStyle: this.settings.useGitStyle,
				syncMode: this.settings.syncMode,
			},
			currentLocalStats,
			currentRemoteStats,
			previousRemoteStats,
			previousLocalRecords,
			remoteBaseDir: this.remoteBaseDir,
			compareFileContent,
			onProgress: reportPlanningProgress,
			taskFactory,
			createPlannedLocalFileSnapshot,
			createPlannedRemoteFileSnapshot,
			createPlannedLocalFolderSnapshot,
			createPlannedRemoteFolderSnapshot,
		};

		return await twoWayDecider(decisionInput);
	}
}
