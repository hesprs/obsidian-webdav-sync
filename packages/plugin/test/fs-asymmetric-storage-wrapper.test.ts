import { beforeEach, expect, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';
import type { MemoryDBMeta, MemoryDBSchema } from '@/modules/Registrar';
import type { Stat } from '@/types';
import { STORAGE_NAME } from '@/consts';
import { asymmetricStorageWrapper } from '@/fs';
import { testKit } from '@/sdk';

const { bytes, file, folder, remoteFs } = testKit;
const db = openMemoryDB<MemoryDBSchema, MemoryDBMeta>(STORAGE_NAME);

function seedRemoteContext(...stats: Array<Stat>) {
	const store = db.getStore('remoteStatContext');
	store.clear();
	for (const stat of stats) store.set(stat.key, stat);
}

beforeEach(() => {
	db.clearStores();
	db.setMeta('lastLocalContextUid', '');
	db.setMeta('lastRemoteContextUid', '');
});

test('list should infer folder anchors from remoteStatContext and return hierarchical stats', async () => {
	seedRemoteContext(file('00000abcde~folder'), file('abcdeuvwxy~nested'));
	const remote = remoteFs({
		control: {
			list: async () => [
				folder('/'),
				file('00000~root.md', { size: 1, uid: 'root-file' }),
				file('00000abcde~folder', { size: 0, uid: 'folder-marker' }),
				file('abcde~child.md', { size: 2, uid: 'child-file' }),
				file('abcdeuvwxy~nested', { size: 0, uid: 'nested-marker' }),
				file('uvwxy~deep.md', { size: 3, uid: 'deep-file' }),
			],
		},
	});
	const wrapper = asymmetricStorageWrapper(remote.fs, db);

	expect(wrapper.list('/')).resolves.toStrictEqual([
		folder('/'),
		file('root.md', { size: 1, uid: 'root-file' }),
		folder('folder/'),
		file('folder/child.md', { size: 2, uid: 'child-file' }),
		folder('folder/nested/'),
		file('folder/nested/deep.md', { size: 3, uid: 'deep-file' }),
	]);
	expect(remote.calls.list).toStrictEqual(['/']);
});

test('list should skip malformed or orphan flattened entries without throwing', async () => {
	seedRemoteContext(file('00000abcde~folder'));
	const remote = remoteFs({
		control: {
			list: async () => [
				folder('/'),
				file('bad-key', { size: 1, uid: 'bad' }),
				file('zzzzz~lost.md', { size: 2, uid: 'orphan-file' }),
				file('zzzzzqqqqq~ghost', { size: 0, uid: 'orphan-folder' }),
				file('00000abcde~folder', { size: 0, uid: 'folder-marker' }),
				file('abcde~child.md', { size: 4, uid: 'child' }),
			],
		},
	});
	const wrapper = asymmetricStorageWrapper(remote.fs, db);

	expect(wrapper.list('/')).resolves.toStrictEqual([
		folder('/'),
		folder('folder/'),
		file('folder/child.md', { size: 4, uid: 'child' }),
	]);
});

test('mkdir should write empty folder marker file and reuse same generated anchor later', async () => {
	const remote = remoteFs();
	const wrapper = asymmetricStorageWrapper(remote.fs, db);

	await wrapper.mkdir('folder/');
	await wrapper.write('folder/note.md', bytes('1234'));

	const [[folderMarkerKey, folderMarkerSize], [childKey]] = remote.calls.write;
	expect(folderMarkerSize).toBe(0);
	expect(folderMarkerKey.slice(0, 5)).toBe('00000');
	expect(folderMarkerKey[10]).toBe('~');
	expect(folderMarkerKey.slice(11)).toBe('folder');
	expect(childKey).toBe(`${folderMarkerKey.slice(5, 10)}~note.md`);
	expect(remote.state.writePayloads[0]?.[1].byteLength).toBe(0);
});

test('folder move should preserve anchor and short-circuit identical flattened move', async () => {
	seedRemoteContext(file('00000abcde~folder'));
	const remote = remoteFs();
	const wrapper = asymmetricStorageWrapper(remote.fs, db);

	await wrapper.move('folder/', 'renamed/');
	await wrapper.write('renamed/child.md', bytes('x'));
	await wrapper.move('renamed/', 'renamed/');

	expect(remote.calls.move).toStrictEqual([['00000abcde~folder', '00000abcde~renamed']]);
	expect(remote.calls.write).toStrictEqual([['abcde~child.md', 1]]);
});

test('unordered child write should proceed by synthesizing missing ancestor anchors', async () => {
	const remote = remoteFs();
	const wrapper = asymmetricStorageWrapper(remote.fs, db);

	await wrapper.write('folder/note.md', bytes('1'));
	await wrapper.mkdir('folder/');

	const [[fileKey], [folderMarkerKey, folderMarkerSize]] = remote.calls.write;
	expect(fileKey[5]).toBe('~');
	expect(folderMarkerSize).toBe(0);
	expect(folderMarkerKey.slice(0, 5)).toBe('00000');
	expect(folderMarkerKey.slice(5, 10)).toBe(fileKey.slice(0, 5));
	expect(folderMarkerKey.slice(11)).toBe('folder');
});
