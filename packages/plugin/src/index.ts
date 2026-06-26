import './global.css';
import type { Command, EventRef } from 'obsidian';
import type { Context as KernelContext, MergeSingleKey } from 'synthkernel';
import { App, getLanguage, Plugin } from 'obsidian';
import { createContext } from 'synthkernel';
import { ConflictStrategy, UnmergeableStrategy } from '@/types';
import type { ObsidianLanguageCode } from './modules/I18n';
import type { AddRibbonIcon } from './modules/Observability';
import type { GlobMatchOptions } from './types';
import Bootstrap from './modules/Bootstrap';
import EventBus from './modules/EventBus';
import Extensibility from './modules/Extensibility';
import I18n from './modules/I18n';
import Observability from './modules/Observability';
import ProgressModal from './modules/ProgressModal';
import Scheduler from './modules/Scheduler';
import SettingsModule from './modules/Settings';
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

const internalModules = [
	EventBus,
	Extensibility,
	SettingsModule,
	Storage,
	I18n,
	Sync,
	Observability,
	Scheduler,
	ProgressModal,
	Bootstrap,
] as const;

export type InternalModules = typeof internalModules;
export type Context = KernelContext<
	InternalModules,
	'settings' | 'root' | 'events' | 'i18n',
	{
		app: App;
		addCommand: (command: Command) => Command;
		registerEvent: (ref: EventRef) => void;
		addRibbonIcon: AddRibbonIcon;
		addStatusBarItem: () => HTMLElement;
		saveSettings: () => Promise<void>;
	}
>;
export type Events = MergeSingleKey<InternalModules, 'events'>;
export type Settings = MergeSingleKey<InternalModules, 'settings'>;
export type Translations = MergeSingleKey<InternalModules, 'i18n'>;

export default class SyncEngine extends Plugin {
	context?: Context;
	readonly settings: Settings = {
		confirmDeleteInAutoSync: true,
		confirmTasksInSync: true,
		conflictStrategy: ConflictStrategy.DiffMatchPatch,
		decider: 'bidirectional',
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
		maxFileSize: { enabled: false, value: 31_457_280 },
		maxMemoryConsumption: { enabled: true, value: 100 * 1024 ** 2 },
		maxRequestConcurrency: { enabled: true, value: 50 },
		minRequestInterval: { enabled: false, value: 0 },
		moduleSources: [],
		modules: {},
		noticeStatusOnMobile: true,
		realtimeSync: { enabled: false, value: 5000 },
		realtimeSyncFastMode: true,
		remoteFs: '',
		scheduledSync: { enabled: false, value: 5000 },
		startupSync: { enabled: false, value: 5000 },
		unmergeableStrategy: UnmergeableStrategy.LatestTimeStamp,
		useGitStyle: false,
	};

	async onload() {
		Object.assign(this.settings, await this.loadData());
		// https://github.com/microsoft/TypeScript/issues/62995
		const preMerge = {
			addCommand: this.addCommand.bind(this),
			addRibbonIcon: this.addRibbonIcon.bind(this),
			addStatusBarItem: this.addStatusBarItem.bind(this),
			app: this.app,
			registerEvent: this.registerEvent.bind(this),
			saveSettings: this.saveSettings,
		};
		this.context = createContext(internalModules, {
			injectKeys: ['settings', 'i18n'],
			mergeKeys: ['settings', 'root', 'events', 'i18n'],
			preMerge,
		}).__assign__({ settings: this.settings });
		this.context.loadI18n(getLanguage() as ObsidianLanguageCode);
		this.context.addSettingTab(this);
		for (const module of internalModules) {
			const instance = this.context.__getModule__(module);
			if ('start' in instance) await instance.start();
		}
	}

	onunload() {
		if (!this.context) return;
		this.context.unloadAllModules();
		for (const module of internalModules.toReversed()) {
			const instance = this.context.__getModule__(module);
			if ('dispose' in instance) instance.dispose();
		}
		this.context = undefined;
	}

	readonly saveSettings = async () => await this.saveData(this.settings);
}
