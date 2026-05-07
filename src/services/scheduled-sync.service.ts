import type WebDAVSyncPlugin from '~';
import { SyncRunKind } from '~/types';
import type SyncSchedulerService from './sync-scheduler.service';

export default class ScheduledSyncService {
	private scheduledSyncTimer: number | undefined;
	private startupSyncTimer: number | undefined;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly syncScheduler: SyncSchedulerService,
	) {}

	get settings() {
		return this.plugin.settings;
	}

	start() {
		if (this.settings.startupSync.enabled)
			this.startupSyncTimer = window.setTimeout(() => {
				void this.handleStartupSync();
			}, this.settings.startupSync.value);
		else this.startTimer();
	}

	private startTimer() {
		this.stopTimer();
		if (this.settings.scheduledSync.enabled)
			this.scheduledSyncTimer = window.setInterval(() => {
				void this.handleIntervalSync();
			}, this.settings.scheduledSync.value);
	}

	private async handleStartupSync() {
		try {
			await this.syncScheduler.requestSync({
				runKind: SyncRunKind.normal,
				source: 'startup',
			});
		} finally {
			this.startTimer();
		}
	}

	private async handleIntervalSync() {
		await this.syncScheduler.requestSync({
			runKind: SyncRunKind.normal,
			source: 'interval',
		});
	}

	private stopTimer() {
		if (this.scheduledSyncTimer !== undefined) {
			window.clearInterval(this.scheduledSyncTimer);
			this.scheduledSyncTimer = undefined;
		}
	}

	unload() {
		this.stopTimer();
		if (this.startupSyncTimer !== undefined) {
			window.clearTimeout(this.startupSyncTimer);
			this.startupSyncTimer = undefined;
		}
	}
}
