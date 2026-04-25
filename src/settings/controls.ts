import { Setting } from 'obsidian';
import t from '~/i18n';
import generateSettingEntry, { UserInputType } from './generate-setting-entry';
import BaseSettings from './settings.base';

export default class ControlsSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.control')).setHeading();

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.skipLargeFiles.name'),
			desc: t('settings.skipLargeFiles.desc'),
			placeholder: t('settings.skipLargeFiles.placeholder'),
			field: this.plugin.settings.skipLargeFiles,
			type: UserInputType.FileSize,
			saveSettings: this.plugin.saveSettings,
			rejectZero: true,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.maxWebDAVConcurrency.name'),
			desc: t('settings.maxWebDAVConcurrency.desc'),
			placeholder: t('settings.maxWebDAVConcurrency.placeholder'),
			field: this.plugin.settings.maxWebDAVConcurrency,
			type: UserInputType.Number,
			saveSettings: this.plugin.saveSettings,
			rejectZero: true,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.maxSyncTaskConcurrency.name'),
			desc: t('settings.maxSyncTaskConcurrency.desc'),
			placeholder: t('settings.maxSyncTaskConcurrency.placeholder'),
			field: this.plugin.settings.maxSyncTaskConcurrency,
			type: UserInputType.Number,
			saveSettings: this.plugin.saveSettings,
			rejectZero: true,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.minWebDAVRequestInterval.name'),
			desc: t('settings.minWebDAVRequestInterval.desc'),
			placeholder: t('settings.minWebDAVRequestInterval.placeholder'),
			field: this.plugin.settings.minWebDAVRequestInterval,
			type: UserInputType.Time,
			saveSettings: this.plugin.saveSettings,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.maxThroughputConcurrency.name'),
			desc: t('settings.maxThroughputConcurrency.desc'),
			placeholder: t('settings.maxThroughputConcurrency.placeholder'),
			field: this.plugin.settings.maxThroughputConcurrency,
			type: UserInputType.FileSize,
			saveSettings: this.plugin.saveSettings,
			rejectZero: true,
		});
	}
}
