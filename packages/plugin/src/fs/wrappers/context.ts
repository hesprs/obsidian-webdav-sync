import type { MemoryDatabase, MemoryStore } from 'uni-kv';
import type { MemoryDBMeta, MemoryDBSchema } from '@/modules/Storage';
import type { Stat } from '@/types';
import type { LocalFs, RemoteFs, WrappedLocalFs, WrappedRemoteFs } from '../interface';

type DB = MemoryDatabase<MemoryDBSchema, MemoryDBMeta>;

function getCachedReadSize(store: MemoryStore<Stat>, key: string) {
	const stat = store.get(key);
	if (stat === undefined || stat.isDir) return undefined;
	return stat.size;
}

async function cacheStat(store: MemoryStore<Stat>, stat: Promise<Stat> | Stat) {
	const resolvedStat = await stat;
	store.set(resolvedStat.key, resolvedStat);
	return resolvedStat;
}

async function cacheStats(store: MemoryStore<Stat>, stats: Promise<Array<Stat>> | Array<Stat>) {
	const resolvedStats = await stats;
	for (const stat of resolvedStats) store.set(stat.key, stat);
	return resolvedStats;
}

async function replaceStats(store: MemoryStore<Stat>, stats: Promise<Array<Stat>> | Array<Stat>) {
	const resolvedStats = await stats;
	store.clear();
	for (const stat of resolvedStats) store.set(stat.key, stat);
	return resolvedStats;
}

class ContextRemoteFs implements WrappedRemoteFs {
	private readonly statStore: MemoryStore<Stat>;

	constructor(
		public readonly original: RemoteFs,
		db: DB,
	) {
		const uid = original.getUid();
		this.statStore = db.getStore('remoteStatContext');
		if (db.getMeta('lastRemoteContextUid') !== uid) {
			this.statStore.clear();
			db.setMeta('lastRemoteContextUid', uid);
		}
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
	private readonly statStore: MemoryStore<Stat>;

	constructor(
		public readonly original: LocalFs,
		db: DB,
	) {
		const uid = original.getUid();
		this.statStore = db.getStore('localStatContext');
		if (db.getMeta('lastLocalContextUid') !== uid) {
			this.statStore.clear();
			db.setMeta('lastLocalContextUid', uid);
		}
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

export function remoteContextWrapper(original: RemoteFs, db: DB): WrappedRemoteFs {
	return new ContextRemoteFs(original, db);
}

export function localContextWrapper(original: LocalFs, db: DB): WrappedLocalFs {
	return new ContextLocalFs(original, db);
}
