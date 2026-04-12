import type WebDAVSyncPlugin from '../index';
import { syncCancel } from '../events';
import i18n from '../i18n';
import { launchManualSync } from '../services/manual-sync.service';

export class SyncRibbonManager {
	private startRibbonEl: HTMLElement;
	private stopRibbonEl: HTMLElement;

	constructor(private plugin: WebDAVSyncPlugin) {
        this.startRibbonEl = this.plugin.addRibbonIcon(
			'refresh-ccw',
			i18n.t('sync.startButton'),
			() => launchManualSync(this.plugin),
		);
		this.stopRibbonEl = this.plugin.addRibbonIcon(
			'square',
			i18n.t('sync.stopButton'),
			syncCancel,
		);
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
