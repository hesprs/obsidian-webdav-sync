import WebDAVSyncPlugin from '~';
import { syncCancel } from '~/events';
import t from '~/i18n';
import { launchManualSync } from './manual-sync.service';

export function setupCommands(plugin: WebDAVSyncPlugin) {
	plugin.addCommand({
		id: 'start-sync',
		name: t('sync.startButton'),
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
		name: t('sync.stopButton'),
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
		name: t('sync.showProgressButton'),
		callback: () => plugin.observabilityService.showProgressModal(),
	});
}
