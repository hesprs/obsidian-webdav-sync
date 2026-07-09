import type { App } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import { PluginSettingTab } from 'obsidian';
import type { UserOptions } from '~/composable/glob-match';
import type { ToggleNumericSettingsField } from '~/types';
import AccountSettings from './account';
import CommonSettings from './common';
import ControlsSettings from './controls';
import DevelopmentSettings from './development';
import FilterSettings from './filter';

export * from './plugin-instance';

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
	customHeaders: Record<string, string>;
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
	v3Exists: boolean;
	neverShowV3Migration: boolean;
};

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
