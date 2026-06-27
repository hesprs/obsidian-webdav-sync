import type { Context } from '@';

export type SelectFromContext<O extends object> = Context extends O ? O : never;
export { default as obsidianBridge } from './obsidian-bridge';
export type { Translate } from '@/modules/I18n';
export type { Dispatch, On } from '@/modules/EventBus';
export type { Context, Settings, Events, Translations } from '@';
export type * from 'uni-kv';
export { default as testKit } from './test-utils';
export type {
	RecordStat,
	RecordStatsMap,
	StatsMap,
	FileStat,
	FolderStat,
	Progress,
	Stat,
	MaybePromise,
} from '@/types';
export type {
	MemoryDBMeta,
	MemoryDBSchema,
	IndexedDBMeta,
	IndexedDBSchema,
	DeciderEntry,
	RemoteFsEntry,
	LocalFsWrapperEntry,
	RemoteFsWrapperEntry,
} from '@/modules/Storage';
export type * from '@/fs/interface';
