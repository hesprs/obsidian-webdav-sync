import type { TAbstractFile } from 'obsidian';
import type { SyncPlanningProgress } from '~/events';
import type { FsWalkResult } from '~/fs/fs.interface';
import type { StatModel } from '~/model/stat.model';
import type { LocalRecordModel } from '~/model/sync-record.model';
import type { BinaryLike } from '~/platform/binary';
import { SyncMode } from '~/settings';
import type { SkipReason } from '../tasks/skipped.task';
import { ConflictStrategy } from '../tasks/conflict-resolve.task';
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

export interface ConflictTaskOptions extends TaskOptions {
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

export type SkippedTaskOptions = TaskOptions &
	(
		| {
				reason: SkipReason.FileTooLarge;
				maxSize: number;
				remoteSize: number;
				localSize?: number;
		  }
		| {
				reason: SkipReason.FileTooLarge;
				maxSize: number;
				remoteSize?: number;
				localSize: number;
		  }
		| {
				reason: SkipReason.FileTooLarge;
				maxSize: number;
				remoteSize: number;
				localSize: number;
		  }
		| {
				reason: SkipReason.FolderContainsIgnoredItems;
				ignoredPaths: string[];
		  }
	);

export interface TaskFactory {
	createPullTask(options: PullTaskOptions): BaseTask;
	createPushTask(options: PushTaskOptions): BaseTask;
	createConflictResolveTask(options: ConflictTaskOptions): BaseTask;
	createRemoveLocalTask(options: TaskOptions): BaseTask;
	createRemoveLocalRecursivelyTask(options: TaskOptions): BaseTask;
	createRemoveRemoteTask(options: TaskOptions): BaseTask;
	createMkdirLocalTask(options: MkdirLocalTaskOptions): BaseTask;
	createMkdirRemoteTask(options: MkdirRemoteTaskOptions): BaseTask;
	createCleanRecordTask(options: TaskOptions): BaseTask;
	createAddRecordTask(options: AddRecordTaskOptions): BaseTask;
	createFilenameErrorTask(options: TaskOptions): BaseTask;
	createSkippedTask(options: SkippedTaskOptions): BaseTask;
}

export interface SyncDecisionInput {
	settings: SyncDecisionSettings;
	currentLocalStats: FsWalkResult[];
	currentRemoteStats: FsWalkResult[];
	previousRemoteRecords: StatModel[];
	previousLocalRecords: Map<string, LocalRecordModel>;
	remoteBaseDir: string;
	compareFileContent: (filePath: string, baseText: string) => Promise<boolean>;
	onProgress?: (progress: SyncPlanningProgress) => Promise<void> | void;
	createPlannedLocalFileSnapshot: (
		localPath: string,
		localStat: PlannedLocalSnapshot['stat'],
	) => Promise<PlannedLocalSnapshot | undefined>;
	createPlannedRemoteFileSnapshot: (
		remotePath: string,
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => Promise<PlannedRemoteSnapshot | undefined>;
	createPlannedLocalFolderSnapshot: (
		localPath: string,
		localStat: PlannedLocalSnapshot['stat'],
	) => PlannedLocalSnapshot | undefined;
	createPlannedRemoteFolderSnapshot: (
		remotePath: string,
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => PlannedRemoteSnapshot | undefined;
	taskFactory: TaskFactory;
}
