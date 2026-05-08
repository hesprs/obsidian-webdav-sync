import type WebDAVSyncPlugin from '~';
import { syncCancel } from '~/events';
import t from '~/i18n';
import launchManualSync from '~/utils/launch-manual-sync';

export default function setupCommands(plugin: WebDAVSyncPlugin) {
	plugin.addCommand({
		checkCallback: (checking) => {
			if (plugin.isSyncing) return false;
			if (checking) return true;
			launchManualSync(plugin);
		},
		icon: 'refresh-cw',
		id: 'start-sync',
		name: t('sync.startButton'),
	});

	plugin.addCommand({
		checkCallback: (checking) => {
			if (plugin.isSyncing) {
				if (!checking) syncCancel();
				return true;
			}
			return false;
		},
		icon: 'x-circle',
		id: 'stop-sync',
		name: t('sync.stopButton'),
	});

	plugin.addCommand({
		callback: () => plugin.observabilityService.showProgressModal(),
		icon: 'activity',
		id: 'show-sync-progress',
		name: t('sync.showProgressButton'),
	});
}
