export type StatModel =
	| {
			path: string;
			isDir: true;
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

export interface RecordStatModel {
	local: StatModel;
	remote: StatModel;
}

export type StatsMap = Map<string, StatModel>;
export type RecordStatsMap = Map<string, RecordStatModel>;

export type MaybePromise<T> = Promise<T> | T;
