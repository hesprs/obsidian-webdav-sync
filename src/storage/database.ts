import type { Database, Store } from 'uni-kv';
import { openIndexedDB } from 'uni-kv';
import type { Stat } from '~/fs';
import type { RecordStat } from '~/types';

export const STORAGE_NAME = 'obsidian-webdav-sync';
export const SYNC_STATE_STORE_NAME = 'sync-state';
export const BASE_TEXT_STORE_NAME = 'base-text';

const STORAGE_VERSION = 1;
const STORAGE_VERSION_KEY = 'version';

export type StorageSchema = {
	'base-text': string;
	'sync-state': RecordStat;
};

type StorageMeta = {
	version: number;
};

export type StorageDatabase = Database<StorageSchema, StorageMeta>;

let storageDatabasePromise: Promise<StorageDatabase> | undefined;

export async function getStorageDatabase() {
	storageDatabasePromise ??= openIndexedDB<StorageSchema, StorageMeta>(STORAGE_NAME).then(
		async (db) => {
			const version = await db.getMeta(STORAGE_VERSION_KEY);
			if (version !== STORAGE_VERSION) {
				await db.clearStores();
				await db.setMeta(STORAGE_VERSION_KEY, STORAGE_VERSION);
			}
			return db;
		},
	);

	return await storageDatabasePromise;
}

export function parseKey(key: string) {
	const i = key.indexOf(':');
	return { namespace: key.slice(0, i), path: key.slice(i + 1) };
}

async function deleteMatchingKeys<T>(store: Store<T>, predicate: (key: string) => boolean) {
	const keys = (await store.keys()).filter(predicate);
	if (keys.length === 0) return;
	await store.batch(keys.map((key) => ({ key, type: 'delete' })));
}

async function getStores(db: StorageDatabase) {
	return await Promise.all([
		db.getStore(SYNC_STATE_STORE_NAME),
		db.getStore(BASE_TEXT_STORE_NAME),
	]);
}

export async function clearStorageNamespace(namespace: string, db?: StorageDatabase) {
	const storage = db ?? (await getStorageDatabase());
	const [syncStateStore, baseTextStore] = await getStores(storage);
	await Promise.all([
		deleteMatchingKeys(syncStateStore, (key) => parseKey(key).namespace === namespace),
		deleteMatchingKeys(baseTextStore, (key) => parseKey(key).namespace === namespace),
	]);
}

export async function clearAllStorage(db?: StorageDatabase) {
	const storage = db ?? (await getStorageDatabase());
	const [syncStateStore, baseTextStore] = await getStores(storage);
	await Promise.all([syncStateStore.clear(), baseTextStore.clear()]);
}

export function toRecordStat(local: Stat, remote: Stat): RecordStat {
	return !local.isDir && !remote.isDir
		? { isDir: false, local: local.uid, remote: remote.uid }
		: { isDir: true };
}
