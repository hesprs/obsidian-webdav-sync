import type { ConflictStrategy, UnmergeableStrategy } from '~/settings';
import type { FileStatModel, FolderStatModel, RecordStatsMap, StatModel, StatsMap } from '~/types';
import type { BaseTask } from '../tasks/task.interface';

export type TaskOptions = {
	remotePath: string;
	localPath: string;
	remote?: StatModel;
	local?: StatModel;
};

export type OptionsWithRemoteFileStat = {
	remote: FileStatModel;
} & TaskOptions;

export type OptionsWithLocalFileStat = {
	local: FileStatModel;
} & TaskOptions;

export type OptionsWithRemoteFolderStat = {
	remote: FolderStatModel;
} & TaskOptions;

export type OptionsWithLocalFolderStat = {
	local: FolderStatModel;
} & TaskOptions;

export type OptionsWithLocalStat = {
	local: StatModel;
} & TaskOptions;

export type OptionsWithRemoteStat = {
	remote: StatModel;
} & TaskOptions;

export type OptionsWithBothStats = {
	local: StatModel;
	remote: StatModel;
} & TaskOptions;

export type OptionsWithBothFileStats = {
	local: FileStatModel;
	remote: FileStatModel;
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
	remoteBaseDir: string;
	taskFactory: TaskFactory;
	settings: {
		conflictStrategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
	};
};
