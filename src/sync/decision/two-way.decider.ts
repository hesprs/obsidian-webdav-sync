import type { SyncRecord } from '~/storage';
import type { RecordStatsMap, StatsMap } from '~/types';
import { SyncPlanningSubStage, type SyncPlanningProgress } from '~/events';
import postTraversal from '~/fs/post-traversal';
import { traverseVault } from '~/fs/traverse-vault';
import { traverseWebDAV } from '~/fs/traverse-webdav';
import { useSettings } from '~/settings';
import { SyncRunKind } from '~/types';
import type { SyncEngine } from '..';
import type {
	OptionsWithBothFileStats,
	OptionsWithBothStats,
	OptionsWithLocalFileStat,
	OptionsWithLocalFolderStat,
	OptionsWithLocalStat,
	OptionsWithRemoteFileStat,
	OptionsWithRemoteFolderStat,
	OptionsWithRemoteStat,
	SyncDecisionInput,
	TaskFactory,
	TaskOptions,
} from './sync-decision.interface';
import AddRecordTask from '../tasks/add-record.task';
import CleanRecordTask from '../tasks/clean-record.task';
import MergeTask from '../tasks/merge.task';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
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

	get vault() {
		return this.sync.vault;
	}

	get remoteBaseDir() {
		return this.sync.remoteBaseDir;
	}

	async decide(options?: {
		onProgress?: (progress: SyncPlanningProgress) => void;
		throwIfCancelled?: () => void;
	}): Promise<BaseTask[]> {
		const onProgress = (progress: SyncPlanningProgress) => options?.onProgress?.(progress);

		const records = await this.syncRecordStorage.getRecords();

		const currentLocalStats = await traverseVault({ vault: this.vault });

		onProgress({
			subStage: SyncPlanningSubStage.walkingRemote,
			totalWorkUnits: this.sync.runKind === SyncRunKind.fast ? 1 : 0,
			completedWorkUnits: 0,
			currentItem: this.remoteBaseDir,
		});
		const currentRemoteStats =
			this.sync.runKind === SyncRunKind.fast
				? await extractRemoteRecords(records)
				: await traverseWebDAV({
						onProgress: (progress) =>
							onProgress({
								subStage: SyncPlanningSubStage.walkingRemote,
								totalWorkUnits: progress.totalDirectories,
								completedWorkUnits: progress.processedDirectories,
								currentItem: progress.currentDirectory ?? this.remoteBaseDir,
							}),
						token: this.token,
						throwIfCancelled: options?.throwIfCancelled,
					});

		const commonTaskOptions = {
			webdav: this.webdav,
			vault: this.vault,
			remoteBaseDir: this.remoteBaseDir,
			syncRecord: this.syncRecordStorage,
		};

		const taskFactory: TaskFactory = {
			createPullTask: (options: OptionsWithRemoteFileStat) =>
				new PullTask({ ...commonTaskOptions, ...options }),
			createPushTask: (options: OptionsWithLocalFileStat) =>
				new PushTask({ ...commonTaskOptions, ...options }),
			createMergeTask: (options: OptionsWithBothFileStats) =>
				new MergeTask({ ...commonTaskOptions, ...options }),
			createRemoveLocalTask: (options: OptionsWithLocalStat) =>
				new RemoveLocalTask({ ...commonTaskOptions, ...options }),
			createRemoveRemoteTask: (options: OptionsWithRemoteStat) =>
				new RemoveRemoteTask({ ...commonTaskOptions, ...options }),
			createMkdirLocalTask: (options: OptionsWithRemoteFolderStat) =>
				new MkdirLocalTask({ ...commonTaskOptions, ...options }),
			createMkdirRemoteTask: (options: OptionsWithLocalFolderStat) =>
				new MkdirRemoteTask({ ...commonTaskOptions, ...options }),
			createCleanRecordTask: (options: TaskOptions) =>
				new CleanRecordTask({ ...commonTaskOptions, ...options }),
			createAddRecordTask: (options: OptionsWithBothStats) =>
				new AddRecordTask({ ...commonTaskOptions, ...options }),
		};

		const decisionInput: SyncDecisionInput = {
			settings: {
				conflictStrategy: this.sync.settings.conflictStrategy,
				unmergeableStrategy: this.sync.settings.unmergeableStrategy,
			},
			currentLocalStats,
			currentRemoteStats,
			records,
			remoteBaseDir: this.remoteBaseDir,
			taskFactory,
		};

		return twoWayDecider(decisionInput);
	}
}

async function extractRemoteRecords(records: RecordStatsMap): Promise<StatsMap> {
	const res: StatsMap = new Map();
	const { filterRules, skipLargeFiles } = await useSettings();
	for (const [path, record] of records) res.set(path, record.remote);
	return postTraversal(
		res,
		filterRules,
		skipLargeFiles.enabled ? skipLargeFiles.value : undefined,
	);
}
