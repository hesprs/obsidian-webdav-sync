import { Notice, Setting } from 'obsidian';
import i18n from '~/i18n';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import logger from '~/utils/logger';
import BaseSettings from './settings.base';

export default class DevelopmentSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(i18n.t('settings.development')).setHeading();

		new Setting(this.containerEl)
			.setName(i18n.t('settings.clearRecords.name'))
			.setDesc(i18n.t('settings.clearRecords.desc'))
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.clearRecords.vaultButton'))
					.onClick(() => void this.clearVaultRecords()),
			)
			.addButton((button) =>
				button
					.setButtonText(i18n.t('settings.clearRecords.allButton'))
					.onClick(() => void this.clearAllRecords()),
			);

		new Setting(this.containerEl)
			.setName(i18n.t('settings.log.name'))
			.setDesc(i18n.t('settings.log.desc'))
			.addButton((button) => {
				button.setButtonText(i18n.t('settings.log.saveToNote')).onClick(() => {
					void this.saveLogsToNote();
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

	private async clearVaultRecords() {
		const { account, remoteDir, serverUrl } = this.plugin.settings;
		const namespace = getSyncStateKey({
			vaultName: this.plugin.app.vault.getName(),
			remoteBaseDir: remoteDir,
			serverUrl,
			account,
		});
		await Promise.all([
			this.plugin.syncStateStore.removeNamespace(namespace),
			this.plugin.baseTextStore.removeNamespace(namespace),
		]);
		new Notice(i18n.t('settings.clearRecords.vaultCleared'));
	}

	private async clearAllRecords() {
		await Promise.all([
			this.plugin.syncStateStore.removeAll(),
			this.plugin.baseTextStore.removeAll(),
		]);
		new Notice(i18n.t('settings.clearRecords.allCleared'));
	}

	async saveLogsToNote() {
		try {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const fileName = `${timestamp}.md`;
			const dirPath = 'WebDAV Sync Logs';
			const filePath = `${dirPath}/${fileName}`;
			const content = logger.exportMarkdownReport();

			const folderExists = this.app.vault.getFolderByPath(dirPath);
			if (!folderExists) await this.app.vault.createFolder(dirPath);

			const file = await this.app.vault.create(filePath, content);
			new Notice(i18n.t('settings.log.savedToNote', { fileName: filePath }));

			await this.app.workspace.getLeaf().openFile(file);
		} catch (error) {
			new Notice(i18n.t('settings.log.saveError'));
			logger.error('Failed to export support report', { error });
		}
	}
}
