import { beforeEach, expect, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';
import type { Stat } from '~/fs';
import type { MemoryStorageMeta, MemoryStorageSchema } from '~/types';
import { STORAGE_NAME } from '~/consts';
import { localContextWrapper, remoteContextWrapper } from '~/fs';
import { createVaultFs, ShimmedRemoteFs, toBuffer } from './utils';

const db = openMemoryDB<MemoryStorageSchema, MemoryStorageMeta>(STORAGE_NAME);

function getLocalStore() {
	return db.getStore('localStatContext');
}

function getRemoteStore() {
	return db.getStore('remoteStatContext');
}

class ContextTestRemoteFs extends ShimmedRemoteFs {
	public readCalls = [] as Array<[string, number | undefined]>;

	constructor(private readonly uid = 'remote') {
		super(async () => ({ headers: {}, status: 200, text: '' }));
	}

	getUid() {
		return this.uid;
	}

	async read(key: string, size?: number) {
		this.readCalls.push([key, size]);
		await this.request(key as never);
		return await this.readResponse(key);
	}
}

function fileStat(key: string, size = 5, uid = `${key}-uid`): Stat {
	return { isDir: false, key, mtime: 1, size, uid };
}

function folderStat(key: string): Stat {
	return { isDir: true, key };
}

function getStoreSnapshot(store: ReturnType<typeof getLocalStore>) {
	const result: Record<string, Stat> = {};
	for (const key of store.keys()) {
		const value = store.get(key);
		if (value !== undefined) result[key] = value;
	}
	return result;
}

beforeEach(() => {
	db.clearStores();
	db.setMeta('lastLocalContextUid', '');
	db.setMeta('lastRemoteContextUid', '');
});

test('remote wrapper clears stale context when uid changes at creation', async () => {
	getRemoteStore().set('stale.md', fileStat('stale.md'));
	getLocalStore().set('keep.md', fileStat('keep.md'));
	db.setMeta('lastRemoteContextUid', 'old-remote');

	remoteContextWrapper(new ContextTestRemoteFs('new-remote'));

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({});
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({ 'keep.md': fileStat('keep.md') });
	expect(db.getMeta('lastRemoteContextUid')).toBe('new-remote');
});

test('remote wrapper keeps context when uid matches at creation', async () => {
	getRemoteStore().set('keep.md', fileStat('keep.md'));
	db.setMeta('lastRemoteContextUid', 'same-remote');

	remoteContextWrapper(new ContextTestRemoteFs('same-remote'));

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'keep.md': fileStat('keep.md') });
	expect(db.getMeta('lastRemoteContextUid')).toBe('same-remote');
});

test('local wrapper clears stale context when uid changes at creation', async () => {
	const { original } = createVaultFs();
	original.getUid = () => 'new-local';
	getLocalStore().set('stale.md', fileStat('stale.md'));
	getRemoteStore().set('keep.md', fileStat('keep.md'));
	db.setMeta('lastLocalContextUid', 'old-local');

	localContextWrapper(original);

	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({});
	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'keep.md': fileStat('keep.md') });
	expect(db.getMeta('lastLocalContextUid')).toBe('new-local');
});

test('stat caches returned file stat', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	const remoteResult = fileStat('remote.md', 7, 'remote-file');
	const localResult = fileStat('local.md', 9, 'local-file');
	remoteOriginal.statResponse = async () => remoteResult;
	control.statResponse = async () => localResult;

	await remoteWrapper.stat('remote.md');
	await localWrapper.stat('local.md');

	expect(getRemoteStore().get('remote.md')).toStrictEqual(remoteResult);
	expect(getLocalStore().get('local.md')).toStrictEqual(localResult);
});

test('remote list upserts returned stats without clearing unrelated context', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const preserved = fileStat('preserved.md', 3, 'preserved');
	const listedFolder = folderStat('folder/');
	const listedFile = fileStat('folder/note.md', 8, 'listed');
	getRemoteStore().set(preserved.key, preserved);
	remoteOriginal.listResponse = async () => [listedFolder, listedFile];

	await remoteWrapper.list('folder/');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({
		'folder/': listedFolder,
		'folder/note.md': listedFile,
		'preserved.md': preserved,
	});
});

test('listAll replaces previous context snapshot', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	const remoteStats = [folderStat('remote/'), fileStat('remote/file.md', 11, 'remote-list-all')];
	const localStats = [folderStat('local/'), fileStat('local/file.md', 12, 'local-list-all')];
	getRemoteStore().set('old-remote.md', fileStat('old-remote.md'));
	getLocalStore().set('old-local.md', fileStat('old-local.md'));
	remoteOriginal.listAllResponse = async () => remoteStats;
	control.listAllResponse = async () => localStats;

	await remoteWrapper.listAll('/');
	await localWrapper.listAll('/');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({
		'remote/': remoteStats[0],
		'remote/file.md': remoteStats[1],
	});
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({
		'local/': localStats[0],
		'local/file.md': localStats[1],
	});
});

test('read uses cached file size when caller omits size', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { calls, control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	remoteOriginal.statResponse = async () => fileStat('remote.md', 13, 'remote-size');
	control.statResponse = async () => fileStat('local.md', 17, 'local-size');

	await remoteWrapper.stat('remote.md');
	await localWrapper.stat('local.md');
	await remoteWrapper.read('remote.md');
	await localWrapper.read('local.md');

	expect(remoteOriginal.readCalls).toStrictEqual([['remote.md', 13]]);
	expect(calls.read).toStrictEqual([['local.md', 17]]);
});

test('remote readStream uses cached file size when caller omits size', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	remoteOriginal.statResponse = async () => fileStat('stream.md', 23, 'stream-size');

	await remoteWrapper.stat('stream.md');
	await remoteWrapper.readStream('stream.md');

	expect(remoteOriginal.calls.readStream).toStrictEqual([['stream.md', 23]]);
});

test('read-through keeps undefined size on cache miss or folder stat', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { calls, control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	remoteOriginal.statResponse = async () => folderStat('folder/');
	control.statResponse = async () => folderStat('folder/');

	await remoteWrapper.read('missing.md');
	await localWrapper.read('missing.md');
	await remoteWrapper.stat('folder/');
	await localWrapper.stat('folder/');
	await remoteWrapper.read('folder/');
	await localWrapper.read('folder/');

	expect(remoteOriginal.readCalls).toStrictEqual([
		['missing.md', undefined],
		['folder/', undefined],
	]);
	expect(calls.read).toStrictEqual([
		['missing.md', undefined],
		['folder/', undefined],
	]);
});

test('stat and traversal failures do not mutate context', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	const remoteSeed = fileStat('seed-remote.md', 3, 'seed-remote');
	const localSeed = fileStat('seed-local.md', 4, 'seed-local');
	getRemoteStore().set(remoteSeed.key, remoteSeed);
	getLocalStore().set(localSeed.key, localSeed);
	remoteOriginal.statResponse = async () => {
		throw new Error('remote stat failed');
	};
	remoteOriginal.listResponse = async () => {
		throw new Error('remote list failed');
	};
	remoteOriginal.listAllResponse = async () => {
		throw new Error('remote listAll failed');
	};
	control.statResponse = async () => {
		throw new Error('local stat failed');
	};
	control.listAllResponse = async () => {
		throw new Error('local listAll failed');
	};

	expect(remoteWrapper.stat('remote.md')).rejects.toThrow('remote stat failed');
	expect(remoteWrapper.list('/')).rejects.toThrow('remote list failed');
	expect(remoteWrapper.listAll('/')).rejects.toThrow('remote listAll failed');
	expect(localWrapper.stat('local.md')).rejects.toThrow('local stat failed');
	expect(localWrapper.listAll('/')).rejects.toThrow('local listAll failed');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'seed-remote.md': remoteSeed });
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({ 'seed-local.md': localSeed });
});

test('mutating calls do not update or clear context', async () => {
	const remoteOriginal = new ContextTestRemoteFs();
	const remoteWrapper = remoteContextWrapper(remoteOriginal);
	const { control, original: localOriginal } = createVaultFs();
	const localWrapper = localContextWrapper(localOriginal);
	const remoteSeed = fileStat('remote.md', 3, 'remote-seed');
	const localSeed = fileStat('local.md', 4, 'local-seed');
	getRemoteStore().set(remoteSeed.key, remoteSeed);
	getLocalStore().set(localSeed.key, localSeed);
	db.setMeta('lastRemoteContextUid', remoteOriginal.getUid());
	db.setMeta('lastLocalContextUid', localOriginal.getUid());
	control.writeStreamResponse = async () => 'stream-write-uid';

	await remoteWrapper.write('remote-write.md', toBuffer('123'));
	await remoteWrapper.delete('remote-delete.md');
	await remoteWrapper.mkdir('remote-folder/', true);
	await localWrapper.write('local-write.md', toBuffer('1234'));
	await localWrapper.writeStream('local-stream.md', new ReadableStream<ArrayBuffer>());
	await localWrapper.delete('local-delete.md');
	await localWrapper.move('old.md', 'new.md');
	await localWrapper.mkdir('local-folder/');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'remote.md': remoteSeed });
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({ 'local.md': localSeed });
	expect(db.getMeta('lastRemoteContextUid')).toBe(remoteOriginal.getUid());
	expect(db.getMeta('lastLocalContextUid')).toBe(localOriginal.getUid());
});
