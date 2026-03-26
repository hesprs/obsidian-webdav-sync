import localspace from 'localspace';
import type { RemoteRecordModel } from '~/model/sync-record.model';
import logger from '~/utils/logger';
import type { PersistedLocalRecordsModel, SyncStateStore } from './store.interface';

type SyncStateMetaRecord = {
	version: 1;
};

const SYNC_STATE_STORAGE_NAME = 'obsidian-webdav-sync';
const SYNC_STATE_STORE_NAME = 'sync-state';
const SYNC_STATE_STORAGE_VERSION: SyncStateMetaRecord['version'] = 1;

function createStorageUnavailableError(cause: unknown): Error {
	if (cause instanceof Error) {
		return new Error(`Sync state storage unavailable: ${cause.message}`);
	}

	return new Error('Sync state storage unavailable');
}

export class IndexedDbSyncStateStore implements SyncStateStore {
	private readonly store = localspace.createInstance({
		name: SYNC_STATE_STORAGE_NAME,
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

	async getRemote(namespace: string): Promise<RemoteRecordModel | undefined> {
		return await this.run('read remote sync state', async () => {
			return (
				(await this.store.getItem<RemoteRecordModel>(this.getRemoteKey(namespace))) ??
				undefined
			);
		});
	}

	async setRemote(namespace: string, remoteRecord: RemoteRecordModel): Promise<void> {
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

	async getLocal(namespace: string): Promise<PersistedLocalRecordsModel | undefined> {
		return await this.run('read local sync state', async () => {
			return (
				(await this.store.getItem<PersistedLocalRecordsModel>(
					this.getLocalKey(namespace),
				)) ?? undefined
			);
		});
	}

	async setLocal(namespace: string, localRecords: PersistedLocalRecordsModel): Promise<void> {
		await this.run('write local sync state', async () => {
			await this.store.setItem(this.getLocalKey(namespace), localRecords);
			await this.store.setItem(this.getMetaKey(namespace), {
				version: SYNC_STATE_STORAGE_VERSION,
			} satisfies SyncStateMetaRecord);
		});
	}

	async delete(namespace: string): Promise<void> {
		await this.run('delete sync state namespace', async () => {
			await Promise.all([
				this.store.removeItem(this.getMetaKey(namespace)),
				this.store.removeItem(this.getRemoteKey(namespace)),
				this.store.removeItem(this.getLocalKey(namespace)),
			]);
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
