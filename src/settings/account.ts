import { Notice, Setting } from 'obsidian';
import SelectRemoteBaseDirModal from '~/components/SelectRemoteBaseDirModal';
import i18n from '~/i18n';
import BaseSettings from './settings.base';

export default class AccountSettings extends BaseSettings {
	private getNormalizedServerUrl(): string | null {
		const serverUrl = this.plugin.settings.serverUrl.trim().replace(/\/+$/, '');
		if (!serverUrl) {
			return null;
		}

		try {
			const parsedUrl = new URL(serverUrl);
			if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
				return null;
			}
			return parsedUrl.toString().replace(/\/+$/, '');
		} catch {
			return null;
		}
	}

	display() {
		this.containerEl.empty();
		new Setting(this.containerEl)
			.setName(i18n.t('settings.backupWarning.name'))
			.setDesc(i18n.t('settings.backupWarning.desc'));

		new Setting(this.containerEl)
			.setName(i18n.t('settings.serverUrl.name'))
			.setDesc(i18n.t('settings.serverUrl.desc'))
			.addText((text) =>
				text
					.setPlaceholder(i18n.t('settings.serverUrl.placeholder'))
					.setValue(this.plugin.settings.serverUrl)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.account.name'))
			.setDesc(i18n.t('settings.account.desc'))
			.addText((text) =>
				text
					.setPlaceholder(i18n.t('settings.account.placeholder'))
					.setValue(this.plugin.settings.account)
					.onChange(async (value) => {
						this.plugin.settings.account = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.credential.name'))
			.setDesc(i18n.t('settings.credential.desc'))
			.addText((text) => {
				text.setPlaceholder(i18n.t('settings.credential.placeholder'))
					.setValue(this.plugin.settings.credential)
					.onChange(async (value) => {
						this.plugin.settings.credential = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		this.displayCheckConnection();

		new Setting(this.containerEl)
			.setName(i18n.t('settings.remoteDir.name'))
			.setDesc(i18n.t('settings.remoteDir.desc'))
			.addText((text) => {
				text.setPlaceholder(i18n.t('settings.remoteDir.placeholder'))
					.setValue(this.plugin.remoteBaseDir)
					.onChange(async (value) => {
						this.plugin.settings.remoteDir = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.addEventListener('blur', () => {
					this.plugin.settings.remoteDir = this.plugin.remoteBaseDir;
				});
			})
			.addButton((button) => {
				button.setIcon('folder').onClick(() => {
					// 检查账号配置
					if (!this.plugin.isAccountConfigured()) {
						new Notice(i18n.t('sync.error.accountNotConfigured'));
						return;
					}
					new SelectRemoteBaseDirModal(this.app, this.plugin, async (path) => {
						this.plugin.settings.remoteDir = path;
						await this.plugin.saveSettings();
					}).open();
				});
			});
	}

	private displayCheckConnection() {
		new Setting(this.containerEl)
			.setName(i18n.t('settings.checkConnection.name'))
			.setDesc(i18n.t('settings.checkConnection.desc'))
			.addButton((button) => {
				button.setButtonText(i18n.t('settings.checkConnection.name')).onClick(async (e) => {
					const normalizedUrl = this.getNormalizedServerUrl();
					if (!normalizedUrl) {
						new Notice(i18n.t('settings.serverUrl.invalid'));
						return;
					}
					this.plugin.settings.serverUrl = normalizedUrl;
					await this.plugin.saveSettings();

					const buttonEl = e.target as HTMLElement;
					buttonEl.classList.add('connection-button', 'loading');
					buttonEl.classList.remove('success', 'error');
					buttonEl.textContent = i18n.t('settings.checkConnection.name');
					try {
						const { success, error } =
							await this.plugin.webDAVService.checkWebDAVConnection();
						buttonEl.classList.remove('loading');
						if (success) {
							buttonEl.classList.add('success');
							buttonEl.textContent = i18n.t('settings.checkConnection.successButton');
							new Notice(i18n.t('settings.checkConnection.success'));
						} else {
							buttonEl.classList.add('error');
							buttonEl.textContent = i18n.t('settings.checkConnection.failureButton');
							const reason = error?.message?.trim();
							new Notice(
								reason
									? i18n.t('settings.checkConnection.failureWithReason', {
											reason,
										})
									: i18n.t('settings.checkConnection.failure'),
							);
						}
					} catch {
						buttonEl.classList.remove('loading');
						buttonEl.classList.add('error');
						buttonEl.textContent = i18n.t('settings.checkConnection.failureButton');
						new Notice(i18n.t('settings.checkConnection.failure'));
					}
				});
			});
	}
}
