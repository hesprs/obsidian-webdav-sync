import { Notice, Setting } from 'obsidian';
import i18n from '~/i18n';
import { is503Error } from '~/utils/is-503-error';
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

	async display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(i18n.t('settings.sections.account')).setHeading();

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
	}

	async hide() {}

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
						} else if (error && is503Error(error)) {
							buttonEl.classList.add('error');
							buttonEl.textContent = i18n.t('sync.error.requestsTooFrequent');
							new Notice(i18n.t('sync.error.requestsTooFrequent'));
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
