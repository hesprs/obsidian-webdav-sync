export type StatModel =
	| {
			path: string;
			isDir: true;
			mtime: number;
	  }
	| {
			path: string;
			isDir: false;
			mtime: number;
			size: number;
	  };

export enum SyncRunKind {
	normal = 'normal',
	fast = 'fast',
}

export interface PreviousSyncRecordModel {
	local: StatModel;
	remote: StatModel;
}

export type StatsMap = Map<string, StatModel>;

export interface SyncStateModel {
	version: 1;
	remoteRecords: StatsMap;
	localRecords: StatsMap;
}

export type MaybePromise<T> = Promise<T> | T;
