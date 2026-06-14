import type { FileStat, FolderStat, Stat } from '~/fs';
import type { ConflictStrategy, UnmergeableStrategy, RecordStatsMap, StatsMap } from '~/types';
import type { BaseTask } from '../tasks/task.interface';

export type TaskOptions = {
	key: string;
	remote?: Stat;
	local?: Stat;
};

export type OptionsWithRemoteFileStat = {
	remote: FileStat;
} & TaskOptions;

export type OptionsWithLocalFileStat = {
	local: FileStat;
} & TaskOptions;

export type OptionsWithRemoteFolderStat = {
	remote: FolderStat;
} & TaskOptions;

export type OptionsWithLocalFolderStat = {
	local: FolderStat;
} & TaskOptions;

export type OptionsWithLocalStat = {
	local: Stat;
} & TaskOptions;

export type OptionsWithRemoteStat = {
	remote: Stat;
} & TaskOptions;

export type OptionsWithBothStats = {
	local: Stat;
	remote: Stat;
} & TaskOptions;

export type OptionsWithBothFileStats = {
	local: FileStat;
	remote: FileStat;
} & TaskOptions;

export type TaskFactory = {
	createPullTask: (options: OptionsWithRemoteFileStat) => BaseTask<OptionsWithRemoteFileStat>;
	createPushTask: (options: OptionsWithLocalFileStat) => BaseTask<OptionsWithLocalFileStat>;
	createMergeTask: (options: OptionsWithBothFileStats) => BaseTask<OptionsWithBothFileStats>;
	createRemoveLocalTask: (options: OptionsWithLocalStat) => BaseTask<OptionsWithLocalStat>;
	createRemoveRemoteTask: (options: OptionsWithRemoteStat) => BaseTask<OptionsWithRemoteStat>;
	createMkdirLocalTask: (
		options: OptionsWithRemoteFolderStat,
	) => BaseTask<OptionsWithRemoteFolderStat>;
	createMkdirRemoteTask: (
		options: OptionsWithLocalFolderStat,
	) => BaseTask<OptionsWithLocalFolderStat>;
	createCleanRecordTask: (options: TaskOptions) => BaseTask;
	createAddRecordTask: (options: OptionsWithBothStats) => BaseTask<OptionsWithBothStats>;
};

export type SyncDecisionInput = {
	currentLocalStats: StatsMap;
	currentRemoteStats: StatsMap;
	records: RecordStatsMap;
	taskFactory: TaskFactory;
	settings: {
		conflictStrategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
	};
};
