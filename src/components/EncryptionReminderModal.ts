import type WebDAVSyncPlugin from '~';
import { Modal, Setting } from 'obsidian';
import t from '~/i18n';

type EncryptionReminderState = 'enabled' | 'disabled';

export default class EncryptionReminderModal extends Modal {
	constructor(
		plugin: WebDAVSyncPlugin,
		private readonly state: EncryptionReminderState,
	) {
		super(plugin.app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(
			t(
				this.state === 'enabled'
					? 'settings.encryption.reminderModal.titleEnabled'
					: 'settings.encryption.reminderModal.titleDisabled',
			),
		);

		contentEl.createEl('p', {
			cls: 'whitespace-pre-wrap',
			text: t(
				this.state === 'enabled'
					? 'settings.encryption.reminderModal.messageEnabled'
					: 'settings.encryption.reminderModal.messageDisabled',
			),
		});

		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(t('settings.encryption.reminderModal.acknowledge'))
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onClose() {
		this.contentEl.empty();
	}
}
