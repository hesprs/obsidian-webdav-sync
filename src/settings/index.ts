import type WebDAVSyncPlugin from '~';
import { App, PluginSettingTab } from 'obsidian';
import type { GlobMatchOptions } from '~/utils/glob-match';
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

export interface PluginSettings {
	serverUrl: string;
	account: string;
	token: string;
	remoteDir: string;
	showSyncStatusInNotificationOnMobile: boolean;
	useGitStyle: boolean;
	conflictStrategy: ConflictStrategy;
	unmergeableStrategy: UnmergeableStrategy;
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
	maxConcurrentSyncTasks: number;
	minTimeBetweenWebDAVCalls: number;
	useFastSyncOnLocalChange: boolean;
	startupSyncDelaySeconds: number;
	scheduledSyncIntervalSeconds: number;
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
