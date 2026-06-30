import type { App, EventRef, TAbstractFile } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { GlobMatchOptions, TogglableValue } from '@/types';
import { buildRules, needIncludeFromGlobRules } from '@/utils/glob-match';
import { untilTrue } from '@/utils/wait';
import type { SyncStage } from './Observability';
import type { SyncTriggerEntry } from './Registrar';

type SyncRequest = {
	trigger: string;
	resolve: () => void;
};

export default class Scheduler {
	private readonly pendingRequests: Array<SyncRequest> = [];
	private isScheduling = false;
	private realtimeSyncTimer?: number;
	private scheduledSyncTimer?: number;
	private startupSyncTimer?: number;

	constructor(
		private readonly ctx: {
			syncStage: Ref<SyncStage>;
			executeSync: (trigger: string) => Promise<void>;
			registerEvent: (ref: EventRef) => void;
			app: App;
			isIdle: Ref<boolean>;
			reduceSyncTrigger: (batch: Array<string>) => string;
			registerSyncTrigger: (trigger: string, entry: SyncTriggerEntry) => void;
		},
	) {}

	declare settings: {
		startupSync: TogglableValue;
		scheduledSync: TogglableValue;
		realtimeSync: TogglableValue;
		exclusionRules: Array<GlobMatchOptions>;
		inclusionRules: Array<GlobMatchOptions>;
	};

	private readonly requestSync = (trigger: string): Promise<void> =>
		new Promise((resolve) => {
			this.pendingRequests.push({ resolve, trigger });
			void this.scheduleFlush();
		});

	start = () => {
		const { workspace, vault } = this.ctx.app;
		workspace.onLayoutReady(() => {
			this.ctx.registerEvent(vault.on('create', this.onChange));
			this.ctx.registerEvent(vault.on('delete', this.onChange));
			this.ctx.registerEvent(vault.on('modify', this.onChange));
			this.ctx.registerEvent(vault.on('rename', this.onChange));
		});
		const { scheduledSync, startupSync } = this.settings;
		const schedule = () => {
			if (scheduledSync.enabled) this.startScheduledSync();
		};
		if (startupSync.enabled)
			this.startupSyncTimer = window.setTimeout(() => {
				void this.requestSync('startup').finally(schedule);
			}, startupSync.value);
		else schedule();
	};

	dispose = () => {
		while (this.pendingRequests.length > 0) {
			const request = this.pendingRequests.shift();
			request?.resolve();
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
	};

	private readonly startScheduledSync = () => {
		if (this.scheduledSyncTimer) window.clearInterval(this.scheduledSyncTimer);
		this.scheduledSyncTimer = window.setInterval(
			() => void this.requestSync('interval'),
			this.settings.scheduledSync.value,
		);
	};

	private readonly stopScheduledSync = () => {
		if (this.scheduledSyncTimer) {
			window.clearInterval(this.scheduledSyncTimer);
			this.scheduledSyncTimer = undefined;
		}
	};

	private readonly onChange = (file: TAbstractFile, old?: string) => {
		if (this.ctx.syncStage() === 'executing') return;
		const { realtimeSync, exclusionRules, inclusionRules } = this.settings;
		if (!realtimeSync.enabled) return;

		const exclusions = buildRules(exclusionRules);
		const inclusions = buildRules(inclusionRules);
		if (
			!needIncludeFromGlobRules(file.path, inclusions, exclusions) &&
			!(old && needIncludeFromGlobRules(old, inclusions, exclusions))
		)
			return;

		if (this.realtimeSyncTimer) window.clearTimeout(this.realtimeSyncTimer);
		this.realtimeSyncTimer = window.setTimeout(
			() => void this.requestSync('realtime'),
			realtimeSync.value,
		);
	};

	private readonly scheduleFlush = async () => {
		if (this.pendingRequests.length === 0 || this.isScheduling) return;
		this.isScheduling = true;
		await untilTrue(this.ctx.isIdle);
		void this.flush();
		this.isScheduling = false;
	};

	private readonly flush = async () => {
		const batch = this.pendingRequests.splice(0);
		await this.ctx.executeSync(
			this.ctx.reduceSyncTrigger(batch.map((request) => request.trigger)),
		);
		for (const request of batch) request.resolve();
	};

	root = {
		requestSync: this.requestSync,
	};
}
