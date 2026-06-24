import type { Stat } from './fs';
import type { UserOptions } from './utils/glob-match-reusable';

export type General = any;
export type MaybePromise<T> = Promise<T> | T;
export type TogglableValue<T = number> = { enabled: boolean; value: T };

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
