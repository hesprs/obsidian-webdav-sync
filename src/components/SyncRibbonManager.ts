import type WebDAVSyncPlugin from '~';
import { syncCancel } from '~/events';
import t from '~/i18n';
import { launchManualSync } from '~/sync';

export default class SyncRibbonManager {
	private readonly startRibbonEl: HTMLElement;
	private readonly stopRibbonEl: HTMLElement;

	constructor(private readonly plugin: WebDAVSyncPlugin) {
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
