import type { RecordStatsMap, StatsMap, StatModel } from '~/types';
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

export interface OptionsWithRemoteStat extends TaskOptions {
	remote: StatModel;
}

export interface OptionsWithLocalStat extends TaskOptions {
	local: StatModel;
}

export interface OptionsWithBothStats extends TaskOptions {
	local: StatModel;
	remote: StatModel;
}

export interface MergeTaskOptions extends OptionsWithBothStats {
	useGitStyle: boolean;
}

export interface TaskFactory {
	createPullTask(options: OptionsWithRemoteStat): BaseTask<OptionsWithRemoteStat>;
	createPushTask(options: OptionsWithLocalStat): BaseTask<OptionsWithLocalStat>;
	createMergeTask(options: MergeTaskOptions): BaseTask<OptionsWithBothStats>;
	createRemoveLocalTask(options: TaskOptions): BaseTask;
	createRemoveRemoteTask(options: TaskOptions): BaseTask;
	createMkdirLocalTask(options: OptionsWithRemoteStat): BaseTask<OptionsWithRemoteStat>;
	createMkdirRemoteTask(options: OptionsWithLocalStat): BaseTask<OptionsWithLocalStat>;
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
