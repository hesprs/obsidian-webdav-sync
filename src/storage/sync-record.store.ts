import localspace from 'localspace';
import { isNil } from 'lodash-es';
import type { RecordStatModel, RecordStatsMap } from '~/types';
import { isSub } from '~/utils/is-sub';
import logger from '~/utils/logger';
import {
	createStorageUnavailableError,
	parseKey,
	STORAGE_NAME,
	SYNC_STATE_STORE_NAME,
} from './store.interface';

export class IndexedDbSyncStateStore {
	private readonly store = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: SYNC_STATE_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: true,
        coalesceWindowMs: 500,
	});

	private initPromise: Promise<void> | undefined;

	async initialize() {
		if (this.initPromise) return await this.initPromise;
		this.initPromise = this.store.ready().catch((error: unknown) => {
			const storageError = createStorageUnavailableError(error);
			logger.error('Failed to initialize sync state storage', error);
			throw storageError;
		});
		return await this.initPromise;
	}

	async get(namespace: string, path: string): Promise<RecordStatModel | undefined> {
		return await this.run('read record', async () => {
			return (
				(await this.store.getItem<RecordStatModel>(this.getKey(namespace, path))) ??
				undefined
			);
		});
	}

	async getAll(_namespace: string): Promise<RecordStatsMap> {
		return await this.run('read all records', async () => {
			const result: RecordStatsMap = new Map();
			const keys = (await this.store.keys()).filter(
				(key) => parseKey(key).namespace === _namespace,
			);
			(await this.store.getItems<RecordStatModel>(keys))
				.filter(({ value }) => !isNil(value))
				.map(({ key, value }) => result.set(parseKey(key).path, value as RecordStatModel));
			return result;
		});
	}

	async set(namespace: string, path: string, stats: RecordStatModel): Promise<void> {
		await this.run('write local record', async () => {
			await this.store.setItem(this.getKey(namespace, path), stats);
		});
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

	private async run<T>(operation: string, action: () => Promise<T>): Promise<T> {
		try {
			await this.initialize();
			return await action();
		} catch (error) {
			logger.error(`Failed to ${operation}`, error);
			throw error;
		}
	}

	private getKey(namespace: string, path: string): string {
		return `sync-state:${namespace}:${path}`;
	}
}
