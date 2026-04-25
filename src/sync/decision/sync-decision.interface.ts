import type { ConflictStrategy, UnmergeableStrategy } from '~/settings';
import type { RecordStatsMap, StatsMap, StatModel, FileStatModel, FolderStatModel } from '~/types';
import { BaseTask } from '../tasks/task.interface';

export interface TaskOptions {
	remotePath: string;
	localPath: string;
	remote?: StatModel;
	local?: StatModel;
}

export interface OptionsWithRemoteFileStat extends TaskOptions {
	remote: FileStatModel;
}

export interface OptionsWithLocalFileStat extends TaskOptions {
	local: FileStatModel;
}

export interface OptionsWithRemoteFolderStat extends TaskOptions {
	remote: FolderStatModel;
}

export interface OptionsWithLocalFolderStat extends TaskOptions {
	local: FolderStatModel;
}

export interface OptionsWithLocalStat extends TaskOptions {
	local: StatModel;
}

export interface OptionsWithRemoteStat extends TaskOptions {
	remote: StatModel;
}

export interface OptionsWithBothStats extends TaskOptions {
	local: StatModel;
	remote: StatModel;
}

export interface OptionsWithBothFileStats extends TaskOptions {
	local: FileStatModel;
	remote: FileStatModel;
}

export interface TaskFactory {
	createPullTask(options: OptionsWithRemoteFileStat): BaseTask<OptionsWithRemoteFileStat>;
	createPushTask(options: OptionsWithLocalFileStat): BaseTask<OptionsWithLocalFileStat>;
	createMergeTask(options: OptionsWithBothFileStats): BaseTask<OptionsWithBothFileStats>;
	createRemoveLocalTask(options: OptionsWithLocalStat): BaseTask<OptionsWithLocalStat>;
	createRemoveRemoteTask(options: OptionsWithRemoteStat): BaseTask<OptionsWithRemoteStat>;
	createMkdirLocalTask(
		options: OptionsWithRemoteFolderStat,
	): BaseTask<OptionsWithRemoteFolderStat>;
	createMkdirRemoteTask(
		options: OptionsWithLocalFolderStat,
	): BaseTask<OptionsWithLocalFolderStat>;
	createCleanRecordTask(options: TaskOptions): BaseTask;
	createAddRecordTask(options: OptionsWithBothStats): BaseTask<OptionsWithBothStats>;
}

export interface SyncDecisionInput {
	currentLocalStats: StatsMap;
	currentRemoteStats: StatsMap;
	records: RecordStatsMap;
	remoteBaseDir: string;
	taskFactory: TaskFactory;
	settings: {
		conflictStrategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
	};
}
