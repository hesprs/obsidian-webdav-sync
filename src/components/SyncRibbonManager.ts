import type WebDAVSyncPlugin from '~';
import { syncCancel } from '~/events';
import t from '~/i18n';
import { launchManualSync } from '~/services/manual-sync.service';

export class SyncRibbonManager {
	private startRibbonEl: HTMLElement;
	private stopRibbonEl: HTMLElement;

	constructor(private plugin: WebDAVSyncPlugin) {
		this.startRibbonEl = this.plugin.addRibbonIcon('refresh-ccw', t('sync.startButton'), () =>
			launchManualSync(this.plugin),
		);
		this.stopRibbonEl = this.plugin.addRibbonIcon('square', t('sync.stopButton'), syncCancel);
		this.stopRibbonEl.classList.add('hidden');
	}

	update() {
		if (this.plugin.isSyncing) {
			this.startRibbonEl.setAttr('aria-disabled', 'true');
			this.startRibbonEl.addClass('webdav-sync-spinning');
			this.stopRibbonEl.classList.remove('hidden');
		} else {
			this.startRibbonEl.removeAttribute('aria-disabled');
			this.startRibbonEl.removeClass('webdav-sync-spinning');
			this.stopRibbonEl.classList.add('hidden');
		}
	}
}
