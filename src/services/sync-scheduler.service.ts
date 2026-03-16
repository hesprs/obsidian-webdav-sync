import { SyncRunKind } from '~/model/sync-record.model';
import { SyncStartMode } from '~/sync';
import type WebDAVSyncPlugin from '..';
import type { SyncOptions } from './sync-executor.service';
import type SyncExecutorService from './sync-executor.service';

const AUTO_SYNC_DEBOUNCE_MS = 8000;
const SYNC_IDLE_POLL_MS = 500;

interface SyncRequest extends SyncOptions {
	requestedAt: number;
	source: 'realtime' | 'startup' | 'interval' | 'manual';
	resolve: (value: boolean) => void;
	reject: (reason?: unknown) => void;
}

export default class SyncSchedulerService {
	private pendingRequests: SyncRequest[] = [];

	private flushTimer: number | null = null;

	private isFlushing = false;

	constructor(
		private plugin: WebDAVSyncPlugin,
		private syncExecutor: SyncExecutorService,
	) {}

	requestSync(
		options: SyncOptions & {
			source: SyncRequest['source'];
		},
	): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.pendingRequests.push({
				...options,
				requestedAt: Date.now(),
				resolve,
				reject,
			});
			this.scheduleFlush();
		});
	}

	requestManualSync() {
		return this.requestSync({
			mode: SyncStartMode.MANUAL_SYNC,
			runKind: SyncRunKind.NORMAL,
			source: 'manual',
		});
	}

	unload() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		while (this.pendingRequests.length > 0) {
			const request = this.pendingRequests.shift();
			request?.resolve(false);
		}
	}

	private scheduleFlush() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.pendingRequests.length === 0 || this.isFlushing) return;

		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flush();
		}, this.getNextDelayMs());
	}

	private getNextDelayMs() {
		if (this.pendingRequests.some((request) => request.mode === SyncStartMode.MANUAL_SYNC)) {
			return 0;
		}

		const latestRequestAt = this.pendingRequests.reduce(
			(latest, request) => Math.max(latest, request.requestedAt),
			0,
		);

		return Math.max(0, latestRequestAt + AUTO_SYNC_DEBOUNCE_MS - Date.now());
	}

	private reduceBatch(batch: SyncRequest[]): SyncOptions {
		const mode = batch.some((request) => request.mode === SyncStartMode.MANUAL_SYNC)
			? SyncStartMode.MANUAL_SYNC
			: SyncStartMode.AUTO_SYNC;

		const runKind = batch.some((request) => request.runKind === SyncRunKind.NORMAL)
			? SyncRunKind.NORMAL
			: SyncRunKind.NUMB;

		return { mode, runKind };
	}

	private async flush() {
		if (this.isFlushing || this.pendingRequests.length === 0) return;

		if (this.plugin.isSyncing) {
			this.flushTimer = window.setTimeout(() => {
				this.flushTimer = null;
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
			for (const request of batch) request.resolve(result);
		} catch (error) {
			for (const request of batch) request.reject(error);
		} finally {
			this.isFlushing = false;
			this.scheduleFlush();
		}
	}
}
