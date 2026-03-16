import { debounce } from 'lodash-es';
import { useSettings } from '~/settings';
import { SyncStartMode } from '~/sync';
import waitUntil from '~/utils/wait-until';
import type SyncExecutorService from './sync-executor.service';
import WebDAVSyncPlugin from '..';

export default class RealtimeSyncService {
	private waiting = false;

	private submitDirectly = async () => {
		if (this.waiting) return;
		this.waiting = true;
		await waitUntil(() => this.plugin.isSyncing === false, 500);
		this.waiting = false;
		await this.syncExecutor.executeSync({ mode: SyncStartMode.AUTO_SYNC });
	};

	private submitSyncRequest = debounce(this.submitDirectly, 8000);

	private onChange = async () => {
		const settings = await useSettings();
		if (!settings.realtimeSync) return;
		await this.submitSyncRequest();
	};

	constructor(
		private plugin: WebDAVSyncPlugin,
		private syncExecutor: SyncExecutorService,
	) {
		this.plugin.registerEvent(this.vault.on('create', this.onChange));
		this.plugin.registerEvent(this.vault.on('delete', this.onChange));
		this.plugin.registerEvent(this.vault.on('modify', this.onChange));
		this.plugin.registerEvent(this.vault.on('rename', this.onChange));
	}

	get vault() {
		return this.plugin.app.vault;
	}

	unload() {
		this.submitSyncRequest.cancel();
	}
}
