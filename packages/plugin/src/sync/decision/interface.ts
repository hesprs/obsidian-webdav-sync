import type { Settings } from '@';
import type { FileStat, FolderStat, Stat, RecordStatsMap, StatsMap } from '@/types';
import type { BaseTask, TaskNames } from '../tasks/interface';
import AddRecord from '../tasks/AddRecord';
import CreateLocalDir from '../tasks/CreateLocalDir';
import CreateRemoteDir from '../tasks/CreateRemoteDir';
import Download from '../tasks/Donwload';
import Merge from '../tasks/Merge';
import MoveLocal from '../tasks/MoveLocal';
import MoveRemote from '../tasks/MoveRemote';
import RemoveLocal from '../tasks/RemoveLocal';
import RemoveRecord from '../tasks/RemoveRecord';
import RemoveRemote from '../tasks/RemoveRemote';
import Upload from '../tasks/Upload';

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

export type OptionsWithBothFileStatsAndSettings = {
	local: FileStat;
	remote: FileStat;
	settings: Settings;
} & TaskOptions;

export type OptionsWithLocalStatAndOldKey = {
	local: Stat;
	oldKey: string;
} & TaskOptions;

export type OptionsWithRemoteStatAndOldKey = {
	remote: Stat;
	oldKey: string;
} & TaskOptions;

export type TaskOptionsMap = {
	download: OptionsWithRemoteFileStat;
	upload: OptionsWithLocalFileStat;
	merge: OptionsWithBothFileStatsAndSettings;
	removeLocal: OptionsWithLocalStat;
	removeRemote: OptionsWithRemoteStat;
	createLocalDir: OptionsWithRemoteFolderStat;
	createRemoteDir: OptionsWithLocalFolderStat;
	removeRecord: TaskOptions;
	addRecord: OptionsWithBothStats;
	moveLocal: OptionsWithRemoteStatAndOldKey;
	moveRemote: OptionsWithLocalStatAndOldKey;
};
export const taskMap = {
	addRecord: AddRecord,
	createLocalDir: CreateLocalDir,
	createRemoteDir: CreateRemoteDir,
	download: Download,
	merge: Merge,
	moveLocal: MoveLocal,
	moveRemote: MoveRemote,
	removeLocal: RemoveLocal,
	removeRecord: RemoveRecord,
	removeRemote: RemoveRemote,
	upload: Upload,
} as const;
export type TaskFactory = <N extends TaskNames>(
	name: N,
	options: TaskOptionsMap[N],
) => InstanceType<(typeof taskMap)[N]>;

export type Decider = (input: DeciderInput) => Array<BaseTask>;

export type DeciderInput = {
	localStats: StatsMap;
	remoteStats: StatsMap;
	records: RecordStatsMap;
	taskFactory: TaskFactory;
	settings: Settings;
	logger: (log: string) => void;
};
