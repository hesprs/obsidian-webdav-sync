import type { UserOptions } from './utils/glob-match-reusable';

export type General = any;
export type MaybePromise<T> = Promise<T> | T;
export type TogglableValue<T = number> = { enabled: boolean; value: T };

export type FileStat = {
	isDir: false;
	key: string;
	mtime: number;
	size: number;
	// Etag or other kinds of string whose equality signifies the file is unchanged
	uid: string;
};
export type FolderStat = {
	isDir: true;
	key: string;
};
export type Stat = FileStat | FolderStat;
export type RecordStat = { isDir: false; local: string; remote: string } | { isDir: true };
export type StatsMap = Map<string, Stat>;
export type RecordStatsMap = Map<string, RecordStat>;

export enum ConflictStrategy {
	DiffMatchPatch = 'diffMatchPatch',
	LatestTimeStamp = 'latestTimestamp',
	KeepLocal = 'keepLocal',
	KeepRemote = 'keepRemote',
	Skip = 'skip',
}

export enum UnmergeableStrategy {
	LatestTimeStamp = 'latestTimestamp',
	KeepLocal = 'keepLocal',
	KeepRemote = 'keepRemote',
	Skip = 'skip',
}

export type GlobMatchOptions = {
	expr: string;
	options: UserOptions;
};

export type Progress<T = string> = {
	total: number;
	completed: number;
	current?: T;
};
