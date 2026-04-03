import localspace from 'localspace';
import type { StatsMap, SyncStateModel } from '~/types';
import logger from '~/utils/logger';

type SyncStateMetaRecord = {
	version: 1;
};

const STORAGE_NAME = 'obsidian-webdav-sync';
const SYNC_STATE_STORE_NAME = 'sync-state';
const BASE_TEXT_STORE_NAME = 'base-text';
const SYNC_STATE_STORAGE_VERSION: SyncStateMetaRecord['version'] = 1;

function createStorageUnavailableError(cause: unknown): Error {
	if (cause instanceof Error) {
		return new Error(`Sync state storage unavailable: ${cause.message}`);
	}

	return new Error('Sync state storage unavailable');
}

export class IndexedDbSyncStateStore {
	private readonly store = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: SYNC_STATE_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: true,
	});

	private initializationPromise: Promise<void> | undefined;
	private initializationError: Error | undefined;

	async initialize(): Promise<void> {
		if (this.initializationPromise) return await this.initializationPromise;

		this.initializationPromise = this.store.ready().then(
			() => {
				this.initializationError = undefined;
			},
			(error: unknown) => {
				const storageError = createStorageUnavailableError(error);
				this.initializationError = storageError;
				logger.error('Failed to initialize sync state storage', error);
				throw storageError;
			},
		);

		return await this.initializationPromise;
	}

	async getRemote(namespace: string): Promise<StatsMap | undefined> {
		return await this.run('read remote sync state', async () => {
			return (await this.store.getItem<StatsMap>(this.getRemoteKey(namespace))) ?? undefined;
		});
	}

	async setRemote(namespace: string, remoteRecord: StatsMap): Promise<void> {
		await this.run('write remote sync state', async () => {
			await this.store.setItem(this.getRemoteKey(namespace), remoteRecord);
			await this.store.setItem(this.getMetaKey(namespace), {
				version: SYNC_STATE_STORAGE_VERSION,
			} satisfies SyncStateMetaRecord);
		});
	}

	async clearRemote(namespace: string): Promise<void> {
		await this.run('clear remote sync state', async () => {
			await this.store.removeItem(this.getRemoteKey(namespace));
		});
	}

	async getLocal(namespace: string): Promise<StatsMap | undefined> {
		return await this.run('read local sync state', async () => {
			return (await this.store.getItem<StatsMap>(this.getLocalKey(namespace))) ?? undefined;
		});
	}

	async setLocal(namespace: string, localRecords: StatsMap): Promise<void> {
		await this.run('write local sync state', async () => {
			await this.store.setItem(this.getLocalKey(namespace), localRecords);
			await this.store.setItem(this.getMetaKey(namespace), {
				version: SYNC_STATE_STORAGE_VERSION,
			} satisfies SyncStateMetaRecord);
		});
	}

	// clear a namespace
	async delete(namespace: string): Promise<void> {
		await this.run('delete sync state namespace', async () => {
			await Promise.all([
				this.store.removeItem(this.getMetaKey(namespace)),
				this.store.removeItem(this.getRemoteKey(namespace)),
				this.store.removeItem(this.getLocalKey(namespace)),
			]);
		});
	}

	// clear everything
	async clear(): Promise<void> {
		await this.run('clear sync state', async () => {
			await this.store.clear();
		});
	}

	private async ensureReady(): Promise<void> {
		if (this.initializationError) throw this.initializationError;
		await this.initialize();
		if (this.initializationError) throw this.initializationError as Error;
	}

	private async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
		try {
			await this.ensureReady();
			return await action();
		} catch (error) {
			logger.error(`Failed to ${operation}`, error);
			throw error;
		}
	}

	private getMetaKey(namespace: string): string {
		return `sync-state:${namespace}:meta`;
	}

	private getRemoteKey(namespace: string): string {
		return `sync-state:${namespace}:remote`;
	}

	private getLocalKey(namespace: string): string {
		return `sync-state:${namespace}:local`;
	}
}

export class IndexedDbBaseTextStore {
	private readonly store = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: BASE_TEXT_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: true,
	});

	private initializationPromise: Promise<void> | undefined;
	private initializationError: Error | undefined;

	async initialize(): Promise<void> {
		if (this.initializationPromise) return await this.initializationPromise;

		this.initializationPromise = this.store.ready().then(
			() => {
				this.initializationError = undefined;
			},
			(error: unknown) => {
				const storageError = createStorageUnavailableError(error);
				this.initializationError = storageError;
				logger.error('Failed to initialize sync state storage', error);
				throw storageError;
			},
		);

		return await this.initializationPromise;
	}

	async remove(namespace: string, path: string): Promise<void> {
		await this.run('clear remote sync state', async () => {
			await this.store.removeItem(this.getKey(namespace, path));
		});
	}

	async get(namespace: string, path: string): Promise<string | undefined> {
		return await this.run('read local sync state', async () => {
			return (await this.store.getItem<string>(this.getKey(namespace, path))) ?? undefined;
		});
	}

	async set(namespace: string, path: string, baseText: string): Promise<void> {
		await this.run('write local sync state', async () => {
			await this.store.setItem(this.getKey(namespace, path), baseText);
		});
	}

	// clear a namespace
	async delete(requiredNamespace: string): Promise<void> {
		await this.run('clear sync state', async () => {
			const keys = (await this.store.keys()).filter((key) => {
				const { namespace } = this.parseKey(key);
				return namespace === requiredNamespace;
			});
			await Promise.all(keys.map((key) => this.store.removeItem(key)));
		});
	}

	async clear(): Promise<void> {
		await this.run('clear sync state', async () => {
			await this.store.clear();
		});
	}

	private async ensureReady(): Promise<void> {
		if (this.initializationError) throw this.initializationError;
		await this.initialize();
		if (this.initializationError) throw this.initializationError as Error;
	}

	private async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
		try {
			await this.ensureReady();
			return await action();
		} catch (error) {
			logger.error(`Failed to ${operation}`, error);
			throw error;
		}
	}

	parseKey(key: string) {
		const i = key.indexOf(':');
		const j = key.indexOf(':', i + 1);
		return { namespace: key.slice(i + 1, j), path: key.slice(j + 1) };
	}

	async getKeys(): Promise<string[]> {
		return this.run('clear sync state', async () => {
			return this.store.keys();
		});
	}

	private getKey(namespace: string, path: string): string {
		return `base-text:${namespace}:${path}`;
	}
}

export function createSyncState(remote?: StatsMap, local?: StatsMap): SyncStateModel {
	return {
		version: 1,
		remoteRecords: remote ?? new Map(),
		localRecords: local ?? new Map(),
	};
}
