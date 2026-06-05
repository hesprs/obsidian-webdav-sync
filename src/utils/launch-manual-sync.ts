import type WebDAVSyncPlugin from '~';
import { Notice } from 'obsidian';
import SyncConfirmModal from '~/components/SyncConfirmModal';
import t from '~/i18n';
import { SyncRunKind } from '~/types';
import logger from './logger';

type LaunchManualSyncOptions = {
	skipConfirmation?: boolean;
};

export default function launchManualSync(
	plugin: WebDAVSyncPlugin,
	options: LaunchManualSyncOptions = {},
): void {
	logger.debug('checkpoint 1')
	if (plugin.isSyncing) {
		logger.debug('checkpoint 2')
		plugin.observabilityService.showProgressModal();
		return;
	}

	if (!plugin.isAccountConfigured()) {
		logger.debug('checkpoint 3')
		new Notice(t('sync.error.accountNotConfigured'));
		return;
	}

	if (plugin.settings.confirmBeforeSync && !options.skipConfirmation) {
		logger.debug('checkpoint 4')
		new SyncConfirmModal(plugin).open();
		return;
	}

	logger.debug('checkpoint 5')
	void plugin.syncSchedulerService.requestSync({
		runKind: SyncRunKind.normal,
		source: 'manual',
	});
}
