import type { LocalSpaceInstance } from 'localspace';
import localspace from 'localspace';
import isSub from '~/utils/is-sub';
import logger from '~/utils/logger';

export function createStorageUnavailableError(cause: unknown): Error {
	if (cause instanceof Error)
		return new Error(`Sync state storage unavailable: ${cause.message}`);
	return new Error('Sync state storage unavailable');
}

export const STORAGE_NAME = 'obsidian-webdav-sync';
export const SYNC_STATE_STORE_NAME = 'sync-state';
export const BASE_TEXT_STORE_NAME = 'base-text';
export const FILE_CHUNK_STORE_NAME = 'file-chunk';

export function parseKey(key: string) {
	const i = key.indexOf(':');
	const j = key.indexOf(':', i + 1);
	return { namespace: key.slice(i + 1, j), path: key.slice(j + 1) };
}

export abstract class BaseStore {
	protected readonly store: LocalSpaceInstance;
	private initPromise: Promise<void> | undefined;
	private readonly storeName: string;

	constructor(storeName: string) {
		this.store = localspace.createInstance({
			coalesceWindowMs: 500,
			coalesceWrites: true,
			driver: [localspace.INDEXEDDB],
			name: STORAGE_NAME,
			storeName,
		});
		this.storeName = storeName;
	}

	async initialize() {
		if (this.initPromise) return await this.initPromise;
		this.initPromise = this.store.ready().catch((error: unknown) => {
			const storageError = createStorageUnavailableError(error);
			logger.error(`Failed to initialize storage: ${this.storeName}`, error);
			throw storageError;
		});
		return await this.initPromise;
	}

	async unload() {
		await this.store.destroy();
	}

	protected async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
		try {
			await this.initialize();
			return await action();
		} catch (error) {
			logger.error(`Failed to ${operation}`, error);
			throw error;
		}
	}

	async removeEntry(namespace: string, path: string): Promise<void> {
		await this.run('delete record entry', async () => {
			await this.store.removeItem(this.getKey(namespace, path));
		});
	}

	async removeSubDir(_namespace: string, _path: string): Promise<void> {
		await this.run('delete record sub directory', async () => {
			const keys = (await this.store.keys()).filter((key) => {
				const { namespace, path } = parseKey(key);
				return namespace === _namespace && isSub(_path, path, true);
			});
			await this.store.removeItems(keys);
		});
	}

	async removeNamespace(_namespace: string): Promise<void> {
		await this.run('clear record in a namespace', async () => {
			const keys = (await this.store.keys()).filter(
				(key) => parseKey(key).namespace === _namespace,
			);
			await this.store.removeItems(keys);
		});
	}

	async removeAll(): Promise<void> {
		await this.run('clear record', async () => {
			await this.store.clear();
		});
	}

	protected getKey(namespace: string, path: string): string {
		return `${this.storeName}:${namespace}:${path}`;
	}
}

export type FileChunkKey = {
	start: number;
	end: number;
	key: string;
};
