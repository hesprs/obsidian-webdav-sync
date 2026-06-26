import type { Context, Settings } from '@';
import type { SettingDefinitionItem } from 'obsidian';

export type * from 'uni-kv';
export type { RecordStat, RecordStatsMap, StatsMap, FileStat, FolderStat, Progress } from '@/types';
export type * from '@/fs/interface';
export type { Context, Events, Translations, Settings } from '@';

export default class Module {
	constructor(protected readonly ctx: Context) {}

	// Injected by context
	declare protected readonly settings: Settings;

	// Injected when loading
	readonly moduleSettings = {};

	readonly getSettingDefinitions: () => Array<SettingDefinitionItem> = () => [];
}
