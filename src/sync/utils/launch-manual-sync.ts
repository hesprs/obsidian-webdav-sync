import type WebDAVSyncPlugin from '~';
import { Notice } from 'obsidian';
import SyncConfirmModal from '~/components/SyncConfirmModal';
import t from '~/i18n';
import { SyncRunKind } from '~/types';

type LaunchManualSyncOptions = {
	skipConfirmation?: boolean;
};

export default function launchManualSync(
	plugin: WebDAVSyncPlugin,
	options: LaunchManualSyncOptions = {},
): void {
	if (plugin.isSyncing) {
		plugin.observabilityService.showProgressModal();
		return;
	}

	if (!plugin.isAccountConfigured()) {
		new Notice(t('sync.error.accountNotConfigured'));
		return;
	}

	if (plugin.settings.confirmBeforeSync && !options.skipConfirmation) {
		new SyncConfirmModal(plugin).open();
		return;
	}

	void plugin.syncSchedulerService.requestSync({
		runKind: SyncRunKind.normal,
		source: 'manual',
	});
}
