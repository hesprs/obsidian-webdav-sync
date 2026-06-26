import type { SettingDefinitionItem } from 'obsidian';
import { Plugin, PluginSettingTab } from 'obsidian';

type SettingRegistryItem = {
	order: number;
	getDefinition: () => Array<SettingDefinitionItem>;
};

export default class Settings {
	private readonly settingRegistry = new Set<SettingRegistryItem>();

	private readonly addSettingTab = (plugin: Plugin) =>
		plugin.addSettingTab(new SettingTab(plugin, this.settingRegistry));

	private readonly registerSetting = (entry: SettingRegistryItem) => {
		this.settingRegistry.add(entry);
		return () => this.settingRegistry.delete(entry);
	};

	root = { addSettingTab: this.addSettingTab, registerSetting: this.registerSetting };
}

class SettingTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly settingRegistry: Set<SettingRegistryItem>,
	) {
		super(plugin.app, plugin);
	}

	getSettingDefinitions() {
		const validSettings: Record<number, () => Array<SettingDefinitionItem>> = {};
		for (const { order, getDefinition } of this.settingRegistry)
			validSettings[order] = getDefinition;
		return Object.values(validSettings).flatMap((get) => get());
	}
}
