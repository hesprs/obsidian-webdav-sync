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
			desc: t('settings.maxWebDAVConcurrency.desc'),
			field: this.plugin.settings.maxWebDAVConcurrency,
			name: t('settings.maxWebDAVConcurrency.name'),
			placeholder: t('settings.maxWebDAVConcurrency.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Number,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.maxSyncTaskConcurrency.desc'),
			field: this.plugin.settings.maxSyncTaskConcurrency,
			name: t('settings.maxSyncTaskConcurrency.name'),
			placeholder: t('settings.maxSyncTaskConcurrency.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Number,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.minWebDAVRequestInterval.desc'),
			field: this.plugin.settings.minWebDAVRequestInterval,
			name: t('settings.minWebDAVRequestInterval.name'),
			placeholder: t('settings.minWebDAVRequestInterval.placeholder'),
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Time,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.maxThroughputConcurrency.desc'),
			field: this.plugin.settings.maxThroughputConcurrency,
			name: t('settings.maxThroughputConcurrency.name'),
			placeholder: t('settings.maxThroughputConcurrency.placeholder'),
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.FileSize,
		});
	}
}
