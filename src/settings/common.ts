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
						this.plugin.settings.conflictStrategy = value as ConflictStrategy;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useGitStyle.name'))
			.setDesc(i18n.t('settings.useGitStyle.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useGitStyle).onChange((value) => {
					this.plugin.settings.useGitStyle = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.showSyncStatusInNotificationOnMobile.name'))
			.setDesc(i18n.t('settings.showSyncStatusInNotificationOnMobile.desc'))
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
			.setName(i18n.t('settings.confirmBeforeSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.confirmBeforeSync).onChange((value) => {
					this.plugin.settings.confirmBeforeSync = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.confirmBeforeDeleteInAutoSync.name'))
			.setDesc(i18n.t('settings.confirmBeforeDeleteInAutoSync.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.confirmBeforeDeleteInAutoSync)
					.onChange((value) => {
						this.plugin.settings.confirmBeforeDeleteInAutoSync = value;
						void this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.realtimeSync.name'))
			.setDesc(i18n.t('settings.realtimeSync.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.realtimeSync).onChange((value) => {
					this.plugin.settings.realtimeSync = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.useFastSyncOnLocalChange.name'))
			.setDesc(i18n.t('settings.useFastSyncOnLocalChange.desc'))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useFastSyncOnLocalChange).onChange((value) => {
					this.plugin.settings.useFastSyncOnLocalChange = value;
					void this.plugin.saveSettings();
				}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.startupSyncDelay.name'))
			.setDesc(i18n.t('settings.startupSyncDelay.desc'))
			.addText((text) => {
				const maxSeconds = 86400;
				text.setPlaceholder(i18n.t('settings.startupSyncDelay.placeholder')).setValue(
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
			.setName(i18n.t('settings.scheduledSyncInterval.name'))
			.setDesc(i18n.t('settings.scheduledSyncInterval.desc'))
			.addText((text) => {
				const maxMinutes = 1440;
				text.setPlaceholder(i18n.t('settings.scheduledSyncInterval.placeholder')).setValue(
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
			.setName(i18n.t('settings.syncMode.name'))
			.setDesc(i18n.t('settings.syncMode.desc'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption(SyncMode.STRICT, i18n.t('settings.syncMode.strict'))
					.addOption(SyncMode.LOOSE, i18n.t('settings.syncMode.loose'))
					.setValue(this.plugin.settings.syncMode)
					.onChange((value) => {
						this.plugin.settings.syncMode = value as SyncMode;
						void this.plugin.saveSettings();
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
					.addOption('ru', 'Русский')
					.setValue(this.plugin.settings.language || '')
					.onChange((value) => {
						if (
							value === 'zh-Hans' ||
							value === 'en' ||
							value === 'ru' ||
							value === '' ||
							isNil(value)
						)
							void this.updateLanguage(value);
					}),
			);
	}

	private handleStartupSyncDelayBlur(text: TextComponent, maxSeconds: number) {
		const numValue = parseFloat(text.getValue());
		const finalValue = isNaN(numValue) ? 0 : clamp(numValue, 0, maxSeconds);

		if (isNaN(numValue)) {
			new Notice(i18n.t('settings.startupSyncDelay.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(i18n.t('settings.startupSyncDelay.exceedsMax', { max: maxSeconds }));
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
			new Notice(i18n.t('settings.scheduledSyncInterval.invalidValue'));
		} else if (finalValue !== numValue) {
			new Notice(i18n.t('settings.scheduledSyncInterval.exceedsMax', { max: maxMinutes }));
		}

		this.plugin.settings.scheduledSyncIntervalSeconds = finalValue * 60;
		await this.plugin.saveSettings();
		await this.plugin.scheduledSyncService.updateInterval();
	}

	private async updateLanguage(value: string) {
		this.plugin.settings.language = value ? (value as 'zh-Hans' | 'en') : undefined;
		await this.plugin.saveSettings();
		await this.plugin.i18nService.update();
		this.settings.display();
	}
}
