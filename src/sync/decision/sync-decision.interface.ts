import type { TAbstractFile } from 'obsidian';
import type { SyncPlanningProgress } from '~/events';
import type { BinaryLike } from '~/platform/binary';
import type { RecordStatsMap, StatsMap, StatModel } from '~/types';
import { SyncMode } from '~/settings';
import { ConflictStrategy } from '../tasks/merge.task';
import { BaseTask } from '../tasks/task.interface';

export interface SyncDecisionSettings {
	skipLargeFiles: { maxSize: string };
	conflictStrategy: ConflictStrategy;
	useGitStyle: boolean;
	syncMode: SyncMode;
}

export interface SyncRecordItem {
	remote: StatModel;
	local: StatModel;
	baseText?: string;
}

export interface TaskOptions {
	remotePath: string;
	localPath: string;
}

export interface PlannedLocalSnapshot {
	stat: StatModel;
	content?: BinaryLike;
	abstractFile?: TAbstractFile;
}

export interface PlannedRemoteSnapshot {
	stat: StatModel;
	content?: BinaryLike;
}

export interface PlannedPathSnapshot {
	localPath: string;
	remotePath: string;
	local?: PlannedLocalSnapshot;
	remote?: PlannedRemoteSnapshot;
}

export interface MergeTaskOptions extends TaskOptions {
	record?: SyncRecordItem;
	strategy: ConflictStrategy;
	local: PlannedLocalSnapshot;
	remote: PlannedRemoteSnapshot;
	useGitStyle: boolean;
}

export interface PullTaskOptions extends TaskOptions {
	remote?: PlannedRemoteSnapshot;
	remoteSize?: number;
}

export interface PushTaskOptions extends TaskOptions {
	local?: PlannedLocalSnapshot;
}

export interface MkdirLocalTaskOptions extends TaskOptions {
	remote?: PlannedRemoteSnapshot;
}

export interface MkdirRemoteTaskOptions extends TaskOptions {
	local?: PlannedLocalSnapshot;
}

export interface AddRecordTaskOptions extends TaskOptions {
	local?: PlannedLocalSnapshot;
	remote?: StatModel;
}

export interface TaskFactory {
	createPullTask(options: PullTaskOptions): BaseTask;
	createPushTask(options: PushTaskOptions): BaseTask;
	createMergeTask(options: MergeTaskOptions): BaseTask;
	createRemoveLocalTask(options: TaskOptions): BaseTask;
	createRemoveLocalRecursivelyTask(options: TaskOptions): BaseTask;
	createRemoveRemoteTask(options: TaskOptions): BaseTask;
	createMkdirLocalTask(options: MkdirLocalTaskOptions): BaseTask;
	createMkdirRemoteTask(options: MkdirRemoteTaskOptions): BaseTask;
	createCleanRecordTask(options: TaskOptions): BaseTask;
	createAddRecordTask(options: AddRecordTaskOptions): BaseTask;
}

export interface SyncDecisionInput {
	settings: SyncDecisionSettings;
	currentLocalStats: StatsMap;
	currentRemoteStats: StatsMap;
	records: RecordStatsMap;
	remoteBaseDir: string;
	compareFileContent: (filePath: string, baseText: string) => Promise<boolean>;
	onProgress?: (progress: SyncPlanningProgress) => Promise<void> | void;
	createPlannedLocalFileSnapshot: (
		localPath: string,
		localStat: StatModel,
	) => Promise<PlannedLocalSnapshot | undefined>;
	createPlannedRemoteFileSnapshot: (
		remotePath: string,
		remoteStat: StatModel,
	) => Promise<PlannedRemoteSnapshot | undefined>;
	createPlannedLocalFolderSnapshot: (
		localPath: string,
		localStat: StatModel,
	) => PlannedLocalSnapshot | undefined;
	createPlannedRemoteFolderSnapshot: (
		remotePath: string,
		remoteStat: StatModel,
	) => PlannedRemoteSnapshot | undefined;
	taskFactory: TaskFactory;
	getBaseText: (path: string) => Promise<string | undefined>;
}
