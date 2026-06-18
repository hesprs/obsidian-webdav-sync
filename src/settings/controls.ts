import { Setting } from 'obsidian';
import t from '~/i18n';
import { UserInputType, generateSettingEntry } from './generate-setting-entry';
import BaseSettings from './settings.base';

export default class ControlsSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.control')).setHeading();

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.skipLargeFiles.desc'),
			field: this.plugin.settings.skipLargeFiles,
			name: t('settings.skipLargeFiles.name'),
			placeholder: t('settings.skipLargeFiles.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.FileSize,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.maxRequestConcurrency.desc'),
			field: this.plugin.settings.maxRequestConcurrency,
			name: t('settings.maxRequestConcurrency.name'),
			placeholder: t('settings.maxRequestConcurrency.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Number,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.minRequestInterval.desc'),
			field: this.plugin.settings.minRequestInterval,
			name: t('settings.minRequestInterval.name'),
			placeholder: t('settings.minRequestInterval.placeholder'),
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Time,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.maxMemoryConsumption.desc'),
			field: this.plugin.settings.maxMemoryConsumption,
			name: t('settings.maxMemoryConsumption.name'),
			placeholder: t('settings.maxMemoryConsumption.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.FileSize,
		});
	}
}
