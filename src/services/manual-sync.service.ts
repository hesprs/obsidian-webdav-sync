import { Notice } from 'obsidian';
import i18n from '~/i18n';
import type WebDAVSyncPlugin from '..';
import SyncConfirmModal from '../components/SyncConfirmModal';

interface LaunchManualSyncOptions {
	skipConfirmation?: boolean;
}

export function launchManualSync(
	plugin: WebDAVSyncPlugin,
	options: LaunchManualSyncOptions = {},
): void {
	if (plugin.isSyncing) return;

	if (!plugin.isAccountConfigured()) {
		new Notice(i18n.t('sync.error.accountNotConfigured'));
		return;
	}

	if (plugin.settings.confirmBeforeSync && !options.skipConfirmation) {
		new SyncConfirmModal(plugin).open();
		return;
	}

	void plugin.syncSchedulerService.requestManualSync();
}
