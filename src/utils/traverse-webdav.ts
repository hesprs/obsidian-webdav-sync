import { join } from 'node:path';
import type { StatModel } from '~/model/stat.model';
import { getDirectoryContents } from '~/api';
import { traverseWebDAVKV } from '~/storage';
import { Mutex } from '~/utils/mutex';
import { apiLimiter } from './api-limiter';
import { fileStatToStatModel } from './file-stat-to-stat-model';
import { is503Error } from './is-503-error';
import logger from './logger';
import sleep from './sleep';
import { stdRemotePath } from './std-remote-path';
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
	private kvKey: string;
	private saveInterval: number;

	private queue: string[] = [];
	private nodes: Record<string, StatModel[]> = {};
	private processedCount: number = 0;
	private hasLoadedCache: boolean = false;

	/**
	 * Normalize directory path for use as nodes key
	 */
	private normalizeDirPath(path: string): string {
		return stdRemotePath(path);
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
		return this.normalizeDirPath(join(current, childPath));
	}

	constructor(options: {
		remoteServerUrl: string;
		token: string;
		remoteBaseDir: string;
		kvKey: string;
		saveInterval?: number;
	}) {
		this.remoteServerUrl = options.remoteServerUrl;
		this.token = options.token;
		this.remoteBaseDir = options.remoteBaseDir;
		this.kvKey = options.kvKey;
		this.saveInterval = Math.max(options.saveInterval || 1, 1);
	}

	get lock() {
		return getTraversalLock(this.kvKey);
	}

	async traverse(options?: { freshness?: WalkFreshness }): Promise<StatModel[]> {
		return await this.lock.runExclusive(async () => {
			await this.loadState();

			const freshness = options?.freshness ?? 'cached-ok';
			const hasCompleteCache = this.hasCompleteCache();

			if (freshness === 'fresh' && (hasCompleteCache || this.queue.length > 0)) {
				await this.clearLoadedState();
			}

			if (freshness === 'cached-ok' && hasCompleteCache) {
				return this.getAllFromCache();
			}

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
		const cache = await traverseWebDAVKV.get(this.kvKey);
		if (cache) {
			if (cache.queue.some((path) => !this.isPathWithinBase(path))) {
				logger.warn('Detected stale traversal cache, clearing incompatible queue entries');
				await traverseWebDAVKV.unset(this.kvKey);
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
		await traverseWebDAVKV.set(this.kvKey, {
			queue: this.queue,
			nodes: this.nodes,
		});
		this.hasLoadedCache = true;
	}

	private async clearLoadedState(): Promise<void> {
		await traverseWebDAVKV.unset(this.kvKey);
		this.queue = [];
		this.nodes = {};
		this.hasLoadedCache = false;
		this.processedCount = 0;
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
		const cache = await traverseWebDAVKV.get(this.kvKey);
		if (!cache) return false;
		return Array.isArray(cache.queue) && cache.queue.length === 0 && !!cache.nodes;
	}
}
