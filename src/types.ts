export type StatModel = FileStatModel | FolderStatModel;

export type FileStatModel = {
	path: string;
	isDir: false;
	mtime: number;
	size: number;
};

export type FolderStatModel = {
	path: string;
	isDir: true;
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

type Primitive = string | number | boolean | null | undefined;
export type InterpolationValues = Record<string, Primitive>;

export type KeyOfObject<T, P extends string = ''> = T extends object
	? {
			[K in keyof T]: K extends string
				? T[K] extends object
					? KeyOfObject<T[K], `${P}${K}.`>
					: `${P}${K}`
				: never;
		}[keyof T]
	: never;

export type ToggleNumericSettingsField = {
	enabled: boolean;
	value: number;
};
