import { Setting } from 'obsidian';
import apiLimiter from '~/composable/api-limiter';
import t from '~/i18n';
import generateSettingEntry, { UserInputType } from './generate-setting-entry';
import BaseSettings from './settings.base';

export default class ControlsSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.control')).setHeading();

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.retry401.desc'),
			field: this.plugin.settings.retry401,
			name: t('settings.retry401.name'),
			placeholder: '10',
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Number,
		});

		generateSettingEntry({
			container: this.containerEl,
			desc: t('settings.retry401Interval.desc'),
			field: this.plugin.settings.retry401Interval,
			name: t('settings.retry401Interval.name'),
			placeholder: '30',
			rejectZero: true,
			saveSettings: this.plugin.saveSettings,
			type: UserInputType.Number,
		});

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
			onChange: (value) => (apiLimiter.maxConcurrency = value),
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
			onChange: (value) => (apiLimiter.minInterval = value),
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
