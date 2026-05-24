import { Notice, Setting } from 'obsidian';
import t from '~/i18n';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import logger from '~/utils/logger';
import BaseSettings from './settings.base';

export default class DevelopmentSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.development')).setHeading();

		new Setting(this.containerEl)
			.setName(t('settings.clearRecords.name'))
			.setDesc(t('settings.clearRecords.desc'))
			.addButton((button) =>
				button
					.setButtonText(t('settings.clearRecords.vaultButton'))
					.onClick(() => void this.clearVaultRecords()),
			)
			.addButton((button) =>
				button
					.setButtonText(t('settings.clearRecords.allButton'))
					.onClick(() => void this.clearAllRecords()),
			);

		new Setting(this.containerEl)
			.setName(t('settings.log.name'))
			.setDesc(t('settings.log.desc'))
			.addButton((button) => {
				button.setButtonText(t('settings.log.saveToNote')).onClick(() => {
					void this.saveLogsToNote();
				});
			});
	}

	private async clearVaultRecords() {
		const { account, remoteDir, serverUrl } = this.plugin.settings;
		const namespace = getSyncStateKey({
			account,
			remoteBaseDir: remoteDir,
			serverUrl,
			vaultName: this.plugin.app.vault.getName(),
		});
		await Promise.all([
			this.plugin.syncStateStore.removeNamespace(namespace),
			this.plugin.baseTextStore.removeNamespace(namespace),
		]);
		new Notice(t('settings.clearRecords.vaultCleared'));
	}

	private async clearAllRecords() {
		await Promise.all([
			this.plugin.syncStateStore.removeAll(),
			this.plugin.baseTextStore.removeAll(),
		]);
		new Notice(t('settings.clearRecords.allCleared'));
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
			new Notice(t('settings.log.savedToNote', { fileName: filePath }));

			await this.app.workspace.getLeaf().openFile(file);
		} catch (error) {
			new Notice(t('settings.log.saveError'));
			logger.error('Failed to export support report', error);
		}
	}
}
