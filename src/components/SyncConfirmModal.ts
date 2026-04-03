import { Modal, Setting } from 'obsidian';
import type WebDAVSyncPlugin from '../index';
import i18n from '../i18n';
import { launchManualSync } from '../services/manual-sync.service';

export default class SyncConfirmModal extends Modal {
	constructor(private plugin: WebDAVSyncPlugin) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl } = this;
		const settings = this.plugin.settings;
		contentEl.empty();

		contentEl.createEl('h2', { text: i18n.t('sync.confirmModal.title') });
		const infoDiv = contentEl.createDiv({ cls: 'sync-info' });
		infoDiv.createEl('p', {
			text: i18n.t('sync.confirmModal.remoteDir', {
				dir: this.plugin.remoteBaseDir,
			}),
		});
		infoDiv.createEl('p', {
			text: i18n.t('sync.confirmModal.strategy', {
				strategy: i18n.t(`settings.conflictStrategy.${settings.conflictStrategy}`),
			}),
		});
		contentEl.createEl('p', { text: i18n.t('sync.confirmModal.message'), cls: 'pre-line' });

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('sync.confirmModal.cancel'))
					.onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('sync.confirmModal.confirm'))
					.setCta()
					.onClick(() => {
						this.close();
						launchManualSync(this.plugin, { skipConfirmation: true });
					}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
