import { Notice } from 'obsidian';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '../index';
import { emitCancelSync } from '../events';
import i18n from '../i18n';
import { SyncEngine, SyncStartMode } from '../sync/index';
import SyncConfirmModal from './SyncConfirmModal';

export class SyncRibbonManager {
	private startRibbonEl: HTMLElement;
	private stopRibbonEl: HTMLElement;

	constructor(private plugin: WebDAVSyncPlugin) {
		this.startRibbonEl = this.plugin.addRibbonIcon(
			'refresh-ccw',
			i18n.t('sync.startButton'),
			async () => {
				if (this.plugin.isSyncing) {
					return;
				}

				// 检查账号配置
				if (!this.plugin.isAccountConfigured()) {
					new Notice(i18n.t('sync.error.accountNotConfigured'));
					// 打开设置页面，引导用户配置账号
					try {
						const setting = this.plugin.app.setting;
						if (setting) {
							setting.open();
							setting.openTabById(this.plugin.manifest.id);
						}
					} catch (error) {
						logger.error('Failed to open settings:', error);
					}
					return;
				}

				const startSync = async () => {
					const sync = new SyncEngine(this.plugin, {
						webdav: await this.plugin.webDAVService.createWebDAVClient(),
						vault: this.plugin.app.vault,
						token: await this.plugin.getToken(),
						remoteBaseDir: this.plugin.remoteBaseDir,
					});
					await sync.start({
						mode: SyncStartMode.MANUAL_SYNC,
					});
				};
				if (this.plugin.settings.confirmBeforeSync) {
					new SyncConfirmModal(this.plugin.app, startSync).open();
				} else {
					void startSync();
				}
			},
		);
		this.stopRibbonEl = this.plugin.addRibbonIcon('square', i18n.t('sync.stopButton'), () =>
			emitCancelSync(),
		);
		this.stopRibbonEl.classList.add('hidden');
	}

	public update() {
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
