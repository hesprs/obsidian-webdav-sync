import { expect, mock, test } from 'bun:test';
import {
	baseDirWrapper,
	localCancellationWrapper,
	rateLimiterWrapper,
	remoteCancellationWrapper,
	retryWrapper,
} from '@/fs';
import { syncCancelledError } from '@/sync';
import { ShimmedRemoteFs, createDeferred, createVaultFs, flushMicrotasks, toBuffer } from './utils';

const sleepMock = mock(() => Promise.resolve());
void mock.module('@/utils/sleep', () => ({
	sleep: sleepMock,
}));

test('base-dir shim rewrites keys relative to its base', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const shim = baseDirWrapper(original, '/base');

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

	retryWrapper(original, {
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

	retryWrapper(original, {
		isRetryable: () => false,
		maxRetry: 3,
		retryDelayMs: 25,
	});

	expect(original.read('missing.md')).rejects.toStrictEqual({ res: { status: 404 } });
	expect(attempts).toStrictEqual(['missing.md']);
	expect(sleepMock).not.toHaveBeenCalled();
});

test('remote pre-call read guard throws before delegation', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteCancellationWrapper(original, () => true);

	expect(() => wrapper.read('note.md')).toThrow(syncCancelledError);
	expect(original.calls.read).toStrictEqual([]);
});

test('local pre-call read guard throws before delegation', async () => {
	const { calls, original } = createVaultFs();
	const wrapper = localCancellationWrapper(original, () => true);

	expect(() => wrapper.read('note.md')).toThrow(syncCancelledError);
	expect(calls.read).toStrictEqual([]);
});

test('remote post-call write guard throws after successful release path', async () => {
	let cancelled = false;
	const writeDeferred = createDeferred<string>();
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	original.writeResponse = async () => await writeDeferred.promise;
	const wrapper = remoteCancellationWrapper(original, () => cancelled);

	const pendingWrite = wrapper.write('release.md', toBuffer('1234'));
	await flushMicrotasks();
	cancelled = true;
	writeDeferred.resolve('write-uid');

	await expect(pendingWrite).rejects.toBe(syncCancelledError);
	expect(original.calls.write).toStrictEqual([['release.md', 4]]);
});

test('local post-call write guard throws after successful release path', async () => {
	let cancelled = false;
	const writeDeferred = createDeferred<string>();
	const { calls, control, original } = createVaultFs();
	control.writeStreamResponse = async () => await writeDeferred.promise;
	const wrapper = localCancellationWrapper(original, () => cancelled);
	const stream = new ReadableStream<ArrayBuffer>({
		start(controller) {
			controller.enqueue(toBuffer('1234'));
			controller.close();
		},
	});

	const pendingWrite = wrapper.writeStream('release.md', stream);
	await flushMicrotasks();
	cancelled = true;
	writeDeferred.resolve('write-uid');

	await expect(pendingWrite).rejects.toBe(syncCancelledError);
	expect(calls.writeStream).toStrictEqual(['release.md']);
});

test('remote request post-check aborts in-flight read after cancellation', async () => {
	let cancelled = false;
	const responseDeferred = createDeferred<{
		headers: Record<string, string>;
		status: number;
		text: string;
	}>();
	const networkRequests: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		networkRequests.push(input);
		return await responseDeferred.promise;
	});
	const wrapper = remoteCancellationWrapper(original, () => cancelled);

	const pendingRead = wrapper.read('in-flight.md');
	await flushMicrotasks();
	cancelled = true;
	responseDeferred.resolve({ headers: {}, status: 200, text: '' });

	await expect(pendingRead).rejects.toBe(syncCancelledError);
	expect(networkRequests).toStrictEqual(['in-flight.md']);
});

test('queued remote request fails before network send after cancellation', async () => {
	let cancelled = false;
	const firstResponse = createDeferred<{
		headers: Record<string, string>;
		status: number;
		text: string;
	}>();
	const networkRequests: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		networkRequests.push(input);
		if (networkRequests.length === 1) return await firstResponse.promise;
		return { headers: {}, status: 200, text: '' };
	});
	const wrapper = rateLimiterWrapper(
		remoteCancellationWrapper(original, () => cancelled),
		{
			maxConcurrency: 1,
			minInterval: 0,
		},
	);

	const firstRead = wrapper.read('first.md');
	const secondRead = wrapper.read('second.md');
	const firstReadError = Promise.resolve(firstRead).catch((error: unknown) => error);
	const secondReadError = Promise.resolve(secondRead).catch((error: unknown) => error);
	await flushMicrotasks();
	expect(networkRequests).toStrictEqual(['first.md']);
	cancelled = true;
	firstResponse.resolve({ headers: {}, status: 200, text: '' });

	await expect(firstReadError).resolves.toBe(syncCancelledError);
	await expect(secondReadError).resolves.toBe(syncCancelledError);
	expect(networkRequests).toStrictEqual(['first.md']);
});
