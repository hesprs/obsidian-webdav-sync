import { syncRun } from '~/events';
import { useSettings } from '~/settings';
import { SyncStartMode } from '~/sync';
import { SyncRunKind } from '~/types';
import type SyncSchedulerService from './sync-scheduler.service';
import WebDAVSyncPlugin from '..';

export default class RealtimeSyncService {
	private onChange = async () => {
		const settings = await useSettings();
		if (!settings.realtimeSync) return;

		const currentRun = syncRun();
		if (currentRun?.stage === 'executing') return;

		await this.syncScheduler.requestSync({
			mode: SyncStartMode.AUTO_SYNC,
			runKind: settings.useFastSyncOnLocalChange ? SyncRunKind.fast : SyncRunKind.normal,
			source: 'realtime',
		});
	};

	constructor(
		private plugin: WebDAVSyncPlugin,
		private syncScheduler: SyncSchedulerService,
	) {
		this.plugin.registerEvent(this.vault.on('create', this.onChange));
		this.plugin.registerEvent(this.vault.on('delete', this.onChange));
		this.plugin.registerEvent(this.vault.on('modify', this.onChange));
		this.plugin.registerEvent(this.vault.on('rename', this.onChange));
	}

	get vault() {
		return this.plugin.app.vault;
	}
}
