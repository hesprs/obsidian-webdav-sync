import type WebDAVSyncPlugin from '~';
import type { SyncTrigger } from '~/events';
import { SyncStartMode } from '~/sync';
import { SyncRunKind } from '~/types';
import type {
	default as SyncExecutorService,
	SyncExecutionRequest,
	SyncOptions,
} from './sync-executor.service';

const SYNC_IDLE_POLL_MS = 500;

type SyncRequest = {
	requestedAt: number;
	source: SyncTrigger;
	resolve: (value: boolean) => void;
	reject: (reason?: unknown) => void;
} & SyncOptions;

export default class SyncSchedulerService {
	private readonly pendingRequests: Array<SyncRequest> = [];
	private flushTimer: number | undefined;
	private isFlushing = false;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly syncExecutor: SyncExecutorService,
	) {}

	requestSync(
		options: SyncOptions & {
			source: SyncTrigger;
		},
	): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.pendingRequests.push({
				...options,
				reject,
				requestedAt: Date.now(),
				resolve,
			});
			this.scheduleFlush();
		});
	}

	requestManualSync() {
		return this.requestSync({
			mode: SyncStartMode.MANUAL_SYNC,
			runKind: SyncRunKind.normal,
			source: 'manual',
		});
	}

	unload() {
		if (this.flushTimer !== undefined) {
			window.clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}

		while (this.pendingRequests.length > 0) {
			const request = this.pendingRequests.shift();
			request?.resolve(false);
		}
	}

	private scheduleFlush() {
		if (this.flushTimer !== undefined) {
			window.clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}

		if (this.pendingRequests.length === 0 || this.isFlushing) return;

		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = undefined;
			void this.flush();
		}, this.getNextDelayMs());
	}

	private getNextDelayMs() {
		if (this.pendingRequests.some((request) => request.mode === SyncStartMode.MANUAL_SYNC))
			return 0;

		const latestRequestAt = this.pendingRequests.reduce(
			(latest, request) => Math.max(latest, request.requestedAt),
			0,
		);

		return Math.max(0, latestRequestAt + this.plugin.settings.startupSync.value - Date.now());
	}

	private reduceBatch(batch: Array<SyncRequest>): SyncExecutionRequest {
		const mode = batch.some((request) => request.mode === SyncStartMode.MANUAL_SYNC)
			? SyncStartMode.MANUAL_SYNC
			: SyncStartMode.AUTO_SYNC;

		const runKind = batch.some((request) => request.runKind === SyncRunKind.normal)
			? SyncRunKind.normal
			: SyncRunKind.fast;

		return {
			mode,
			queuedAt: Date.now(),
			runId: crypto.randomUUID(),
			runKind,
			sources: [...new Set(batch.map((request) => request.source))],
			trigger: this.getTrigger(batch),
		};
	}

	private getTrigger(batch: Array<SyncRequest>): SyncTrigger {
		if (batch.some((request) => request.source === 'manual')) return 'manual';
		if (batch.some((request) => request.source === 'startup')) return 'startup';
		if (batch.some((request) => request.source === 'interval')) return 'interval';
		return 'realtime';
	}

	private async flush() {
		if (this.isFlushing || this.pendingRequests.length === 0) return;
		if (this.plugin.isSyncing) {
			this.flushTimer = window.setTimeout(() => {
				this.flushTimer = undefined;
				void this.flush();
			}, SYNC_IDLE_POLL_MS);
			return;
		}

		const nextDelayMs = this.getNextDelayMs();
		if (nextDelayMs > 0) {
			this.scheduleFlush();
			return;
		}

		this.isFlushing = true;
		const batch = this.pendingRequests.splice(0, this.pendingRequests.length);

		try {
			const result = await this.syncExecutor.executeSync(this.reduceBatch(batch));
			for (const request of batch) request.resolve(result.executed);
		} catch (error) {
			for (const request of batch) request.reject(error);
		} finally {
			this.isFlushing = false;
			this.scheduleFlush();
		}
	}
}
