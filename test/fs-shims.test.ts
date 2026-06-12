import { expect, mock, test } from 'bun:test';
import { baseDirShim, retryShim } from '~/fs';
import { ShimmedRemoteFs } from './utils';

const sleepMock = mock(() => Promise.resolve());
void mock.module('~/utils/sleep', () => ({
	sleep: sleepMock,
}));

test('base-dir shim rewrites keys relative to its base', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const shim = baseDirShim(original, '/base');

	expect(shim.getUid()).toBe('remote~base/');

	const rootStat = await shim.stat('/');
	const stat = await shim.stat('note.md');
	const listAll = await shim.listAll('/');
	await shim.readStream('note.md', 42);

	expect(original.calls.stat).toStrictEqual(['base/', 'base/note.md']);
	expect(rootStat).toStrictEqual({ isDir: true, key: '/' });
	expect(stat).toStrictEqual({ isDir: false, key: 'note.md', mtime: 10, size: 5, uid: 'uid' });
	expect(original.calls.listAll).toStrictEqual(['base/']);
	expect(original.calls.readStream).toStrictEqual([['base/note.md', 42]]);
	expect(listAll).toStrictEqual([
		{ isDir: true, key: 'folder/' },
		{ isDir: false, key: 'folder/note.md', mtime: 12, size: 7, uid: 'note-2' },
	]);
});

test('retry shim retries matching request statuses and waits between attempts', async () => {
	sleepMock.mockReset();
	const attempts: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		attempts.push(input);
		if (attempts.length < 3) throw { res: { status: 503 } };

		return { headers: {}, status: 200, text: '' };
	});

	retryShim(original, {
		isRetryable: () => true,
		maxRetry: 2,
		retryDelayMs: 25,
	});

	await original.read('retry.md');

	expect(attempts).toStrictEqual(['retry.md', 'retry.md', 'retry.md']);
	expect(sleepMock).toHaveBeenCalledTimes(2);
	expect(sleepMock).toHaveBeenNthCalledWith(1, 25);
	expect(sleepMock).toHaveBeenNthCalledWith(2, 25);
});

test('retry shim stops after max retry count and ignores other statuses', async () => {
	sleepMock.mockReset();
	const attempts: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		attempts.push(input);
		throw { res: { status: 404 } };
	});

	retryShim(original, {
		isRetryable: () => false,
		maxRetry: 3,
		retryDelayMs: 25,
	});

	expect(original.read('missing.md')).rejects.toStrictEqual({ res: { status: 404 } });
	expect(attempts).toStrictEqual(['missing.md']);
	expect(sleepMock).not.toHaveBeenCalled();
});
