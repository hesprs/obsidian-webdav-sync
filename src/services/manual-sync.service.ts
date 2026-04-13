import type WebDAVSyncPlugin from '~';
import { Notice } from 'obsidian';
import SyncConfirmModal from '~/components/SyncConfirmModal';
import t from '~/i18n';

interface LaunchManualSyncOptions {
	skipConfirmation?: boolean;
}

export function launchManualSync(
	plugin: WebDAVSyncPlugin,
	options: LaunchManualSyncOptions = {},
): void {
	if (plugin.isSyncing) return;

	if (!plugin.isAccountConfigured()) {
		new Notice(t('sync.error.accountNotConfigured'));
		return;
	}

	if (plugin.settings.confirmBeforeSync && !options.skipConfirmation) {
		new SyncConfirmModal(plugin).open();
		return;
	}

	void plugin.syncSchedulerService.requestManualSync();
}
