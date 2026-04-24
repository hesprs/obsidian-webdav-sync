import { Setting } from 'obsidian';
import t from '~/i18n';
import { ConflictStrategy, UnmergeableStrategy } from '.';
import generateSettingEntry, { UserInputType } from './generate-setting-entry';
import BaseSettings from './settings.base';

export default class CommonSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.common')).setHeading();

		new Setting(this.containerEl)
			.setName(t('settings.conflictStrategy.name'))
			.setDesc(t('settings.conflictStrategy.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						ConflictStrategy.DiffMatchPatch,
						t('settings.conflictStrategy.diffMatchPatch'),
					)
					.addOption(
						ConflictStrategy.LatestTimeStamp,
						t('settings.conflictStrategy.latestTimestamp'),
					)
					.addOption(ConflictStrategy.KeepLocal, t('settings.conflictStrategy.keepLocal'))
					.addOption(
						ConflictStrategy.KeepRemote,
						t('settings.conflictStrategy.keepRemote'),
					)
					.addOption(ConflictStrategy.Skip, t('settings.conflictStrategy.skip'))
					.setValue(this.plugin.settings.conflictStrategy)
					.onChange((value) => {
						const originalValue = this.plugin.settings.conflictStrategy;
						const newValue = value as ConflictStrategy;
						if (newValue !== originalValue) {
							this.plugin.settings.conflictStrategy = newValue;
							void this.plugin.saveSettings();
							if (
								(originalValue === ConflictStrategy.DiffMatchPatch) !==
								(newValue === ConflictStrategy.DiffMatchPatch)
							)
								this.display();
						}
					}),
			);

		if (this.plugin.settings.conflictStrategy === ConflictStrategy.DiffMatchPatch)
			new Setting(this.containerEl)
				.setName(t('settings.unmergeableStrategy.name'))
				.setDesc(t('settings.unmergeableStrategy.desc'))
				.addDropdown((dropdown) =>
					dropdown
						.addOption(
							UnmergeableStrategy.LatestTimeStamp,
							t('settings.conflictStrategy.latestTimestamp'),
						)
						.addOption(
							UnmergeableStrategy.KeepLocal,
							t('settings.conflictStrategy.keepLocal'),
						)
						.addOption(
							UnmergeableStrategy.KeepRemote,
							t('settings.conflictStrategy.keepRemote'),
						)
						.addOption(UnmergeableStrategy.Skip, t('settings.conflictStrategy.skip'))
						.setValue(this.plugin.settings.unmergeableStrategy)
						.onChange((value) => {
							this.plugin.settings.unmergeableStrategy = value as UnmergeableStrategy;
							void this.plugin.saveSettings();
						}),
				);

		new Setting(this.containerEl)
			.setName(t('settings.useGitStyle.name'))
			.setDesc(t('settings.useGitStyle.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useGitStyle).onChange((value) => {
					this.plugin.settings.useGitStyle = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.showSyncStatusInNotificationOnMobile.name'))
			.setDesc(t('settings.showSyncStatusInNotificationOnMobile.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSyncStatusInNotificationOnMobile)
					.onChange((value) => {
						this.plugin.settings.showSyncStatusInNotificationOnMobile = value;
						this.plugin.observabilityService.syncMobileNoticeWithSettings();
						void this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.confirmBeforeSync.name'))
			.setDesc(t('settings.confirmBeforeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmBeforeSync).onChange((value) => {
					this.plugin.settings.confirmBeforeSync = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.confirmBeforeDeleteInAutoSync.name'))
			.setDesc(t('settings.confirmBeforeDeleteInAutoSync.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeDeleteInAutoSync)
					.onChange((value) => {
						this.plugin.settings.confirmBeforeDeleteInAutoSync = value;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.fastRealtimeSync.name'))
			.setDesc(t('settings.fastRealtimeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.fastRealtimeSync).onChange((value) => {
					this.plugin.settings.fastRealtimeSync = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.exhaustiveRemoteTraversal.name'))
			.setDesc(t('settings.exhaustiveRemoteTraversal.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exhaustiveRemoteTraversal)
					.onChange((value) => {
						this.plugin.settings.exhaustiveRemoteTraversal = value;
						void this.plugin.saveSettings();
					}),
			);

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.realtimeSync.name'),
			desc: t('settings.realtimeSync.desc'),
			placeholder: t('settings.realtimeSync.placeholder'),
			field: this.plugin.settings.realtimeSync,
			type: UserInputType.Time,
			saveSettings: this.plugin.saveSettings,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.startupSync.name'),
			desc: t('settings.startupSync.desc'),
			placeholder: t('settings.startupSync.placeholder'),
			field: this.plugin.settings.startupSync,
			type: UserInputType.Time,
			saveSettings: this.plugin.saveSettings,
		});

		generateSettingEntry({
			container: this.containerEl,
			name: t('settings.scheduledSync.name'),
			desc: t('settings.scheduledSync.desc'),
			placeholder: t('settings.scheduledSync.placeholder'),
			field: this.plugin.settings.scheduledSync,
			type: UserInputType.Time,
			saveSettings: this.plugin.saveSettings,
			rejectZero: true,
		});
	}
}
