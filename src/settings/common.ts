import { clamp } from 'lodash-es';
import { Notice, Setting, TextComponent } from 'obsidian';
import t from '~/i18n';
import { ConflictStrategy, SyncMode, UnmergeableStrategy } from '.';
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
			.setName(t('settings.realtimeSync.name'))
			.setDesc(t('settings.realtimeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.realtimeSync).onChange((value) => {
					this.plugin.settings.realtimeSync = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.useFastSyncOnLocalChange.name'))
			.setDesc(t('settings.useFastSyncOnLocalChange.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useFastSyncOnLocalChange).onChange((value) => {
					this.plugin.settings.useFastSyncOnLocalChange = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(t('settings.startupSyncDelay.name'))
			.setDesc(t('settings.startupSyncDelay.desc'))
			.addText((text) => {
				const maxSeconds = 86400;
				text.setPlaceholder(t('settings.startupSyncDelay.placeholder')).setValue(
					this.plugin.settings.startupSyncDelaySeconds.toString(),
				);
				text.inputEl.addEventListener('blur', () => {
					this.handleStartupSyncDelayBlur(text, maxSeconds);
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = maxSeconds.toString();
			});

		new Setting(this.containerEl)
			.setName(t('settings.scheduledSyncInterval.name'))
			.setDesc(t('settings.scheduledSyncInterval.desc'))
			.addText((text) => {
				const maxMinutes = 1440;
				text.setPlaceholder(t('settings.scheduledSyncInterval.placeholder')).setValue(
					Math.round(this.plugin.settings.scheduledSyncIntervalSeconds / 60).toString(),
				);
				text.inputEl.addEventListener(
					'blur',
					() => void this.handleScheduledSyncIntervalBlur(text, maxMinutes),
				);
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = maxMinutes.toString();
				text.inputEl.step = '1';
			});

		new Setting(this.containerEl)
			.setName(t('settings.syncMode.name'))
			.setDesc(t('settings.syncMode.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption(SyncMode.STRICT, t('settings.syncMode.strict'))
					.addOption(SyncMode.LOOSE, t('settings.syncMode.loose'))
					.setValue(this.plugin.settings.syncMode)
					.onChange((value) => {
						this.plugin.settings.syncMode = value as SyncMode;
						void this.plugin.saveSettings();
					}),
			);
	}

	private handleStartupSyncDelayBlur(text: TextComponent, maxSeconds: number) {
		const numValue = parseFloat(text.getValue());
		const finalValue = isNaN(numValue) ? 0 : clamp(numValue, 0, maxSeconds);

		if (isNaN(numValue)) {
			new Notice(t('settings.startupSyncDelay.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(t('settings.startupSyncDelay.exceedsMax', { max: maxSeconds }));
		}

		text.setValue(finalValue.toString());
		if (this.plugin.settings.startupSyncDelaySeconds !== finalValue) {
			this.plugin.settings.startupSyncDelaySeconds = finalValue;
			void this.plugin.saveSettings();
		}
	}

	private async handleScheduledSyncIntervalBlur(text: TextComponent, maxMinutes: number) {
		const numValue = parseFloat(text.getValue());
		const finalValue = isNaN(numValue) ? 0 : Math.round(clamp(numValue, 0, maxMinutes));
		text.setValue(finalValue.toString());

		if (isNaN(numValue)) {
			new Notice(t('settings.scheduledSyncInterval.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(t('settings.scheduledSyncInterval.exceedsMax', { max: maxMinutes }));
		}

		this.plugin.settings.scheduledSyncIntervalSeconds = finalValue * 60;
		await this.plugin.saveSettings();
		await this.plugin.scheduledSyncService.updateInterval();
	}
}
