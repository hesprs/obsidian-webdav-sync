import type { RecordStatsMap, StatsMap, StatModel, FileStatModel, FolderStatModel } from '~/types';
import { SyncMode } from '~/settings';
import { ConflictStrategy } from '../tasks/merge.task';
import { BaseTask } from '../tasks/task.interface';

export interface SyncDecisionSettings {
	conflictStrategy: ConflictStrategy;
	useGitStyle: boolean;
	syncMode: SyncMode;
}

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

export interface OptionsWithBothStats extends TaskOptions {
	local: StatModel;
	remote: StatModel;
}

export interface MergeTaskOptions extends TaskOptions {
	local: FileStatModel;
	remote: FileStatModel;
	useGitStyle: boolean;
}

export interface TaskFactory {
	createPullTask(options: OptionsWithRemoteFileStat): BaseTask<OptionsWithRemoteFileStat>;
	createPushTask(options: OptionsWithLocalFileStat): BaseTask<OptionsWithLocalFileStat>;
	createMergeTask(options: MergeTaskOptions): BaseTask<OptionsWithBothStats>;
	createRemoveLocalTask(options: TaskOptions): BaseTask;
	createRemoveRemoteTask(options: TaskOptions): BaseTask;
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
	settings: SyncDecisionSettings;
	currentLocalStats: StatsMap;
	currentRemoteStats: StatsMap;
	records: RecordStatsMap;
	remoteBaseDir: string;
	taskFactory: TaskFactory;
}
