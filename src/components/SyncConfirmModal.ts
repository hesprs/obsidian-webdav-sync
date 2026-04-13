import type WebDAVSyncPlugin from '~';
import { Modal, Setting } from 'obsidian';
import t from '~/i18n';
import { launchManualSync } from '~/services/manual-sync.service';

export default class SyncConfirmModal extends Modal {
	constructor(private plugin: WebDAVSyncPlugin) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl } = this;
		const settings = this.plugin.settings;
		contentEl.empty();

		contentEl.createEl('h2', { text: t('sync.confirmModal.title') });
		const infoDiv = contentEl.createDiv({ cls: 'sync-info' });
		infoDiv.createEl('p', {
			text: t('sync.confirmModal.remoteDir', {
				dir: this.plugin.settings.remoteDir,
			}),
		});
		infoDiv.createEl('p', {
			text: t('sync.confirmModal.strategy', {
				strategy: t(`settings.conflictStrategy.${settings.conflictStrategy}`),
			}),
		});
		contentEl.createEl('p', { text: t('sync.confirmModal.message'), cls: 'pre-line' });

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText(t('sync.confirmModal.cancel')).onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(t('sync.confirmModal.confirm'))
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
