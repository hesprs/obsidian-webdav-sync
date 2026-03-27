import { clamp } from 'lodash-es';
import { SyncRunKind } from '~/model/sync-record.model';
import { useSettings, type PluginSettings } from '~/settings';
import { SyncStartMode } from '~/sync';
import type WebDAVSyncPlugin from '..';
import type SyncSchedulerService from './sync-scheduler.service';

export default class ScheduledSyncService {
	private scheduledSyncTimer: number | null = null;
	private startupSyncTimer: number | null = null;

	constructor(
		_plugin: WebDAVSyncPlugin,
		private syncScheduler: SyncSchedulerService,
	) {}

	async start() {
		const settings = await useSettings();

		if (settings.startupSyncDelaySeconds > 0) {
			this.startupSyncTimer = window.setTimeout(async () => {
				try {
					await this.syncScheduler.requestSync({
						mode: SyncStartMode.AUTO_SYNC,
						runKind: SyncRunKind.normal,
						source: 'startup',
					});
				} finally {
					this.startTimer(await useSettings());
				}
			}, settings.startupSyncDelaySeconds * 1000);
		} else this.startTimer(settings);
	}

	private startTimer(settings: PluginSettings) {
		this.stopTimer();

		const intervalMs = settings.scheduledSyncIntervalSeconds * 1000;
		const clampedIntervalMs = clamp(intervalMs, 0, 2 ** 31 - 1);

		if (clampedIntervalMs > 0) {
			this.scheduledSyncTimer = window.setInterval(async () => {
				await this.syncScheduler.requestSync({
					mode: SyncStartMode.AUTO_SYNC,
					runKind: SyncRunKind.normal,
					source: 'interval',
				});
			}, clampedIntervalMs);
		}
	}

	private stopTimer() {
		if (this.scheduledSyncTimer !== null) {
			window.clearInterval(this.scheduledSyncTimer);
			this.scheduledSyncTimer = null;
		}
	}

	async updateInterval() {
		const settings = await useSettings();
		this.startTimer(settings);
	}

	unload() {
		this.stopTimer();
		if (this.startupSyncTimer !== null) {
			window.clearTimeout(this.startupSyncTimer);
			this.startupSyncTimer = null;
		}
	}
}
