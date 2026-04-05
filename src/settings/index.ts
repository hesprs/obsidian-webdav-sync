import { App, PluginSettingTab } from 'obsidian';
import type WebDAVSyncPlugin from '~/index';
import type { GlobMatchOptions } from '~/utils/glob-match';
import { ConflictStrategy } from '~/sync/tasks/conflict-resolve.task';
import waitUntil from '~/utils/wait-until';
import AccountSettings from './account';
import CommonSettings from './common';
import ControlsSettings from './controls';
import DevelopmentSettings from './development';
import FilterSettings from './filter';

export enum SyncMode {
	STRICT = 'strict',
	LOOSE = 'loose',
}

export interface PluginSettings {
	serverUrl: string;
	account: string;
	credential: string;
	remoteDir: string;
	showSyncStatusInNotificationOnMobile: boolean;
	useGitStyle: boolean;
	conflictStrategy: ConflictStrategy;
	confirmBeforeSync: boolean;
	confirmBeforeDeleteInAutoSync: boolean;
	syncMode: SyncMode;
	filterRules: {
		exclusionRules: GlobMatchOptions[];
		inclusionRules: GlobMatchOptions[];
	};
	skipLargeFiles: {
		maxSize: string;
		bytes: number;
	};
	realtimeSync: boolean;
	realtimeSyncDelay: number;
	maxConcurrentWebDAVCalls: number;
	minTimeBetweenWebDAVCalls: number;
	useFastSyncOnLocalChange: boolean;
	startupSyncDelaySeconds: number;
	scheduledSyncIntervalSeconds: number;
	language?: 'zh-Hans' | 'en';
}

let pluginInstance: WebDAVSyncPlugin | null = null;

export function setPluginInstance(plugin: WebDAVSyncPlugin | null) {
	pluginInstance = plugin;
}

export function getPluginInstance() {
	return pluginInstance;
}

export function waitUntilPluginInstance() {
	return waitUntil(() => !!pluginInstance, 100);
}

export async function useSettings() {
	await waitUntilPluginInstance();
	return (pluginInstance as WebDAVSyncPlugin).settings;
}

export class SyncSettingTab extends PluginSettingTab {
	plugin: WebDAVSyncPlugin;
	accountSettings: AccountSettings;
	commonSettings: CommonSettings;
	filterSettings: FilterSettings;
	logSettings: DevelopmentSettings;
	controlsSettings: ControlsSettings;

	constructor(app: App, plugin: WebDAVSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.accountSettings = new AccountSettings(
			this.app,
			this.plugin,
			this,
			this.containerEl.createDiv(),
		);
		this.commonSettings = new CommonSettings(
			this.app,
			this.plugin,
			this,
			this.containerEl.createDiv(),
		);
		this.controlsSettings = new ControlsSettings(
			this.app,
			this.plugin,
			this,
			this.containerEl.createDiv(),
		);
		this.filterSettings = new FilterSettings(
			this.app,
			this.plugin,
			this,
			this.containerEl.createDiv(),
		);
		this.logSettings = new DevelopmentSettings(
			this.app,
			this.plugin,
			this,
			this.containerEl.createDiv(),
		);
	}

	display() {
		this.accountSettings.display();
		this.commonSettings.display();
		this.controlsSettings.display();
		this.filterSettings.display();
		this.logSettings.display();
	}
}
