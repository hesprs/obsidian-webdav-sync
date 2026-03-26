import { clamp, isNil } from 'lodash-es';
import { Notice, Setting } from 'obsidian';
import i18n from '~/i18n';
import { ConflictStrategy } from '~/sync/tasks/conflict-resolve.task';
import { SyncMode } from './index';
import BaseSettings from './settings.base';

export default class CommonSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(i18n.t('settings.sections.common')).setHeading();

		new Setting(this.containerEl)
			.setName(i18n.t('settings.conflictStrategy.name'))
			.setDesc(i18n.t('settings.conflictStrategy.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						ConflictStrategy.DiffMatchPatch,
						i18n.t('settings.conflictStrategy.diffMatchPatch'),
					)
					.addOption(
						ConflictStrategy.LatestTimeStamp,
						i18n.t('settings.conflictStrategy.latestTimestamp'),
					)
					.addOption(
						ConflictStrategy.KeepLocal,
						i18n.t('settings.conflictStrategy.keepLocal'),
					)
					.addOption(
						ConflictStrategy.KeepRemote,
						i18n.t('settings.conflictStrategy.keepRemote'),
					)
					.addOption(ConflictStrategy.Skip, i18n.t('settings.conflictStrategy.skip'))
					.setValue(this.plugin.settings.conflictStrategy)
					.onChange(async (value) => {
						this.plugin.settings.conflictStrategy = value as ConflictStrategy;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useGitStyle.name'))
			.setDesc(i18n.t('settings.useGitStyle.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useGitStyle).onChange(async (value) => {
					this.plugin.settings.useGitStyle = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.showSyncStatusInNotificationOnMobile.name'))
			.setDesc(i18n.t('settings.showSyncStatusInNotificationOnMobile.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSyncStatusInNotificationOnMobile)
					.onChange(async (value) => {
						this.plugin.settings.showSyncStatusInNotificationOnMobile = value;
						await this.plugin.saveSettings();
						this.plugin.observabilityService.syncMobileNoticeWithSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.confirmBeforeSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmBeforeSync).onChange(async (value) => {
					this.plugin.settings.confirmBeforeSync = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.confirmBeforeDeleteInAutoSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeDeleteInAutoSync.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeDeleteInAutoSync)
					.onChange(async (value) => {
						this.plugin.settings.confirmBeforeDeleteInAutoSync = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.realtimeSync.name'))
			.setDesc(i18n.t('settings.realtimeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.realtimeSync).onChange(async (value) => {
					this.plugin.settings.realtimeSync = value;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useFastSyncOnLocalChange.name'))
			.setDesc(i18n.t('settings.useFastSyncOnLocalChange.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.useFastSyncOnLocalChange)
					.onChange(async (value) => {
						this.plugin.settings.useFastSyncOnLocalChange = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.startupSyncDelay.name'))
			.setDesc(i18n.t('settings.startupSyncDelay.desc'))
			.addText((text) => {
				const MAX_SECONDS = 86400; // 1 day
				text.setPlaceholder(i18n.t('settings.startupSyncDelay.placeholder'))
					.setValue(this.plugin.settings.startupSyncDelaySeconds.toString())
					.onChange(async (value) => {
						const numValue = parseFloat(value);
						if (!isNaN(numValue)) {
							const clampedValue = clamp(numValue, 0, MAX_SECONDS);
							this.plugin.settings.startupSyncDelaySeconds = clampedValue;
							await this.plugin.saveSettings();
							if (clampedValue !== numValue) {
								new Notice(
									i18n.t('settings.startupSyncDelay.exceedsMax', {
										max: MAX_SECONDS,
									}),
								);
								text.setValue(clampedValue.toString());
							}
						}
					});
				text.inputEl.addEventListener('blur', async () => {
					const numValue = parseFloat(text.getValue());
					const finalValue = isNaN(numValue) ? 0 : clamp(numValue, 0, MAX_SECONDS);

					if (isNaN(numValue)) {
						new Notice(i18n.t('settings.startupSyncDelay.invalidValue'));
					} else if (finalValue !== numValue) {
						new Notice(
							i18n.t('settings.startupSyncDelay.exceedsMax', {
								max: MAX_SECONDS,
							}),
						);
					}

					text.setValue(finalValue.toString());
					this.plugin.settings.startupSyncDelaySeconds = finalValue;
					await this.plugin.saveSettings();
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = MAX_SECONDS.toString();
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.scheduledSyncInterval.name'))
			.setDesc(i18n.t('settings.scheduledSyncInterval.desc'))
			.addText((text) => {
				const MAX_MINUTES = 1440; // 1 day
				text.setPlaceholder(i18n.t('settings.scheduledSyncInterval.placeholder'))
					.setValue(
						Math.round(
							this.plugin.settings.scheduledSyncIntervalSeconds / 60,
						).toString(),
					)
					.onChange(async (value) => {
						const numValue = parseFloat(value);
						if (!isNaN(numValue)) {
							const clampedValue = clamp(numValue, 0, MAX_MINUTES);
							this.plugin.settings.scheduledSyncIntervalSeconds = clampedValue * 60;
							await this.plugin.saveSettings();
							await this.plugin.scheduledSyncService.updateInterval();
							if (clampedValue !== numValue) {
								new Notice(
									i18n.t('settings.scheduledSyncInterval.exceedsMax', {
										max: MAX_MINUTES,
									}),
								);
								text.setValue(clampedValue.toString());
							}
						}
					});
				text.inputEl.addEventListener('blur', async () => {
					const numValue = parseFloat(text.getValue());
					const finalValue = isNaN(numValue)
						? 0
						: Math.round(clamp(numValue, 0, MAX_MINUTES));
					text.setValue(finalValue.toString());

					if (isNaN(numValue)) {
						new Notice(i18n.t('settings.scheduledSyncInterval.invalidValue'));
					} else if (finalValue !== numValue) {
						new Notice(
							i18n.t('settings.scheduledSyncInterval.exceedsMax', {
								max: MAX_MINUTES,
							}),
						);
					}

					this.plugin.settings.scheduledSyncIntervalSeconds = finalValue * 60;
					await this.plugin.saveSettings();
					await this.plugin.scheduledSyncService.updateInterval();
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = MAX_MINUTES.toString();
				text.inputEl.step = '1';
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.syncMode.name'))
			.setDesc(i18n.t('settings.syncMode.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption(SyncMode.STRICT, i18n.t('settings.syncMode.strict'))
					.addOption(SyncMode.LOOSE, i18n.t('settings.syncMode.loose'))
					.setValue(this.plugin.settings.syncMode)
					.onChange(async (value: string) => {
						this.plugin.settings.syncMode = value as SyncMode;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.clearRecord.name'))
			.setDesc(i18n.t('settings.clearRecord.desc'))
			.addButton((button) =>
				button.setButtonText(i18n.t('settings.clearRecord.button')).onClick(async () => {
					await this.plugin.syncStateStore.clear();
					new Notice(i18n.t('settings.clearRecord.cleared'));
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.language.name'))
			.setDesc(i18n.t('settings.language.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('', i18n.t('settings.language.auto'))
					.addOption('zh-Hans', '简体中文')
					.addOption('en', 'English')
					.setValue(this.plugin.settings.language || '')
					.onChange(async (value: string) => {
						if (value === 'zh-Hans' || value === 'en' || value === '' || isNil(value)) {
							this.plugin.settings.language = value || undefined;
							await this.plugin.saveSettings();
							await this.plugin.i18nService.update();
							this.settings.display();
						}
					}),
			);
	}
}
