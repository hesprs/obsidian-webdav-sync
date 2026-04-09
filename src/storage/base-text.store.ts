import localspace from 'localspace';
import { isSub } from '~/utils/is-sub';
import logger from '~/utils/logger';
import {
	BASE_TEXT_STORE_NAME,
	createStorageUnavailableError,
	parseKey,
	STORAGE_NAME,
} from './store.interface';

export class IndexedDbBaseTextStore {
	private readonly store = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: BASE_TEXT_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: true,
        coalesceWindowMs: 500,
	});

	private initPromise: Promise<void> | undefined;

	async initialize() {
		if (this.initPromise) return await this.initPromise;
		this.initPromise = this.store.ready().catch((error: unknown) => {
			const storageError = createStorageUnavailableError(error);
			logger.error('Failed to initialize base text storage', error);
			throw storageError;
		});
		return await this.initPromise;
	}

	async get(namespace: string, path: string): Promise<string | undefined> {
		return await this.run('read base text', async () => {
			return (await this.store.getItem<string>(this.getKey(namespace, path))) ?? undefined;
		});
	}

	async set(namespace: string, path: string, baseText: string): Promise<void> {
		await this.run('write local base text', async () => {
			await this.store.setItem(this.getKey(namespace, path), baseText);
		});
	}

	async removeEntry(namespace: string, path: string): Promise<void> {
		await this.run('delete base text entry', async () => {
			await this.store.removeItem(this.getKey(namespace, path));
		});
	}

	async removeSubDir(_namespace: string, _path: string): Promise<void> {
		await this.run('delete base text sub directory', async () => {
			const keys = (await this.store.keys()).filter((key) => {
				const { namespace, path } = parseKey(key);
				return namespace === _namespace && isSub(_path, path, true);
			});
			await this.store.removeItems(keys);
		});
	}

	async removeNamespace(_namespace: string): Promise<void> {
		await this.run('clear base text in a namespace', async () => {
			const keys = (await this.store.keys()).filter(
				(key) => parseKey(key).namespace === _namespace,
			);
			await this.store.removeItems(keys);
		});
	}

	async removeAll(): Promise<void> {
		await this.run('clear base text', async () => {
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
		return `base-text:${namespace}:${path}`;
	}
}
