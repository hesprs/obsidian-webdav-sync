import { openMemoryDB } from 'uni-kv';
import type { MemoryStorageMeta, MemoryStorageSchema } from '~/types';
import { STORAGE_NAME } from '~/consts';
import type { LocalFs, RemoteFs, Stat, WrappedLocalFs, WrappedRemoteFs } from '../interface';

const db = openMemoryDB<MemoryStorageSchema, MemoryStorageMeta>(STORAGE_NAME);

function alignRemoteContext(uid: string) {
	const store = db.getStore('remoteStatContext');
	if (db.getMeta('lastRemoteContextUid') !== uid) {
		store.clear();
		db.setMeta('lastRemoteContextUid', uid);
	}
	return store;
}

function alignLocalContext(uid: string) {
	const store = db.getStore('localStatContext');
	if (db.getMeta('lastLocalContextUid') !== uid) {
		store.clear();
		db.setMeta('lastLocalContextUid', uid);
	}
	return store;
}

function getCachedReadSize(store: ReturnType<typeof db.getStore<Stat>>, key: string) {
	const stat = store.get(key);
	if (stat === undefined || stat.isDir) return undefined;
	return stat.size;
}

async function cacheStat(store: ReturnType<typeof db.getStore<Stat>>, stat: Promise<Stat> | Stat) {
	const resolvedStat = await stat;
	store.set(resolvedStat.key, resolvedStat);
	return resolvedStat;
}

async function cacheStats(
	store: ReturnType<typeof db.getStore<Stat>>,
	stats: Promise<Array<Stat>> | Array<Stat>,
) {
	const resolvedStats = await stats;
	for (const stat of resolvedStats) store.set(stat.key, stat);
	return resolvedStats;
}

async function replaceStats(
	store: ReturnType<typeof db.getStore<Stat>>,
	stats: Promise<Array<Stat>> | Array<Stat>,
) {
	const resolvedStats = await stats;
	store.clear();
	for (const stat of resolvedStats) store.set(stat.key, stat);
	return resolvedStats;
}

class ContextRemoteFs implements WrappedRemoteFs {
	private readonly statStore: ReturnType<typeof db.getStore<Stat>>;

	constructor(public readonly original: RemoteFs) {
		this.statStore = alignRemoteContext(original.getUid());
	}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		return await this.original.read(key, size ?? getCachedReadSize(this.statStore, key));
	}

	async readStream(key: string, size?: number) {
		return await this.original.readStream(key, size ?? getCachedReadSize(this.statStore, key));
	}

	write(key: string, value: ArrayBuffer) {
		return this.original.write(key, value);
	}

	delete(key: string) {
		return this.original.delete(key);
	}

	mkdir(key: string, recursive?: boolean) {
		return this.original.mkdir(key, recursive);
	}

	async stat(key: string) {
		return await cacheStat(this.statStore, this.original.stat(key));
	}

	exists(key: string) {
		return this.original.exists(key);
	}

	async list(key: string) {
		return await cacheStats(this.statStore, this.original.list(key));
	}

	async listAll(key: string, progress?: Parameters<RemoteFs['listAll']>[1]) {
		return await replaceStats(this.statStore, this.original.listAll(key, progress));
	}
}

class ContextLocalFs implements WrappedLocalFs {
	private readonly statStore: ReturnType<typeof db.getStore<Stat>>;

	constructor(public readonly original: LocalFs) {
		this.statStore = alignLocalContext(original.getUid());
	}

	getUid() {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		return await this.original.read(key, size ?? getCachedReadSize(this.statStore, key));
	}

	write(key: string, value: ArrayBuffer) {
		return this.original.write(key, value);
	}

	writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		return this.original.writeStream(key, value);
	}

	delete(key: string) {
		return this.original.delete(key);
	}

	move(oldKey: string, newKey: string) {
		return this.original.move(oldKey, newKey);
	}

	mkdir(key: string) {
		return this.original.mkdir(key);
	}

	async stat(key: string) {
		return await cacheStat(this.statStore, this.original.stat(key));
	}

	async listAll(key: string) {
		return await replaceStats(this.statStore, this.original.listAll(key));
	}
}

export function remoteContextWrapper(original: RemoteFs): WrappedRemoteFs {
	return new ContextRemoteFs(original);
}

export function localContextWrapper(original: LocalFs): WrappedLocalFs {
	return new ContextLocalFs(original);
}
