import { clamp, isNil } from 'lodash-es';
import { Notice, Setting, TextComponent } from 'obsidian';
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
					.onChange((value) => {
						this.saveSettingsTask(() => {
							this.plugin.settings.conflictStrategy = value as ConflictStrategy;
						}, 'Failed to save conflict strategy setting');
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useGitStyle.name'))
			.setDesc(i18n.t('settings.useGitStyle.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useGitStyle).onChange((value) => {
					this.saveSettingsTask(() => {
						this.plugin.settings.useGitStyle = value;
					}, 'Failed to save git-style setting');
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.showSyncStatusInNotificationOnMobile.name'))
			.setDesc(i18n.t('settings.showSyncStatusInNotificationOnMobile.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSyncStatusInNotificationOnMobile)
					.onChange((value) => {
						this.saveSettingsTask(
							() => {
								this.plugin.settings.showSyncStatusInNotificationOnMobile = value;
							},
							'Failed to save mobile notification setting',
							() => {
								this.plugin.observabilityService.syncMobileNoticeWithSettings();
							},
						);
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.confirmBeforeSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmBeforeSync).onChange((value) => {
					this.saveSettingsTask(() => {
						this.plugin.settings.confirmBeforeSync = value;
					}, 'Failed to save manual confirmation setting');
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.confirmBeforeDeleteInAutoSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeDeleteInAutoSync.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeDeleteInAutoSync)
					.onChange((value) => {
						this.saveSettingsTask(() => {
							this.plugin.settings.confirmBeforeDeleteInAutoSync = value;
						}, 'Failed to save auto-delete confirmation setting');
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.realtimeSync.name'))
			.setDesc(i18n.t('settings.realtimeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.realtimeSync).onChange((value) => {
					this.saveSettingsTask(() => {
						this.plugin.settings.realtimeSync = value;
					}, 'Failed to save realtime sync setting');
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useFastSyncOnLocalChange.name'))
			.setDesc(i18n.t('settings.useFastSyncOnLocalChange.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useFastSyncOnLocalChange).onChange((value) => {
					this.saveSettingsTask(() => {
						this.plugin.settings.useFastSyncOnLocalChange = value;
					}, 'Failed to save fast-sync setting');
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.startupSyncDelay.name'))
			.setDesc(i18n.t('settings.startupSyncDelay.desc'))
			.addText((text) => {
				const maxSeconds = 86400;
				text.setPlaceholder(i18n.t('settings.startupSyncDelay.placeholder'))
					.setValue(this.plugin.settings.startupSyncDelaySeconds.toString())
					.onChange((value) => {
						this.handleStartupSyncDelayChange(value, text, maxSeconds);
					});
				text.inputEl.addEventListener('blur', () => {
					this.runAsyncTask(
						() => this.handleStartupSyncDelayBlur(text, maxSeconds),
						'Failed to save startup sync delay setting',
					);
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = maxSeconds.toString();
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.scheduledSyncInterval.name'))
			.setDesc(i18n.t('settings.scheduledSyncInterval.desc'))
			.addText((text) => {
				const maxMinutes = 1440;
				text.setPlaceholder(i18n.t('settings.scheduledSyncInterval.placeholder'))
					.setValue(
						Math.round(
							this.plugin.settings.scheduledSyncIntervalSeconds / 60,
						).toString(),
					)
					.onChange((value) => {
						this.handleScheduledSyncIntervalChange(value, text, maxMinutes);
					});
				text.inputEl.addEventListener('blur', () => {
					this.runAsyncTask(
						() => this.handleScheduledSyncIntervalBlur(text, maxMinutes),
						'Failed to save scheduled sync interval setting',
					);
				});
				text.inputEl.type = 'number';
				text.inputEl.min = '0';
				text.inputEl.max = maxMinutes.toString();
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
					.onChange((value) => {
						this.saveSettingsTask(() => {
							this.plugin.settings.syncMode = value as SyncMode;
						}, 'Failed to save sync mode setting');
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.clearRecord.name'))
			.setDesc(i18n.t('settings.clearRecord.desc'))
			.addButton((button) =>
				button.setButtonText(i18n.t('settings.clearRecord.button')).onClick(() => {
					this.runAsyncTask(() => this.clearRecords(), 'Failed to clear sync records');
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
					.onChange((value) => {
						if (value === 'zh-Hans' || value === 'en' || value === '' || isNil(value)) {
							this.runAsyncTask(
								() => this.updateLanguage(value),
								'Failed to update language setting',
							);
						}
					}),
			);
	}

	private handleStartupSyncDelayChange(value: string, text: TextComponent, maxSeconds: number) {
		const numValue = parseFloat(value);
		if (isNaN(numValue)) return;

		const clampedValue = clamp(numValue, 0, maxSeconds);
		this.saveSettingsTask(() => {
			this.plugin.settings.startupSyncDelaySeconds = clampedValue;
		}, 'Failed to save startup sync delay setting');

		if (clampedValue !== numValue) {
			new Notice(i18n.t('settings.startupSyncDelay.exceedsMax', { max: maxSeconds }));
			text.setValue(clampedValue.toString());
		}
	}

	private async handleStartupSyncDelayBlur(text: TextComponent, maxSeconds: number) {
		const numValue = parseFloat(text.getValue());
		const finalValue = isNaN(numValue) ? 0 : clamp(numValue, 0, maxSeconds);

		if (isNaN(numValue)) {
			new Notice(i18n.t('settings.startupSyncDelay.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(i18n.t('settings.startupSyncDelay.exceedsMax', { max: maxSeconds }));
		}

		text.setValue(finalValue.toString());
		this.plugin.settings.startupSyncDelaySeconds = finalValue;
		await this.plugin.saveSettings();
	}

	private handleScheduledSyncIntervalChange(
		value: string,
		text: TextComponent,
		maxMinutes: number,
	) {
		const numValue = parseFloat(value);
		if (isNaN(numValue)) return;

		const clampedValue = clamp(numValue, 0, maxMinutes);
		this.saveSettingsTask(
			() => {
				this.plugin.settings.scheduledSyncIntervalSeconds = clampedValue * 60;
			},
			'Failed to save scheduled sync interval setting',
			() => this.plugin.scheduledSyncService.updateInterval(),
		);

		if (clampedValue !== numValue) {
			new Notice(i18n.t('settings.scheduledSyncInterval.exceedsMax', { max: maxMinutes }));
			text.setValue(clampedValue.toString());
		}
	}

	private async handleScheduledSyncIntervalBlur(text: TextComponent, maxMinutes: number) {
		const numValue = parseFloat(text.getValue());
		const finalValue = isNaN(numValue) ? 0 : Math.round(clamp(numValue, 0, maxMinutes));
		text.setValue(finalValue.toString());

		if (isNaN(numValue)) {
			new Notice(i18n.t('settings.scheduledSyncInterval.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(i18n.t('settings.scheduledSyncInterval.exceedsMax', { max: maxMinutes }));
		}

		this.plugin.settings.scheduledSyncIntervalSeconds = finalValue * 60;
		await this.plugin.saveSettings();
		await this.plugin.scheduledSyncService.updateInterval();
	}

	private async clearRecords() {
		await this.plugin.syncStateStore.clear();
		new Notice(i18n.t('settings.clearRecord.cleared'));
	}

	private async updateLanguage(value: string) {
		this.plugin.settings.language = value ? (value as 'zh-Hans' | 'en') : undefined;
		await this.plugin.saveSettings();
		await this.plugin.i18nService.update();
		this.settings.display();
	}
}
