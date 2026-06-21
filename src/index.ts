import './global.css';
import type { Command, EventRef } from 'obsidian';
import type { Context, MergeSingleKey } from 'synthkernel';
import { App, getLanguage, Plugin } from 'obsidian';
import { createContext } from 'synthkernel';
import { ConflictStrategy, UnmergeableStrategy } from '~/types';
import type { ObsidianLanguageCode } from './modules/I18n';
import type { AddRibbonIcon } from './modules/Observability';
import type { GlobMatchOptions } from './types';
import EventBus from './modules/EventBus';
import I18n from './modules/I18n';
import Observability from './modules/Observability';
import ProgressModal from './modules/ProgressModal';
import Scheduler from './modules/Scheduler';
import Settings from './modules/Settings';
import Storage from './modules/Storage';
import Sync from './modules/Sync';

function createGlobMatchOptions(expr: string) {
	return {
		expr,
		options: {
			caseSensitive: false,
		},
	} satisfies GlobMatchOptions;
}

const allModules = [
	EventBus,
	Settings,
	Storage,
	I18n,
	Sync,
	Observability,
	Scheduler,
	ProgressModal,
] as const;
type AllModules = typeof allModules;
export type PluginContext = Context<
	AllModules,
	'settings' | 'root' | 'events' | 'i18n',
	{
		app: App;
		addCommand: (command: Command) => void;
		registerEvent: (ref: EventRef) => void;
		addRibbonIcon: AddRibbonIcon;
		addStatusBarItem: () => HTMLElement;
	}
>;
export type EventMap = MergeSingleKey<AllModules, 'events'>;
export type PluginSettings = MergeSingleKey<AllModules, 'settings'>;
export type Translations = MergeSingleKey<AllModules, 'i18n'>;

export default class SyncEngine extends Plugin {
	context?: PluginContext;
	readonly settings: PluginSettings = {
		confirmDeleteInAutoSync: true,
		confirmTasksInSync: true,
		conflictStrategy: ConflictStrategy.DiffMatchPatch,
		decider: 'twoWay',
		exclusionRules: [
			'**/.git',
			'**/.github',
			'**/.gitlab',
			'**/.svn',
			'**/node_modules',
			'**/.DS_Store',
			'**/__MACOSX',
			'**/desktop.ini',
			'**/Thumbs.db',
			'**/.trash',
			'**/~$*.doc',
			'**/~$*.docx',
			'**/~$*.ppt',
			'**/~$*.pptx',
			'**/~$*.xls',
			'**/~$*.xlsx',
			this.app.vault.configDir,
		].map(createGlobMatchOptions),
		inclusionRules: [],
		maxFileSize: 31_457_280,
		maxFileSizeEnabled: false,
		noticeStatusOnMobile: true,
		realtimeSyncDelay: 5000,
		realtimeSyncEnabled: false,
		realtimeSyncFastMode: true,
		remoteFs: '',
		scheduledSyncEnabled: false,
		scheduledSyncInterval: 5000,
		startupSyncDelay: 5000,
		startupSyncEnabled: false,
		unmergeableStrategy: UnmergeableStrategy.LatestTimeStamp,
		useGitStyle: false,
	};

	async onload() {
		Object.assign(this.settings, await this.loadData());
		this.context = createContext(allModules, {
			assign: { settings: this.settings },
			injectKeys: ['settings', 'i18n'],
			mergeKeys: ['settings', 'root', 'events', 'i18n'],
			preMerge: {
				addCommand: this.addCommand.bind(this),
				addRibbonIcon: this.addRibbonIcon.bind(this),
				addStatusBarItem: this.addStatusBarItem.bind(this),
				app: this.app,
				registerEvent: this.registerEvent.bind(this),
			},
		});
		this.context.loadI18n(getLanguage() as ObsidianLanguageCode);
		this.context.addSettingTab(this);
		for (const module of allModules) {
			const instance = this.context.__getModule__(module);
			if ('start' in instance) instance.start();
		}
	}

	onunload() {
		if (!this.context) return;
		for (const module of allModules.toReversed()) {
			const instance = this.context.__getModule__(module);
			if ('dispose' in instance) instance.dispose();
		}
		this.context = undefined;
	}

	readonly saveSettings = async () => await this.saveData(this.settings);
}
