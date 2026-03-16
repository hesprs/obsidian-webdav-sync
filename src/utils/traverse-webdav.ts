import type { StatModel } from '~/model/stat.model';
import { getDirectoryContents } from '~/api';
import { createEmptyRemoteRecord, type RemoteRecordModel } from '~/model/sync-record.model';
import { joinRemotePath, normalizeRemoteDir } from '~/platform/path/remote-path';
import { traverseWebDAVKV } from '~/storage';
import { SyncRecord } from '~/storage/sync-record';
import { Mutex } from '~/utils/mutex';
import { apiLimiter } from './api-limiter';
import { fileStatToStatModel } from './file-stat-to-stat-model';
import { is503Error } from './is-503-error';
import logger from './logger';
import sleep from './sleep';
import { type MaybePromise } from './types';

const getContents = apiLimiter.wrap(getDirectoryContents);

export type WalkFreshness = 'cached-ok' | 'fresh';

// Global mutex map: one lock per kvKey
const traversalLocks = new Map<string, Mutex>();

function getTraversalLock(kvKey: string): Mutex {
	if (!traversalLocks.has(kvKey)) traversalLocks.set(kvKey, new Mutex());
	return traversalLocks.get(kvKey) as Mutex;
}

async function executeWithRetry<T>(func: () => MaybePromise<T>): Promise<T> {
	while (true) {
		try {
			return await func();
			// oxlint-disable-next-line typescript/no-explicit-any
		} catch (err: any) {
			if (is503Error(err)) await sleep(30_000);
			else throw err;
		}
	}
}

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const errWithRes = err as { res?: { status?: number }; message?: string };
	if (errWithRes.res?.status === 404) return true;
	return typeof errWithRes.message === 'string' && /^404\s*:/.test(errWithRes.message);
}

export class ResumableWebDAVTraversal {
	private remoteServerUrl: string;
	private token: string;
	private remoteBaseDir: string;
	private stateKey: string;
	private legacyTraversalKey?: string;
	private saveInterval: number;

	private queue: string[] = [];
	private nodes: Record<string, StatModel[]> = {};
	private processedCount: number = 0;
	private hasLoadedCache: boolean = false;

	/**
	 * Normalize directory path for use as nodes key
	 */
	private normalizeDirPath(path: string): string {
		return normalizeRemoteDir(path);
	}

	private isPathWithinBase(path: string): boolean {
		const base = this.normalizeDirPath(this.remoteBaseDir);
		const normalized = this.normalizeDirPath(path);
		if (base === '/') return normalized.startsWith('/');
		return normalized === base || normalized.startsWith(base);
	}

	private resolveTraversalPath(currentPath: string, childPath: string): string {
		if (this.isPathWithinBase(childPath)) return this.normalizeDirPath(childPath);
		const current = this.normalizeDirPath(currentPath);
		return this.normalizeDirPath(joinRemotePath(current, childPath));
	}

	constructor(options: {
		remoteServerUrl: string;
		token: string;
		remoteBaseDir: string;
		stateKey: string;
		legacyTraversalKey?: string;
		saveInterval?: number;
	}) {
		this.remoteServerUrl = options.remoteServerUrl;
		this.token = options.token;
		this.remoteBaseDir = options.remoteBaseDir;
		this.stateKey = options.stateKey;
		this.legacyTraversalKey = options.legacyTraversalKey;
		this.saveInterval = Math.max(options.saveInterval || 1, 1);
	}

	private get syncRecord() {
		return new SyncRecord(this.stateKey, this.remoteBaseDir);
	}

	get lock() {
		return getTraversalLock(this.stateKey);
	}

	async traverse(options?: { freshness?: WalkFreshness }): Promise<StatModel[]> {
		return await this.lock.runExclusive(async () => {
			await this.loadState();

			const freshness = options?.freshness ?? 'cached-ok';
			const hasCompleteCache = this.hasCompleteCache();

			if (freshness === 'fresh' && (hasCompleteCache || this.queue.length > 0)) {
				await this.clearLoadedState();
			}

			if (freshness === 'cached-ok' && hasCompleteCache) return this.getAllFromCache();

			if (this.queue.length === 0) {
				this.queue = [this.remoteBaseDir];
				this.processedCount = 0;
			}

			await this.bfsTraverse();
			await this.saveState();
			return this.getAllFromCache();
		});
	}

	hasCompleteCache(): boolean {
		return this.hasLoadedCache && this.queue.length === 0;
	}

	/**
	 * BFS traversal (initial scan or resume)
	 */
	private async bfsTraverse(): Promise<void> {
		while (this.queue.length > 0) {
			const currentPath = this.queue[0];
			const normalizedPath = this.normalizeDirPath(currentPath);

			try {
				const cachedItems = this.nodes[normalizedPath];
				const resultItems = cachedItems
					? cachedItems
					: (
							await executeWithRetry(() =>
								getContents(this.remoteServerUrl, this.token, currentPath),
							)
						).map(fileStatToStatModel);

				if (!cachedItems) this.nodes[normalizedPath] = resultItems;

				for (const item of resultItems) {
					if (item.isDir)
						this.queue.push(this.resolveTraversalPath(currentPath, item.path));
				}

				this.queue.shift();
				this.processedCount++;

				if (this.processedCount % this.saveInterval === 0) await this.saveState();
			} catch (err) {
				logger.error(`Error processing ${currentPath}`, err);

				if (isNotFoundError(err)) {
					this.queue.shift();
					this.processedCount++;
					await this.saveState();
					continue;
				}

				await this.saveState();
				throw err;
			}
		}
	}

	/**
	 * Get all results from cache
	 */
	private getAllFromCache(): StatModel[] {
		const results: StatModel[] = [];
		for (const items of Object.values(this.nodes)) results.push(...items);
		return results;
	}

	/**
	 * Load state
	 */
	private async loadState(): Promise<void> {
		let remoteRecord = await this.syncRecord.getRemoteRecord();

		if (!this.hasPersistedRemoteRecord(remoteRecord) && this.legacyTraversalKey) {
			const legacyCache = await traverseWebDAVKV.get(this.legacyTraversalKey);
			if (legacyCache) {
				remoteRecord = {
					...createEmptyRemoteRecord(),
					queue: legacyCache.queue,
					nodes: legacyCache.nodes,
					isComplete: legacyCache.queue.length === 0,
				};
				await this.syncRecord.setRemoteRecord(remoteRecord);
				await traverseWebDAVKV.unset(this.legacyTraversalKey);
			}
		}

		const cache = remoteRecord;
		if (cache) {
			if (cache.queue.some((path) => !this.isPathWithinBase(path))) {
				logger.warn('Detected stale traversal cache, clearing incompatible queue entries');
				await this.syncRecord.clearRemoteRecord();
				if (this.legacyTraversalKey) await traverseWebDAVKV.unset(this.legacyTraversalKey);
				this.queue = [];
				this.nodes = {};
				this.hasLoadedCache = false;
				this.processedCount = 0;
				return;
			}

			this.queue = cache.queue || [];
			this.nodes = cache.nodes || {};
			this.hasLoadedCache = true;
			this.processedCount = 0;
			return;
		}

		this.queue = [];
		this.nodes = {};
		this.hasLoadedCache = false;
		this.processedCount = 0;
	}

	/**
	 * Save current state
	 */
	private async saveState(): Promise<void> {
		const currentRemoteRecord = await this.syncRecord.getRemoteRecord();
		const nextRemoteRecord: RemoteRecordModel = {
			...currentRemoteRecord,
			queue: this.queue,
			nodes: this.nodes,
			isComplete: this.queue.length === 0,
		};
		await this.syncRecord.setRemoteRecord(nextRemoteRecord);
		if (this.legacyTraversalKey) await traverseWebDAVKV.unset(this.legacyTraversalKey);
		this.hasLoadedCache = true;
	}

	private async clearLoadedState(): Promise<void> {
		await this.syncRecord.clearRemoteRecord();
		if (this.legacyTraversalKey) await traverseWebDAVKV.unset(this.legacyTraversalKey);
		this.queue = [];
		this.nodes = {};
		this.hasLoadedCache = false;
		this.processedCount = 0;
	}

	private hasPersistedRemoteRecord(remoteRecord: RemoteRecordModel): boolean {
		return (
			remoteRecord.isComplete ||
			remoteRecord.queue.length > 0 ||
			Object.keys(remoteRecord.nodes).length > 0
		);
	}

	/**
	 * Clear cache (force re-traversal)
	 */
	async clearCache(): Promise<void> {
		await this.lock.runExclusive(async () => {
			await this.clearLoadedState();
		});
	}

	/**
	 * Check if cache is valid
	 */
	async isCacheValid(): Promise<boolean> {
		const cache = await this.syncRecord.getRemoteRecord();
		return Array.isArray(cache.queue) && cache.queue.length === 0 && !!cache.nodes;
	}
}
