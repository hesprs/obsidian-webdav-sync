import type WebDAVSyncPlugin from '~';
import { SyncStartMode } from '~/sync';
import { SyncRunKind } from '~/types';
import type SyncSchedulerService from './sync-scheduler.service';

export default class ScheduledSyncService {
	private scheduledSyncTimer: number | null = null;
	private startupSyncTimer: number | null = null;

	constructor(
		private plugin: WebDAVSyncPlugin,
		private syncScheduler: SyncSchedulerService,
	) {}

	get settings() {
		return this.plugin.settings;
	}

	start() {
		if (this.settings.startupSync.enabled) {
			this.startupSyncTimer = window.setTimeout(() => {
				void this.handleStartupSync();
			}, this.settings.startupSync.value);
		} else this.startTimer();
	}

	private startTimer() {
		this.stopTimer();
		if (this.settings.scheduledSync.enabled) {
			this.scheduledSyncTimer = window.setInterval(() => {
				void this.handleIntervalSync();
			}, this.settings.scheduledSync.value);
		}
	}

	private async handleStartupSync() {
		try {
			await this.syncScheduler.requestSync({
				mode: SyncStartMode.AUTO_SYNC,
				runKind: SyncRunKind.normal,
				source: 'startup',
			});
		} finally {
			this.startTimer();
		}
	}

	private async handleIntervalSync() {
		await this.syncScheduler.requestSync({
			mode: SyncStartMode.AUTO_SYNC,
			runKind: SyncRunKind.normal,
			source: 'interval',
		});
	}

	private stopTimer() {
		if (this.scheduledSyncTimer !== null) {
			window.clearInterval(this.scheduledSyncTimer);
			this.scheduledSyncTimer = null;
		}
	}

	unload() {
		this.stopTimer();
		if (this.startupSyncTimer !== null) {
			window.clearTimeout(this.startupSyncTimer);
			this.startupSyncTimer = null;
		}
	}
}
