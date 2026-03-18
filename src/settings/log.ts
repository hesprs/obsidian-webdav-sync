import { Notice, Setting } from 'obsidian';
import i18n from '~/i18n';
import logger from '~/utils/logger';
import BaseSettings from './settings.base';

export default class LogSettings extends BaseSettings {
	async display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(i18n.t('settings.log.title')).setHeading();
		new Setting(this.containerEl)
			.setName(i18n.t('settings.log.name'))
			.setDesc(i18n.t('settings.log.desc'))
			.addButton((button) => {
				button.setButtonText(i18n.t('settings.log.saveToNote')).onClick(async () => {
					await this.saveLogsToNote();
				});
			});
		new Setting(this.containerEl)
			.setName(i18n.t('settings.log.clearName'))
			.setDesc(i18n.t('settings.log.clearDesc'))
			.addButton((button) => {
				button.setButtonText(i18n.t('settings.log.clear')).onClick(() => {
					logger.clear();
					new Notice(i18n.t('settings.log.cleared'));
				});
			});
	}

	async saveLogsToNote() {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const fileName = `webdav-sync-logs-${timestamp}.md`;
			const dirPath = 'webdav-sync/logs';
			const filePath = `${dirPath}/${fileName}`;
			const content = logger.exportMarkdownReport();

			const folderExists = this.app.vault.getFolderByPath(dirPath);
			if (!folderExists) {
				await this.app.vault.createFolder(dirPath);
			}

			const file = await this.app.vault.create(filePath, content);
			new Notice(i18n.t('settings.log.savedToNote', { fileName: filePath }));

			await this.app.workspace.getLeaf().openFile(file);
		} catch (error) {
			new Notice(i18n.t('settings.log.saveError'));
			logger.error('Failed to export support report', { error });
		}
	}
}
