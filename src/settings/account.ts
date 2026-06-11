import type { TextComponent } from 'obsidian';
import { Notice, SecretComponent, Setting } from 'obsidian';
import EncryptionReminderModal from '~/components/EncryptionReminderModal';
import SelectRemoteBaseDirModal from '~/components/SelectRemoteBaseDirModal';
import t from '~/i18n';
import { normalizeBaseDir } from '~/platform/path';
import { createWebdavFs } from '~/utils/fs-factory';
import handleInput from '~/utils/handle-input';
import BaseSettings from './settings.base';

export default class AccountSettings extends BaseSettings {
	display() {
		let remoteBaseDirText: TextComponent | undefined;
		this.containerEl.empty();
		new Setting(this.containerEl)
			.setName(t('settings.tips.name'))
			.setDesc(t('settings.tips.desc'))
			.setClass('whitespace-pre-line');

		new Setting(this.containerEl)
			.setName(t('settings.serverUrl.name'))
			.setDesc(t('settings.serverUrl.desc'))
			.addText((text) => {
				text.setPlaceholder(t('settings.serverUrl.placeholder')).setValue(
					this.plugin.settings.serverUrl,
				);
				handleInput({
					field: 'serverUrl',
					plugin: this.plugin,
					processValue: (value) => {
						let parsedUrl: URL;
						try {
							parsedUrl = new URL(value);
						} catch {
							return false;
						}
						if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
						return parsedUrl.toString().replace(/\/+$/, '');
					},
					text,
				});
			});

		new Setting(this.containerEl)
			.setName(t('settings.account.name'))
			.setDesc(t('settings.account.desc'))
			.addText((text) => {
				text.setPlaceholder(t('settings.account.placeholder')).setValue(
					this.plugin.settings.account,
				);
				handleInput({
					field: 'account',
					plugin: this.plugin,
					processValue: (value) => value.trim(),
					text,
				});
			});

		new Setting(this.containerEl)
			.setName(t('settings.credential.name'))
			.setDesc(t('settings.credential.desc'))
			.addComponent((element) =>
				new SecretComponent(this.app, element)
					.setValue(this.plugin.settings.token)
					.onChange((token) => {
						if (this.plugin.settings.token !== token) {
							this.plugin.settings.token = token;
							void this.plugin.saveSettings();
						}
					}),
			);

		this.displayCheckConnection();

		new Setting(this.containerEl)
			.setName(t('settings.remoteDir.name'))
			.setDesc(t('settings.remoteDir.desc'))
			.addText((text) => {
				remoteBaseDirText = text;
				text.setPlaceholder(t('settings.remoteDir.placeholder')).setValue(
					this.plugin.settings.remoteDir,
				);
				handleInput({
					field: 'remoteDir',
					plugin: this.plugin,
					processValue: (original) => normalizeBaseDir(original.trim()),
					text,
				});
			})
			.addButton((button) => {
				button.setIcon('folder').onClick(() => {
					if (!this.plugin.isAccountConfigured()) {
						new Notice(t('sync.error.accountNotConfigured'));
						return;
					}
					new SelectRemoteBaseDirModal(this.app, this.plugin, (path) => {
						if (path === this.plugin.settings.remoteDir) return;
						this.plugin.settings.remoteDir = path;
						remoteBaseDirText?.setValue(path);
						void this.plugin.saveSettings();
					}).open();
				});
			});

		new Setting(this.containerEl)
			.setName(t('settings.encryption.name'))
			.setDesc(t('settings.encryption.desc'))
			.addComponent((element) =>
				new SecretComponent(this.app, element)
					.setValue(this.plugin.settings.encryption.value)
					.onChange((value) => {
						if (this.plugin.settings.encryption.value !== value) {
							this.plugin.settings.encryption.value = value;
							void this.plugin.saveSettings();
						}
					}),
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.encryption.enabled);
				toggle.onChange((enabled) => {
					if (this.plugin.settings.encryption.enabled !== enabled) {
						this.plugin.settings.encryption.enabled = enabled;
						void this.plugin.saveSettings();
						new EncryptionReminderModal(
							this.plugin,
							enabled ? 'enabled' : 'disabled',
						).open();
					}
				});
			});
	}

	private displayCheckConnection() {
		new Setting(this.containerEl)
			.setName(t('settings.checkConnection.name'))
			.setDesc(t('settings.checkConnection.desc'))
			.addButton((button) => {
				button.setButtonText(t('settings.checkConnection.name')).onClick((event) => {
					const buttonEl = event.currentTarget;
					if (!(buttonEl instanceof HTMLElement)) return;
					void this.checkConnection(buttonEl);
				});
			});
	}

	private async checkConnection(buttonEl: HTMLElement) {
		buttonEl.classList.add('connection-button', 'loading');
		buttonEl.classList.remove('success', 'error');
		buttonEl.textContent = t('settings.checkConnection.name');
		try {
			const result = await createWebdavFs(this.plugin).checkConnection();
			buttonEl.classList.remove('loading');
			if (result.success) {
				buttonEl.classList.add('success');
				buttonEl.textContent = t('settings.checkConnection.successButton');
				new Notice(t('settings.checkConnection.success'));
				return;
			}

			buttonEl.classList.add('error');
			buttonEl.textContent = t('settings.checkConnection.failureButton');
			new Notice(
				result.reason
					? t('settings.checkConnection.failureWithReason', { reason: result.reason })
					: t('settings.checkConnection.failure'),
			);
		} catch {
			buttonEl.classList.remove('loading');
			buttonEl.classList.add('error');
			buttonEl.textContent = t('settings.checkConnection.failureButton');
			new Notice(t('settings.checkConnection.failure'));
		}
	}
}
