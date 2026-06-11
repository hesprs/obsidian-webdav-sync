import type { Stat } from './fs-new';

export enum SyncRunKind {
	normal = 'normal',
	fast = 'fast',
}

export type RecordStat = { isDir: false; local: string; remote: string } | { isDir: true };

export type StatsMap = Map<string, Stat>;
export type RecordStatsMap = Map<string, RecordStat>;

export type MaybePromise<T> = Promise<T> | T;

export type ToggleNumericSettingsField = {
	enabled: boolean;
	value: number;
};
