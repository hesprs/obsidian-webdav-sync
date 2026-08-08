import type { DatabaseAsync, StoreAsync } from 'uni-kv';
import { deleteMemoryDB, openIndexedDB, openMemoryDB } from 'uni-kv';
import type { General, MaybePromise, RecordStat } from '@/types';

export type IndexedDBSchema = Record<string, RecordStat>;
export type RecordStore = StoreAsync<RecordStat>;

export const SYNC_STATE_STORE_NAME = 'sync-state';
export const STORAGE_NAME = 'sync-engine';

export default class Storage {
	private readonly memoryDB = openMemoryDB<General, General>(STORAGE_NAME);
	private readonly indexedDB = openIndexedDB<IndexedDBSchema>(STORAGE_NAME);

	constructor(private readonly ctx: { getNamespace: () => string }) {}

	private readonly getRecordStore = (namespace?: string) =>
		this.indexedDB.getStore(namespace || this.ctx.getNamespace());

	private readonly deleteRecordStore = (namespace?: string): MaybePromise<void> => {
		try {
			namespace ??= this.ctx.getNamespace();
		} catch {
			return; // When the backend is not set, no need to delete
		}
		return this.indexedDB.deleteStore(namespace);
	};

	private readonly clearRecordStores = () => this.indexedDB.clearStores();

	private readonly recordStoreExists = (namespace?: string): MaybePromise<boolean> => {
		try {
			namespace ??= this.ctx.getNamespace();
		} catch {
			return false; // When the backend is not set, assume no store
		}
		return this.indexedDB.getStoreNames().then((names) => names.includes(namespace));
	};

	readonly root = {
		clearRecordStores: this.clearRecordStores,
		deleteRecordStore: this.deleteRecordStore,
		getRecordStore: this.getRecordStore,
		indexedDB: this.indexedDB as DatabaseAsync<General, General>,
		memoryDB: this.memoryDB,
		recordStoreExists: this.recordStoreExists,
	};

	readonly dispose = () => {
		deleteMemoryDB(STORAGE_NAME);
		void this.indexedDB.dispose();
	};
}
