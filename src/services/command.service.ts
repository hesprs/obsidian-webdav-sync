import { emitCancelSync } from '~/events';
import i18n from '~/i18n';
import WebDAVSyncPlugin from '..';
import { launchManualSync } from './manual-sync.service';

export default class CommandService {
	constructor(plugin: WebDAVSyncPlugin) {
		plugin.addCommand({
			id: 'start-sync',
			name: i18n.t('sync.startButton'),
			checkCallback: (checking) => {
				if (plugin.isSyncing) return false;
				if (checking) return true;

				launchManualSync(plugin);
			},
		});

		plugin.addCommand({
			id: 'stop-sync',
			name: i18n.t('sync.stopButton'),
			checkCallback: (checking) => {
				if (plugin.isSyncing) {
					if (!checking) emitCancelSync();
					return true;
				}
				return false;
			},
		});

		plugin.addCommand({
			id: 'show-sync-progress',
			name: i18n.t('sync.showProgressButton'),
			callback: () => {
				plugin.progressService.showProgressModal();
			},
		});
	}
}
