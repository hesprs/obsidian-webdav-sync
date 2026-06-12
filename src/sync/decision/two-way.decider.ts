import { ref } from 'synthkernel';
import type { ProgressPatch } from '~/events';
import type { Stat } from '~/fs-new';
import type { SyncRecord } from '~/storage';
import type { RecordStatsMap } from '~/types';
import { SyncRunKind } from '~/types';
import { useSettings } from '~/utils/plugin-instance';
import type SyncEngine from '../engine';
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
import postTraversal from '../utils/post-traversal';
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

	async decide(options?: {
		onProgress?: (progress: ProgressPatch) => void;
		throwIfCancelled?: () => void;
	}): Promise<Array<BaseTask>> {
		const onProgress = (progress: ProgressPatch) => options?.onProgress?.(progress);

		const { filterRules, skipLargeFiles } = await useSettings();
		const postProcess = (stats: Array<Stat>) =>
			postTraversal(
				toMap(stats),
				filterRules,
				skipLargeFiles.enabled ? skipLargeFiles.value : undefined,
			);

		const records = await this.syncRecordStorage.getRecords();
		const currentLocalStats = postProcess(await this.vault.listAll('/'));

		onProgress({
			remoteWalkSummary: {
				completed: 0,
				total: this.sync.runKind === SyncRunKind.fast ? 1 : 0,
			},
			stage: 'walking_remote',
		});
		const progressRef = ref({ completed: 0, total: 0 });
		progressRef.subscribe((progress) => onProgress({ remoteWalkSummary: progress }));
		const currentRemoteStats = postProcess(
			this.sync.runKind === SyncRunKind.fast
				? extractRemoteRecords(records)
				: await this.webdav.listAll('/', progressRef),
		);

		const commonTaskOptions = {
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
			settings: {
				conflictStrategy: this.sync.settings.conflictStrategy,
				unmergeableStrategy: this.sync.settings.unmergeableStrategy,
			},
			taskFactory,
		};

		return twoWayDecider(decisionInput);
	}
}

function extractRemoteRecords(records: RecordStatsMap): Array<Stat> {
	const res: Array<Stat> = [];
	for (const [key, record] of records)
		res.push(
			record.isDir
				? { isDir: true, key }
				: { isDir: false, key, mtime: 0, size: 0, uid: record.remote },
		);
	return res;
}

function toMap(stats: Array<Stat>): Map<string, Stat> {
	const res = new Map<string, Stat>();
	for (const stat of stats) res.set(stat.key, stat);
	return res;
}
