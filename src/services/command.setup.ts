import { syncCancel } from '~/events';
import i18n from '~/i18n';
import WebDAVSyncPlugin from '..';
import { launchManualSync } from './manual-sync.service';

export function setupCommands(plugin: WebDAVSyncPlugin) {
	plugin.addCommand({
		id: 'start-sync',
		name: i18n.t('sync.startButton'),
		icon: 'refresh-cw',
		checkCallback: (checking) => {
			if (plugin.isSyncing) return false;
			if (checking) return true;
			launchManualSync(plugin);
		},
	});

	plugin.addCommand({
		id: 'stop-sync',
		icon: 'x-circle',
		name: i18n.t('sync.stopButton'),
		checkCallback: (checking) => {
			if (plugin.isSyncing) {
				if (!checking) syncCancel();
				return true;
			}
			return false;
		},
	});

	plugin.addCommand({
		id: 'show-sync-progress',
		icon: 'activity',
		name: i18n.t('sync.showProgressButton'),
		callback: () => plugin.progressService.showProgressModal(),
	});
}
