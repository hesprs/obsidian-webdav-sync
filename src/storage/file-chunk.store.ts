import localspace, { ttlPlugin } from 'localspace';
import isSub from '~/utils/is-sub';
import logger from '~/utils/logger';
import type { FileChunkKey } from '.';
import {
	FILE_CHUNK_STORE_NAME,
	STORAGE_NAME,
	createStorageUnavailableError,
} from './store.interface';

export default class IndexedDbFileChunkStore {
	private initPromise: Promise<void> | undefined;
	private readonly store = localspace.createInstance({
		coalesceWrites: false,
		driver: [localspace.INDEXEDDB],
		name: STORAGE_NAME,
		plugins: [ttlPlugin({ defaultTTL: 60 * 1000 * 60 * 10 })],
		storeName: FILE_CHUNK_STORE_NAME,
	});

	async initialize() {
		if (this.initPromise) return await this.initPromise;
		this.initPromise = this.store.ready().catch((error: unknown) => {
			const storageError = createStorageUnavailableError(error);
			logger.error(`Failed to initialize storage: ${FILE_CHUNK_STORE_NAME}`, error);
			throw storageError;
		});
		return await this.initPromise;
	}

	async unload() {
		await this.store.destroy();
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

	async getFileChunk(key: string): Promise<ArrayBuffer | null> {
		return await this.run(
			'get record entry',
			async () => await this.store.getItem<ArrayBuffer>(key),
		);
	}

	async getFileChunkKeys({
		namespace,
		path,
		size,
	}: {
		namespace: string;
		path: string;
		size: number;
	}): Promise<Array<FileChunkKey>> {
		return await this.run('get file chunk keys', async () => {
			const keysToDelete: Array<string> = [];
			const keysToReturn: Array<FileChunkKey> = [];
			(await this.store.keys())
				.filter((key) => {
					const { namespace: ns, path: p } = this.parseKey(key);
					return ns === namespace && p === path;
				})
				.forEach((key) => {
					const { start, end, size: s } = this.parseKey(key);
					if (s !== size) keysToDelete.push(key);
					else keysToReturn.push({ end, key, start });
				});
			await this.store.removeItems(keysToDelete);
			return keysToReturn;
		});
	}

	async setFileChunk(
		chunk: ArrayBuffer,
		options: {
			namespace: string;
			path: string;
			start: number;
			size: number;
			end: number;
		},
	): Promise<void> {
		await this.run('set file chunk', async () => {
			await this.store.setItem(this.getKey(options), chunk);
		});
	}

	async removeEntry(_namespace: string, _path: string): Promise<void> {
		await this.run('delete record entry', async () => {
			const keys = (await this.store.keys()).filter((key) => {
				const { namespace, path } = this.parseKey(key);
				return namespace === _namespace && path === _path;
			});
			await this.store.removeItems(keys);
		});
	}

	async removeSubDir(_namespace: string, _path: string): Promise<void> {
		await this.run('delete record sub directory', async () => {
			const keys = (await this.store.keys()).filter((key) => {
				const { namespace, path } = this.parseKey(key);
				return namespace === _namespace && isSub(_path, path, true);
			});
			await this.store.removeItems(keys);
		});
	}

	async removeNamespace(_namespace: string): Promise<void> {
		await this.run('clear record in a namespace', async () => {
			const keys = (await this.store.keys()).filter(
				(key) => this.parseKey(key).namespace === _namespace,
			);
			await this.store.removeItems(keys);
		});
	}

	async removeAll(): Promise<void> {
		await this.run('clear record', async () => {
			await this.store.clear();
		});
	}

	private getKey({
		namespace,
		size,
		start,
		end,
		path,
	}: {
		namespace: string;
		size: number;
		start: number;
		end: number;
		path: string;
	}): string {
		return `${FILE_CHUNK_STORE_NAME}:${namespace}:${size}:${start}:${end}:${path}`;
	}

	private parseKey(key: string): {
		namespace: string;
		size: number;
		start: number;
		end: number;
		path: string;
	} {
		const i = key.indexOf(':');
		const j = key.indexOf(':', i + 1);
		const k = key.indexOf(':', j + 1);
		const l = key.indexOf(':', k + 1);
		const m = key.indexOf(':', l + 1);

		return {
			end: Number(key.slice(l + 1, m)),
			namespace: key.slice(i + 1, j),
			path: key.slice(m + 1),
			size: Number(key.slice(j + 1, k)),
			start: Number(key.slice(k + 1, l)),
		};
	}
}
