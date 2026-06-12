import type { TAbstractFile } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import type { SyncTrigger } from '~/events';
import { syncRun } from '~/events';
import { SyncRunKind } from '~/types';
import { buildRules, needIncludeFromGlobRules } from '~/utils/glob-match';
import { waitUntil } from '~/utils/sleep';
import type {
	default as SyncExecutorService,
	SyncExecutionRequest,
	SyncOptions,
} from './sync-executor.service';

type SyncRequest = {
	requestedAt: number;
	source: SyncTrigger;
	resolve: (value: boolean) => void;
	reject: (reason?: unknown) => void;
} & SyncOptions;

export default class SyncSchedulerService {
	private readonly pendingRequests: Array<SyncRequest> = [];
	private isFlushing = false;
	private isScheduling = false;
	private realtimeSyncTimer?: number;
	private scheduledSyncTimer?: number;
	private startupSyncTimer?: number;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly syncExecutor: SyncExecutorService,
	) {}

	get settings() {
		return this.plugin.settings;
	}

	requestSync(options: SyncOptions & { source: SyncTrigger }): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.pendingRequests.push({
				...options,
				reject,
				requestedAt: Date.now(),
				resolve,
			});
			void this.scheduleFlush();
		});
	}

	start() {
		// https://forum.obsidian.md/t/dont-dispatch-create-event-on-startup/50022/3
		this.plugin.app.workspace.onLayoutReady(() => {
			this.plugin.registerEvent(this.plugin.app.vault.on('create', this.onChange));
			this.plugin.registerEvent(this.plugin.app.vault.on('delete', this.onChange));
			this.plugin.registerEvent(this.plugin.app.vault.on('modify', this.onChange));
			this.plugin.registerEvent(this.plugin.app.vault.on('rename', this.onChange));
		});
		const schedule = () => {
			if (this.settings.scheduledSync.enabled) this.startScheduledSync();
		};
		if (this.settings.startupSync.enabled)
			this.startupSyncTimer = window.setTimeout(() => {
				void this.requestSync({
					runKind: SyncRunKind.normal,
					source: 'startup',
				}).finally(schedule);
			}, this.settings.startupSync.value);
		else schedule();
	}

	unload() {
		while (this.pendingRequests.length > 0) {
			const request = this.pendingRequests.shift();
			request?.resolve(false);
		}
		if (this.realtimeSyncTimer) {
			window.clearTimeout(this.realtimeSyncTimer);
			this.realtimeSyncTimer = undefined;
		}
		if (this.startupSyncTimer) {
			window.clearTimeout(this.startupSyncTimer);
			this.startupSyncTimer = undefined;
		}
		this.stopScheduledSync();
	}

	startScheduledSync() {
		if (this.scheduledSyncTimer) window.clearInterval(this.scheduledSyncTimer);
		this.scheduledSyncTimer = window.setInterval(
			() =>
				void this.requestSync({
					runKind: SyncRunKind.normal,
					source: 'interval',
				}),
			this.settings.scheduledSync.value,
		);
	}

	stopScheduledSync() {
		if (this.scheduledSyncTimer) {
			window.clearInterval(this.scheduledSyncTimer);
			this.scheduledSyncTimer = undefined;
		}
	}

	private readonly onChange = (file: TAbstractFile, old?: string) => {
		if (syncRun()?.stage === 'executing') return;
		const { fastRealtimeSync, realtimeSync, filterRules } = this.settings;
		if (!realtimeSync.enabled) return;

		const exclusions = buildRules(filterRules.exclusionRules);
		const inclusions = buildRules(filterRules.inclusionRules);
		if (
			!needIncludeFromGlobRules(file.path, inclusions, exclusions) &&
			!(old && needIncludeFromGlobRules(old, inclusions, exclusions))
		)
			return;

		if (this.realtimeSyncTimer) window.clearTimeout(this.realtimeSyncTimer);
		this.realtimeSyncTimer = window.setTimeout(
			() =>
				void this.requestSync({
					runKind: fastRealtimeSync ? SyncRunKind.fast : SyncRunKind.normal,
					source: 'realtime',
				}),
			this.settings.realtimeSync.value,
		);
	};

	private async scheduleFlush() {
		if (this.pendingRequests.length === 0 || this.isScheduling) return;

		this.isScheduling = true;
		if (this.isFlushing || this.plugin.isSyncing)
			await waitUntil(() => !this.isFlushing && !this.plugin.isSyncing);

		void this.flush();
		this.isScheduling = false;
	}

	private reduceBatch(batch: Array<SyncRequest>): SyncExecutionRequest {
		const runKind = batch.some((request) => request.runKind === SyncRunKind.normal)
			? SyncRunKind.normal
			: SyncRunKind.fast;

		let trigger: SyncTrigger = 'realtime';
		if (batch.some((request) => request.source === 'manual')) trigger = 'manual';
		else if (batch.some((request) => request.source === 'startup')) trigger = 'startup';
		else if (batch.some((request) => request.source === 'interval')) trigger = 'interval';

		return {
			queuedAt: Date.now(),
			runId: crypto.randomUUID(),
			runKind,
			sources: [...new Set(batch.map((request) => request.source))],
			trigger,
		};
	}

	private async flush() {
		this.isFlushing = true;
		const batch = this.pendingRequests.splice(0, this.pendingRequests.length);
		try {
			const result = await this.syncExecutor.executeSync(this.reduceBatch(batch));
			for (const request of batch) request.resolve(result.executed);
		} catch (error) {
			for (const request of batch) request.reject(error);
		} finally {
			this.isFlushing = false;
		}
	}
}
