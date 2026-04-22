import { Notice, SecretComponent, Setting, TextComponent } from 'obsidian';
import SelectRemoteBaseDirModal from '~/components/SelectRemoteBaseDirModal';
import t from '~/i18n';
import { normalizeBaseDir } from '~/platform/path';
import handleInput from '~/utils/handle-input';
import BaseSettings from './settings.base';

export default class AccountSettings extends BaseSettings {
	private getNormalizedServerUrl(): string | null {
		const serverUrl = this.plugin.settings.serverUrl.trim().replace(/\/+$/, '');
		if (!serverUrl) return null;

		try {
			const parsedUrl = new URL(serverUrl);
			if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
			return parsedUrl.toString().replace(/\/+$/, '');
		} catch {
			return null;
		}
	}

	display() {
		let remoteBaseDirText: TextComponent | undefined;
		this.containerEl.empty();
		new Setting(this.containerEl)
			.setName(t('settings.backupWarning.name'))
			.setDesc(t('settings.backupWarning.desc'));

		new Setting(this.containerEl)
			.setName(t('settings.serverUrl.name'))
			.setDesc(t('settings.serverUrl.desc'))
			.addText((text) => {
				text.setPlaceholder(t('settings.serverUrl.placeholder')).setValue(
					this.plugin.settings.serverUrl,
				);
				text.inputEl.addEventListener('blur', () =>
					handleInput(text, this.plugin, 'serverUrl'),
				);
			});

		new Setting(this.containerEl)
			.setName(t('settings.account.name'))
			.setDesc(t('settings.account.desc'))
			.addText((text) => {
				text.setPlaceholder(t('settings.account.placeholder')).setValue(
					this.plugin.settings.account,
				);
				text.inputEl.addEventListener('blur', () =>
					handleInput(text, this.plugin, 'account'),
				);
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
				text.inputEl.addEventListener('blur', () => {
					handleInput(text, this.plugin, 'remoteDir', (original) =>
						normalizeBaseDir(original),
					);
					text.setValue(this.plugin.settings.remoteDir);
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
		const normalizedUrl = this.getNormalizedServerUrl();
		if (!normalizedUrl) {
			new Notice(t('settings.serverUrl.invalid'));
			return;
		}

		this.plugin.settings.serverUrl = normalizedUrl;
		await this.plugin.saveSettings();

		buttonEl.classList.add('connection-button', 'loading');
		buttonEl.classList.remove('success', 'error');
		buttonEl.textContent = t('settings.checkConnection.name');
		try {
			const { success, error } = await this.plugin.webDAVService.checkWebDAVConnection();
			buttonEl.classList.remove('loading');
			if (success) {
				buttonEl.classList.add('success');
				buttonEl.textContent = t('settings.checkConnection.successButton');
				new Notice(t('settings.checkConnection.success'));
				return;
			}

			buttonEl.classList.add('error');
			buttonEl.textContent = t('settings.checkConnection.failureButton');
			const reason = error?.message?.trim();
			new Notice(
				reason
					? t('settings.checkConnection.failureWithReason', { reason })
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
