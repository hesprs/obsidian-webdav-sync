import { Notice } from 'obsidian';
import i18n from '~/i18n';
import logger from '~/utils/logger';
import runAsync from '~/utils/run-async';
import type WebDAVSyncPlugin from '..';
import SyncConfirmModal from '../components/SyncConfirmModal';

interface LaunchManualSyncOptions {
	skipConfirmation?: boolean;
}

function openPluginSettings(plugin: WebDAVSyncPlugin): void {
	try {
		const setting = plugin.app.setting;
		if (setting) {
			setting.open();
			setting.openTabById(plugin.manifest.id);
		}
	} catch (error) {
		logger.error('Failed to open settings', error);
	}
}

export function launchManualSync(
	plugin: WebDAVSyncPlugin,
	options: LaunchManualSyncOptions = {},
): void {
	if (plugin.isSyncing) return;

	if (!plugin.isAccountConfigured()) {
		new Notice(i18n.t('sync.error.accountNotConfigured'));
		openPluginSettings(plugin);
		return;
	}

	if (plugin.settings.confirmBeforeSync && !options.skipConfirmation) {
		new SyncConfirmModal(plugin).open();
		return;
	}

	runAsync(
		() => plugin.syncSchedulerService.requestManualSync().then(() => undefined),
		'Failed to start manual sync',
	);
}
