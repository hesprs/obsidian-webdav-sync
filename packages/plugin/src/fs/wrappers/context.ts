import type { DatabaseSync, StoreSync } from 'uni-kv';
import type { MemoryDBMeta, MemoryDBSchema } from '@/modules/Registrar';
import type { MaybePromise, Progress, Stat } from '@/types';
import type { LocalFs, RemoteFs, WrappedLocalFs, WrappedRemoteFs } from '../interface';

type DB = DatabaseSync<MemoryDBSchema, MemoryDBMeta>;

function getCachedReadSize(store: StoreSync<Stat>, key: string) {
	const stat = store.get(key);
	if (stat === undefined || stat.isDir) return undefined;
	return stat.size;
}

function upsertFileStat(store: StoreSync<Stat>, key: string, uid: string, size: number) {
	store.set(key, { isDir: false, key, mtime: 0, size, uid });
}

function upsertFolderStat(store: StoreSync<Stat>, key: string) {
	store.set(key, { isDir: true, key });
}

function moveCachedStat(store: StoreSync<Stat>, oldKey: string, newKey: string) {
	const stat = store.get(oldKey);
	if (stat === undefined) return;
	store.delete(oldKey);
	store.set(newKey, { ...stat, key: newKey });
}

async function cacheStat(store: StoreSync<Stat>, stat: MaybePromise<Stat>) {
	const resolvedStat = await stat;
	store.set(resolvedStat.key, resolvedStat);
	return resolvedStat;
}

async function replaceStats(store: StoreSync<Stat>, stats: MaybePromise<Array<Stat>>) {
	const resolvedStats = await stats;
	store.clear();
	for (const stat of resolvedStats) store.set(stat.key, stat);
	return resolvedStats;
}

class ContextRemoteFs implements WrappedRemoteFs {
	private readonly statStore: StoreSync<Stat>;

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

	async write(key: string, value: ArrayBuffer) {
		const uid = await this.original.write(key, value);
		upsertFileStat(this.statStore, key, uid, value.byteLength);
		return uid;
	}

	async delete(key: string) {
		await this.original.delete(key);
		this.statStore.delete(key);
	}

	async mkdir(key: string, recursive?: boolean) {
		await this.original.mkdir(key, recursive);
		upsertFolderStat(this.statStore, key);
	}

	async move(oldKey: string, newKey: string) {
		await this.original.move(oldKey, newKey);
		moveCachedStat(this.statStore, oldKey, newKey);
	}

	async stat(key: string) {
		return await cacheStat(this.statStore, this.original.stat(key));
	}

	exists(key: string) {
		return this.original.exists(key);
	}

	async list(key: string, progress?: (prog: Progress) => void) {
		return await replaceStats(this.statStore, this.original.list(key, progress));
	}
}

class ContextLocalFs implements WrappedLocalFs {
	private readonly statStore: StoreSync<Stat>;

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

	async write(key: string, value: ArrayBuffer) {
		const uid = await this.original.write(key, value);
		upsertFileStat(this.statStore, key, uid, value.byteLength);
		return uid;
	}

	async writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		const uid = await this.original.writeStream(key, value);
		upsertFileStat(this.statStore, key, uid, 0);
		return uid;
	}

	async delete(key: string) {
		await this.original.delete(key);
		this.statStore.delete(key);
	}

	async move(oldKey: string, newKey: string) {
		await this.original.move(oldKey, newKey);
		moveCachedStat(this.statStore, oldKey, newKey);
	}

	async mkdir(key: string) {
		await this.original.mkdir(key);
		upsertFolderStat(this.statStore, key);
	}

	async stat(key: string) {
		return await cacheStat(this.statStore, this.original.stat(key));
	}

	async list(key: string) {
		return await replaceStats(this.statStore, this.original.list(key));
	}
}

export function remoteContextWrapper(original: RemoteFs, db: DB): WrappedRemoteFs {
	return new ContextRemoteFs(original, db);
}

export function localContextWrapper(original: LocalFs, db: DB): WrappedLocalFs {
	return new ContextLocalFs(original, db);
}
