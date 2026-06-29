import { testKit } from '@hesprs/sync-engine-sdk';
import { test, expect } from 'bun:test';
import baseDirWrapper from '@/base-dir';

const { remoteFs } = testKit;

test('base-dir shim rewrites keys relative to its base', async () => {
	const remote = remoteFs();
	const shim = baseDirWrapper(remote.fs, '/base');

	expect(shim.getUid()).toBe('remote~base/');

	const rootStat = await shim.stat('/');
	const stat = await shim.stat('note.md');
	const list = await shim.list('/');
	await shim.readStream('note.md', 42);

	expect(remote.calls.stat).toStrictEqual(['base/', 'base/note.md']);
	expect(rootStat).toStrictEqual({ isDir: true, key: '/' });
	expect(stat).toStrictEqual({ isDir: false, key: 'note.md', mtime: 10, size: 5, uid: 'uid' });
	expect(remote.calls.list).toStrictEqual(['base/']);
	expect(remote.calls.readStream).toStrictEqual([['base/note.md', 42]]);
	expect(list).toStrictEqual([
		{ isDir: true, key: 'folder/' },
		{ isDir: false, key: 'folder/note.md', mtime: 12, size: 7, uid: 'note-2' },
	]);
});
