import type { BinaryLike } from '~/platform/binary';
import type { SyncRecord } from '~/storage';
import type { RecordStatsMap, StatModel, StatsMap } from '~/types';
import { SyncPlanningSubStage, type SyncPlanningProgress } from '~/events';
import { traverseVault } from '~/fs/traverse-vault';
import { traverseWebDAV } from '~/fs/traverse-webdav';
import { SyncRunKind } from '~/types';
import type { SyncEngine } from '..';
import type {
	AddRecordTaskOptions,
	MkdirLocalTaskOptions,
	MkdirRemoteTaskOptions,
	MergeTaskOptions,
	PlannedLocalSnapshot,
	PlannedRemoteSnapshot,
	PullTaskOptions,
	PushTaskOptions,
	SyncDecisionInput,
	TaskFactory,
	TaskOptions,
} from './sync-decision.interface';
import AddRecordTask from '../tasks/add-record.task';
import CleanRecordTask from '../tasks/clean-record.task';
import FilenameErrorTask from '../tasks/filename-error.task';
import MergeTask from '../tasks/merge.task';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import RemoveLocalRecursivelyTask from '../tasks/remove-local-recursively.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import { BaseTask } from '../tasks/task.interface';
import { twoWayDecider } from './two-way.decider.function';

export default class TwoWaySyncDecider {
	constructor(
		private sync: SyncEngine,
		private token: string,
		private syncRecordStorage: SyncRecord,
	) {}

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
		const reportPlanningProgress = async (progress: SyncPlanningProgress) => {
			await options?.onPlanningProgress?.(progress);
		};

		const records = await this.syncRecordStorage.getRecords();

		const currentLocalStats = await traverseVault({ vault: this.vault });

		await reportPlanningProgress({
			subStage: SyncPlanningSubStage.walkingRemote,
			totalWorkUnits: this.sync.runKind === SyncRunKind.fast ? 1 : 0,
			completedWorkUnits: 0,
			currentItem: this.remoteBaseDir,
		});
		const currentRemoteStats =
			this.sync.runKind === SyncRunKind.fast
				? extractRemoteRecords(records)
				: await traverseWebDAV({
						onProgress: async (progress) => {
							await reportPlanningProgress({
								subStage: SyncPlanningSubStage.walkingRemote,
								totalWorkUnits: progress.totalDirectories,
								completedWorkUnits: progress.processedDirectories,
								currentItem: progress.currentDirectory ?? this.remoteBaseDir,
							});
						},
						token: this.token,
					});

		// 创建共用的task选项
		const commonTaskOptions = {
			webdav: this.webdav,
			vault: this.vault,
			remoteBaseDir: this.remoteBaseDir,
			syncRecord: this.syncRecordStorage,
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
			createMergeTask: (options: MergeTaskOptions) =>
				new MergeTask({ ...commonTaskOptions, ...options }),
			createRemoveLocalTask: (options: TaskOptions) =>
				new RemoveLocalTask({ ...commonTaskOptions, ...options }),
			createRemoveLocalRecursivelyTask: (options: TaskOptions) =>
				new RemoveLocalRecursivelyTask({ ...commonTaskOptions, ...options }),
			createRemoveRemoteTask: (options: TaskOptions) =>
				new RemoveRemoteTask({ ...commonTaskOptions, ...options }),
			createMkdirLocalTask: (options: MkdirLocalTaskOptions) =>
				new MkdirLocalTask({ ...commonTaskOptions, ...options }),
			createMkdirRemoteTask: (options: MkdirRemoteTaskOptions) =>
				new MkdirRemoteTask({ ...commonTaskOptions, ...options }),
			createCleanRecordTask: (options: TaskOptions) =>
				new CleanRecordTask({ ...commonTaskOptions, ...options }),
			createAddRecordTask: (options: AddRecordTaskOptions) =>
				new AddRecordTask({ ...commonTaskOptions, ...options }),
			createFilenameErrorTask: (options: TaskOptions) =>
				new FilenameErrorTask({ ...commonTaskOptions, ...options }),
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
			localStat: StatModel,
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
			remoteStat: StatModel,
		): Promise<PlannedRemoteSnapshot | undefined> => {
			const cached = plannedRemoteFileSnapshots.get(remotePath);
			if (cached) return await cached;

			const promise = (async (): Promise<PlannedRemoteSnapshot | undefined> => {
				if (remoteStat.isDir) return undefined;
				const content = (await this.webdav.getFileContents(remotePath, {
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

		const createPlannedLocalFolderSnapshot = (
			localPath: string,
			localStat: StatModel,
		): PlannedLocalSnapshot | undefined => {
			const cached = plannedLocalFolderSnapshots.get(localPath);
			if (cached) return cached;

			const abstractFile = this.vault.getAbstractFileByPath(localPath);
			const snapshot: PlannedLocalSnapshot = {
				stat: localStat,
				abstractFile: abstractFile ?? undefined,
			};
			plannedLocalFolderSnapshots.set(localPath, snapshot);
			return snapshot;
		};

		const createPlannedRemoteFolderSnapshot = (
			remotePath: string,
			remoteStat: StatModel,
		): PlannedRemoteSnapshot | undefined => {
			const cached = plannedRemoteFolderSnapshots.get(remotePath);
			if (cached) return cached;

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
			records,
			remoteBaseDir: this.remoteBaseDir,
			compareFileContent,
			onProgress: reportPlanningProgress,
			taskFactory,
			createPlannedLocalFileSnapshot,
			createPlannedRemoteFileSnapshot,
			createPlannedLocalFolderSnapshot,
			createPlannedRemoteFolderSnapshot,
			getBaseText: async (path) => this.syncRecordStorage.getBaseText(path),
		};

		return await twoWayDecider(decisionInput);
	}
}

function extractRemoteRecords(records: RecordStatsMap): StatsMap {
	const res: StatsMap = new Map();
	for (const [path, record] of records) res.set(path, record.remote);
	return res;
}
