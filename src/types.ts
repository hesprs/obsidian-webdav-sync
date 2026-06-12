import type { Stat } from './fs';
import type { UserOptions } from './utils/glob-match-reusable';

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

export type PluginSettings = {
	serverUrl: string;
	account: string;
	token: string;
	encryption: {
		enabled: boolean;
		value: string;
	};
	exhaustiveRemoteTraversal: boolean;
	remoteDir: string;
	showSyncStatusInNotificationOnMobile: boolean;
	useGitStyle: boolean;
	conflictStrategy: ConflictStrategy;
	unmergeableStrategy: UnmergeableStrategy;
	confirmBeforeSync: boolean;
	confirmBeforeDeleteInAutoSync: boolean;
	fastRealtimeSync: boolean;
	filterRules: {
		exclusionRules: Array<GlobMatchOptions>;
		inclusionRules: Array<GlobMatchOptions>;
	};
	skipLargeFiles: ToggleNumericSettingsField; // Value is max size
	realtimeSync: ToggleNumericSettingsField; // Value is delay
	maxWebDAVConcurrency: ToggleNumericSettingsField; // Value is max
	maxThroughputConcurrency: ToggleNumericSettingsField; // Value is max
	maxSyncTaskConcurrency: ToggleNumericSettingsField; // Value is max
	minWebDAVRequestInterval: ToggleNumericSettingsField; // Value is min
	startupSync: ToggleNumericSettingsField; // Value is delay
	scheduledSync: ToggleNumericSettingsField; // Value is interval
};
