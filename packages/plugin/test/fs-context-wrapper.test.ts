import { beforeEach, expect, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';
import type { MemoryDBMeta, MemoryDBSchema } from '@/modules/Storage';
import type { Stat } from '@/types';
import { STORAGE_NAME } from '@/consts';
import { localContextWrapper, remoteContextWrapper } from '@/fs';
import { testKit } from '@/sdk';

const { file, remoteFs, localFs, folder, bytes, stream } = testKit;
const db = openMemoryDB<MemoryDBSchema, MemoryDBMeta>(STORAGE_NAME);

function getLocalStore() {
	return db.getStore('localStatContext');
}

function getRemoteStore() {
	return db.getStore('remoteStatContext');
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
	getRemoteStore().set('stale.md', file('stale.md'));
	getLocalStore().set('keep.md', file('keep.md'));
	db.setMeta('lastRemoteContextUid', 'old-remote');

	remoteContextWrapper(remoteFs({ uid: 'new-remote' }).fs, db);

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({});
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({ 'keep.md': file('keep.md') });
	expect(db.getMeta('lastRemoteContextUid')).toBe('new-remote');
});

test('remote wrapper keeps context when uid matches at creation', async () => {
	getRemoteStore().set('keep.md', file('keep.md'));
	db.setMeta('lastRemoteContextUid', 'same-remote');

	remoteContextWrapper(remoteFs({ uid: 'same-remote' }).fs, db);

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'keep.md': file('keep.md') });
	expect(db.getMeta('lastRemoteContextUid')).toBe('same-remote');
});

test('local wrapper clears stale context when uid changes at creation', async () => {
	const local = localFs({ uid: 'new-local' });
	getLocalStore().set('stale.md', file('stale.md'));
	getRemoteStore().set('keep.md', file('keep.md'));
	db.setMeta('lastLocalContextUid', 'old-local');

	localContextWrapper(local.fs, db);

	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({});
	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'keep.md': file('keep.md') });
	expect(db.getMeta('lastLocalContextUid')).toBe('new-local');
});

test('stat caches returned file stat', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	const remoteResult = file('remote.md', { size: 7, uid: 'remote-file' });
	const localResult = file('local.md', { size: 9, uid: 'local-file' });
	remote.control.stat = async () => remoteResult;
	local.control.stat = async () => localResult;

	await remoteWrapper.stat('remote.md');
	await localWrapper.stat('local.md');

	expect(getRemoteStore().get('remote.md')).toStrictEqual(remoteResult);
	expect(getLocalStore().get('local.md')).toStrictEqual(localResult);
});

test('list replaces previous context snapshot', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	const remoteStats = [
		folder('remote/'),
		file('remote/file.md', { size: 11, uid: 'remote-list-all' }),
	];
	const localStats = [
		folder('local/'),
		file('local/file.md', { size: 12, uid: 'local-list-all' }),
	];
	getRemoteStore().set('old-remote.md', file('old-remote.md'));
	getLocalStore().set('old-local.md', file('old-local.md'));
	remote.control.list = async () => remoteStats;
	local.control.list = async () => localStats;

	await remoteWrapper.list('/');
	await localWrapper.list('/');

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
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	remote.control.stat = async () => file('remote.md', { size: 13, uid: 'remote-size' });
	local.control.stat = async () => file('local.md', { size: 17, uid: 'local-size' });

	await remoteWrapper.stat('remote.md');
	await localWrapper.stat('local.md');
	await remoteWrapper.read('remote.md');
	await localWrapper.read('local.md');

	expect(remote.calls.read).toStrictEqual([['remote.md', 13]]);
	expect(local.calls.read).toStrictEqual([['local.md', 17]]);
});

test('remote readStream uses cached file size when caller omits size', async () => {
	const remote = remoteFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	remote.control.stat = async () => file('stream.md', { size: 23, uid: 'stream-size' });

	await remoteWrapper.stat('stream.md');
	await remoteWrapper.readStream('stream.md');

	expect(remote.calls.readStream).toStrictEqual([['stream.md', 23]]);
});

test('read-through keeps undefined size on cache miss or folder stat', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	remote.control.stat = async () => folder('folder/');
	local.control.stat = async () => folder('folder/');

	await remoteWrapper.read('missing.md');
	await localWrapper.read('missing.md');
	await remoteWrapper.stat('folder/');
	await localWrapper.stat('folder/');
	await remoteWrapper.read('folder/');
	await localWrapper.read('folder/');

	expect(remote.calls.read).toStrictEqual([
		['missing.md', undefined],
		['folder/', undefined],
	]);
	expect(local.calls.read).toStrictEqual([
		['missing.md', undefined],
		['folder/', undefined],
	]);
});

test('stat and traversal failures do not mutate context', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	const remoteSeed = file('seed-remote.md', { size: 3, uid: 'seed-remote' });
	const localSeed = file('seed-local.md', { size: 4, uid: 'seed-local' });
	getRemoteStore().set(remoteSeed.key, remoteSeed);
	getLocalStore().set(localSeed.key, localSeed);
	remote.control.stat = async () => {
		throw new Error('remote stat failed');
	};
	remote.control.list = async () => {
		throw new Error('remote list failed');
	};
	local.control.stat = async () => {
		throw new Error('local stat failed');
	};
	local.control.list = async () => {
		throw new Error('local list failed');
	};

	expect(remoteWrapper.stat('remote.md')).rejects.toThrow('remote stat failed');
	expect(remoteWrapper.list('/')).rejects.toThrow('remote list failed');
	expect(localWrapper.stat('local.md')).rejects.toThrow('local stat failed');
	expect(localWrapper.list('/')).rejects.toThrow('local list failed');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({ 'seed-remote.md': remoteSeed });
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({ 'seed-local.md': localSeed });
});

test('write upserts synthesized file stat', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);

	await remoteWrapper.write('remote-write.md', bytes('123'));
	await localWrapper.write('local-write.md', bytes('1234'));

	expect(getRemoteStore().get('remote-write.md')).toStrictEqual(
		file('remote-write.md', { mtime: 0, size: 3, uid: 'write-uid' }),
	);
	expect(getLocalStore().get('local-write.md')).toStrictEqual(
		file('local-write.md', { mtime: 0, size: 4, uid: 'write-uid' }),
	);
});

test('writeStream upserts synthesized file stat', async () => {
	const local = localFs();
	const localWrapper = localContextWrapper(local.fs, db);

	await localWrapper.writeStream('local-stream.md', stream(['ab', 'cd']));

	expect(getLocalStore().get('local-stream.md')).toStrictEqual(
		file('local-stream.md', { mtime: 0, size: 0, uid: 'stream-uid' }),
	);
});

test('delete removes cached record', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	getRemoteStore().set('remote-delete.md', file('remote-delete.md'));
	getLocalStore().set('local-delete.md', file('local-delete.md'));

	await remoteWrapper.delete('remote-delete.md');
	await localWrapper.delete('local-delete.md');

	expect(getStoreSnapshot(getRemoteStore())).toStrictEqual({});
	expect(getStoreSnapshot(getLocalStore())).toStrictEqual({});
});

test('move rewrites cached stat key', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);
	const remoteStat = file('remote-old.md', { mtime: 2, size: 6, uid: 'remote-old' });
	const localStat = file('local-old.md', { mtime: 3, size: 7, uid: 'local-old' });
	getRemoteStore().set(remoteStat.key, remoteStat);
	getLocalStore().set(localStat.key, localStat);

	await remoteWrapper.move('remote-old.md', 'remote-new.md');
	await localWrapper.move('local-old.md', 'local-new.md');

	expect(getRemoteStore().get('remote-new.md')).toStrictEqual(
		file('remote-new.md', { mtime: 2, size: 6, uid: 'remote-old' }),
	);
	expect(getLocalStore().get('local-new.md')).toStrictEqual(
		file('local-new.md', { mtime: 3, size: 7, uid: 'local-old' }),
	);
	expect(getRemoteStore().get('remote-old.md')).toBeUndefined();
	expect(getLocalStore().get('local-old.md')).toBeUndefined();
});

test('mkdir upserts folder record', async () => {
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteContextWrapper(remote.fs, db);
	const localWrapper = localContextWrapper(local.fs, db);

	await remoteWrapper.mkdir('remote-folder/', true);
	await localWrapper.mkdir('local-folder/');

	expect(getRemoteStore().get('remote-folder/')).toStrictEqual(folder('remote-folder/'));
	expect(getLocalStore().get('local-folder/')).toStrictEqual(folder('local-folder/'));
});
