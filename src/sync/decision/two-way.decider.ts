import type { ProgressPatch } from '~/events';
import type { SyncRecord } from '~/storage';
import type { RecordStatsMap, StatsMap } from '~/types';
import postTraversal from '~/fs/post-traversal';
import { traverseVault } from '~/fs/vault';
import { traverseWebDAV } from '~/fs/webdav';
import { useSettings } from '~/settings';
import { SyncRunKind } from '~/types';
import type SyncEngine from '..';
import type { BaseTask } from '../tasks/task.interface';
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
import twoWayDecider from './two-way.decider.function';

export default class TwoWaySyncDecider {
	constructor(
		private readonly sync: SyncEngine,
		private readonly token: string,
		private readonly syncRecordStorage: SyncRecord,
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
		onProgress?: (progress: ProgressPatch) => void;
		throwIfCancelled?: () => void;
	}): Promise<Array<BaseTask>> {
		const onProgress = (progress: ProgressPatch) => options?.onProgress?.(progress);

		const records = await this.syncRecordStorage.getRecords();

		const currentLocalStats = await traverseVault({ vault: this.vault });

		onProgress({
			remoteWalkSummary: {
				completedItems: 0,
				currentItem: this.remoteBaseDir,
				totalItems: this.sync.runKind === SyncRunKind.fast ? 1 : 0,
			},
			stage: 'walking_remote',
		});
		const currentRemoteStats =
			this.sync.runKind === SyncRunKind.fast
				? await extractRemoteRecords(records)
				: await traverseWebDAV({
						onProgress: (progress) =>
							onProgress({
								remoteWalkSummary: {
									completedItems: progress.processedDirectories,
									currentItem: progress.currentDirectory ?? this.remoteBaseDir,
									totalItems: progress.totalDirectories,
								},
								stage: 'walking_remote',
							}),
						throwIfCancelled: options?.throwIfCancelled,
						token: this.token,
					});

		const commonTaskOptions = {
			remoteBaseDir: this.remoteBaseDir,
			syncRecord: this.syncRecordStorage,
			vault: this.vault,
			webdav: this.webdav,
		};

		const taskFactory: TaskFactory = {
			createAddRecordTask: (opts: OptionsWithBothStats) =>
				new AddRecordTask({ ...commonTaskOptions, ...opts }),
			createCleanRecordTask: (opts: TaskOptions) =>
				new CleanRecordTask({ ...commonTaskOptions, ...opts }),
			createMergeTask: (opts: OptionsWithBothFileStats) =>
				new MergeTask({ ...commonTaskOptions, ...opts }),
			createMkdirLocalTask: (opts: OptionsWithRemoteFolderStat) =>
				new MkdirLocalTask({ ...commonTaskOptions, ...opts }),
			createMkdirRemoteTask: (opts: OptionsWithLocalFolderStat) =>
				new MkdirRemoteTask({ ...commonTaskOptions, ...opts }),
			createPullTask: (opts: OptionsWithRemoteFileStat) =>
				new PullTask({ ...commonTaskOptions, ...opts }),
			createPushTask: (opts: OptionsWithLocalFileStat) =>
				new PushTask({ ...commonTaskOptions, ...opts }),
			createRemoveLocalTask: (opts: OptionsWithLocalStat) =>
				new RemoveLocalTask({ ...commonTaskOptions, ...opts }),
			createRemoveRemoteTask: (opts: OptionsWithRemoteStat) =>
				new RemoveRemoteTask({ ...commonTaskOptions, ...opts }),
		};

		const decisionInput: SyncDecisionInput = {
			currentLocalStats,
			currentRemoteStats,
			records,
			remoteBaseDir: this.remoteBaseDir,
			settings: {
				conflictStrategy: this.sync.settings.conflictStrategy,
				unmergeableStrategy: this.sync.settings.unmergeableStrategy,
			},
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
