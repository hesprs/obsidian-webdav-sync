import type { MaybePromise, StatsMap } from '~/types';
import { getDirectoryContents } from '~/api';
import { remotePathToAbsolute, remotePathToVault } from '~/platform/path';
import { apiLimiter } from '~/utils/api-limiter';
import { fileStatToStatModel } from '~/utils/file-stat-to-stat-model';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import sleep from '~/utils/sleep';

const getContents = apiLimiter.wrap(getDirectoryContents);

export interface TraversalProgress {
	processedDirectories: number;
	totalDirectories: number;
	currentDirectory?: string;
}

async function executeWithRetry<T>(func: () => MaybePromise<T>): Promise<T> {
	while (true) {
		try {
			return await func();
		} catch (err) {
			if (isRetryableError(err)) await sleep(5_000);
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

export class WebDAVTraversal {
	private remoteServerUrl: string;
	private token: string;
	private remoteBaseDir: string;
	private stateKey: string;

	private queue: string[] = [];
	private nodes: StatsMap = new Map();
	private processedCount: number = 0;

	constructor(options: {
		remoteServerUrl: string;
		token: string;
		remoteBaseDir: string;
		stateKey: string;
	}) {
		this.remoteServerUrl = options.remoteServerUrl;
		this.token = options.token;
		this.remoteBaseDir = options.remoteBaseDir;
		this.stateKey = options.stateKey;
	}

	async traverse(options?: {
		onProgress?: (progress: TraversalProgress) => MaybePromise<void>;
	}): Promise<StatsMap> {
		if (this.queue.length > 0) this.clearLoadedState();

		if (this.queue.length === 0) {
			this.queue = [this.remoteBaseDir];
			this.processedCount = 0;
		}

		await this.reportProgress(options?.onProgress);

		await this.bfsTraverse(options?.onProgress);
		return this.nodes;
	}

	/**
	 * BFS traversal
	 */
	private async bfsTraverse(
		onProgress?: (progress: TraversalProgress) => MaybePromise<void>,
	): Promise<void> {
		while (this.queue.length > 0) {
			// Extract all paths at the current BFS level
			const currentLevelPaths = this.queue.splice(0);
			const nextLevelPaths: string[] = [];

			await Promise.all(
				currentLevelPaths.map(async (currentPath) => {
					try {
						const resultItems = (
							await executeWithRetry(() =>
								getContents(this.remoteServerUrl, this.token, currentPath),
							)
						).map(fileStatToStatModel);
						for (const item of resultItems) {
							const path = remotePathToVault(this.remoteBaseDir, item.path);
							const absolutePath = remotePathToAbsolute(this.remoteBaseDir, item);
							this.nodes.set(path, { ...item, path: absolutePath });
							if (item.isDir) nextLevelPaths.push(absolutePath);
						}
						this.processedCount++;
						await this.reportProgress(onProgress, currentPath);
					} catch (err) {
						logger.error(`Error processing ${currentPath}`, err);
						if (isNotFoundError(err)) {
							this.processedCount++;
							await this.reportProgress(onProgress, currentPath);
							return;
						}
						throw err;
					}
				}),
			);

			// Populate queue for the next iteration/level
			this.queue.push(...nextLevelPaths);
		}
	}

	private async reportProgress(
		onProgress?: (progress: TraversalProgress) => MaybePromise<void>,
		currentDirectory?: string,
	): Promise<void> {
		if (!onProgress) {
			return;
		}

		await onProgress({
			processedDirectories: this.processedCount,
			totalDirectories: this.processedCount + this.queue.length,
			currentDirectory,
		});
	}

	private clearLoadedState() {
		this.queue = [];
		this.nodes.clear();
		this.processedCount = 0;
	}
}
