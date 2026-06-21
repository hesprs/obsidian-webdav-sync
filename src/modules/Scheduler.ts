import type { App, EventRef, TAbstractFile } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { GlobMatchOptions } from '~/types';
import { buildRules, needIncludeFromGlobRules } from '~/utils/glob-match';
import { waitUntil } from '~/utils/sleep';
import type { SyncStage } from './Observability';
import type { SyncTrigger } from './Sync';

type SyncRequest = {
	trigger: SyncTrigger;
	resolve: () => void;
};

export default class Scheduler {
	private readonly pendingRequests: Array<SyncRequest> = [];
	private isFlushing = false;
	private isScheduling = false;
	private realtimeSyncTimer?: number;
	private scheduledSyncTimer?: number;
	private startupSyncTimer?: number;

	constructor(
		private readonly ctx: {
			syncStage: Ref<SyncStage>;
			executeSync: (trigger: SyncTrigger) => Promise<void>;
			registerEvent: (ref: EventRef) => void;
			app: App;
		},
	) {}

	declare settings: {
		startupSyncEnabled: boolean;
		startupSyncDelay: number;
		scheduledSyncEnabled: boolean;
		scheduledSyncInterval: number;
		realtimeSyncEnabled: boolean;
		realtimeSyncDelay: number;
		exclusionRules: Array<GlobMatchOptions>;
		inclusionRules: Array<GlobMatchOptions>;
	};

	private readonly requestSync = (trigger: SyncTrigger): Promise<void> =>
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
		const schedule = () => {
			if (this.settings.scheduledSyncEnabled) this.startScheduledSync();
		};
		if (this.settings.startupSyncEnabled)
			this.startupSyncTimer = window.setTimeout(() => {
				void this.requestSync('startup').finally(schedule);
			}, this.settings.startupSyncDelay);
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
			this.settings.scheduledSyncInterval,
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
		const { realtimeSyncDelay, realtimeSyncEnabled, exclusionRules, inclusionRules } =
			this.settings;
		if (!realtimeSyncEnabled) return;

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
			realtimeSyncDelay,
		);
	};

	private readonly scheduleFlush = async () => {
		if (this.pendingRequests.length === 0 || this.isScheduling) return;
		this.isScheduling = true;
		if (this.isFlushing) await waitUntil(() => !this.isFlushing);
		void this.flush();
		this.isScheduling = false;
	};

	private readonly reduceBatch = (batch: Array<SyncRequest>): SyncTrigger => {
		const triggerPriority: Array<SyncTrigger> = [
			'manual',
			'nonInteractiveManual',
			'startup',
			'interval',
			'realtime',
		];
		const trigger =
			triggerPriority.find((t) => batch.some((r) => r.trigger === t)) ?? 'realtime';
		return trigger;
	};

	private readonly flush = async () => {
		this.isFlushing = true;
		const batch = this.pendingRequests.splice(0, this.pendingRequests.length);
		try {
			await this.ctx.executeSync(this.reduceBatch(batch));
			for (const request of batch) request.resolve();
		} finally {
			this.isFlushing = false;
		}
	};

	root = {
		requestSync: this.requestSync,
	};
}
