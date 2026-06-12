import type { App } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import { PluginSettingTab } from 'obsidian';
import AccountSettings from './account';
import CommonSettings from './common';
import ControlsSettings from './controls';
import DevelopmentSettings from './development';
import FilterSettings from './filter';

export default class SyncSettingTab extends PluginSettingTab {
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
