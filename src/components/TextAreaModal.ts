import { App, Modal, Notice, Setting } from 'obsidian';
import t from '~/i18n';

export default class TextAreaModal extends Modal {
	constructor(
		app: App,
		private text: string,
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;

		const textarea = contentEl.createEl('textarea', {
			cls: 'w-full h-50vh',
			text: this.text,
		});
		textarea.disabled = true;

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setCta()
					.setButtonText(t('textAreaModal.copy'))
					.onClick(() => {
						void navigator.clipboard.writeText(this.text).then(() => {
							new Notice(t('textAreaModal.copied'));
						});
					});
			})
			.addButton((button) => {
				button.setButtonText(t('textAreaModal.close')).onClick(() => {
					this.close();
				});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
