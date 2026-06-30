import { expect, mock, test } from 'bun:test';
import {
	localCancellationWrapper,
	rateLimiterWrapper,
	remoteCancellationWrapper,
	retryWrapper,
} from '@/fs';
import { testKit } from '@/sdk';
import { syncCancelledError } from '@/sync';

const { remoteFs, localFs, deferred, flush, stream, bytes } = testKit;
const waitMock = mock(() => Promise.resolve());
void mock.module('@/utils/wait', () => ({
	sleep: waitMock,
}));

test('retry shim retries matching request statuses and waits between attempts', async () => {
	waitMock.mockReset();
	const remote = remoteFs();
	remote.control.request = async () => {
		if (remote.state.requestCalls.length < 3) throw { res: { status: 503 } };
		return { headers: {}, status: 200, text: '' };
	};

	retryWrapper(remote.fs, {
		isRetryable: () => true,
		maxRetry: 2,
		retryDelayMs: 25,
	});

	await remote.fs.read('retry.md');

	expect(remote.state.requestCalls).toStrictEqual(['retry.md', 'retry.md', 'retry.md']);
	expect(waitMock).toHaveBeenCalledTimes(2);
	expect(waitMock).toHaveBeenNthCalledWith(1, 25);
	expect(waitMock).toHaveBeenNthCalledWith(2, 25);
});

test('retry shim stops after max retry count and ignores other statuses', async () => {
	waitMock.mockReset();
	const remote = remoteFs();
	remote.control.request = async () => {
		throw { res: { status: 404 } };
	};

	retryWrapper(remote.fs, {
		isRetryable: () => false,
		maxRetry: 3,
		retryDelayMs: 25,
	});

	expect(remote.fs.read('missing.md')).rejects.toStrictEqual({ res: { status: 404 } });
	expect(remote.state.requestCalls).toStrictEqual(['missing.md']);
	expect(waitMock).not.toHaveBeenCalled();
});

test('remote pre-call read guard throws before delegation', async () => {
	const remote = remoteFs();
	const wrapper = remoteCancellationWrapper(remote.fs, () => true);

	expect(() => wrapper.read('note.md')).toThrow(syncCancelledError);
	expect(remote.calls.read).toStrictEqual([]);
});

test('local pre-call read guard throws before delegation', async () => {
	const local = localFs();
	const wrapper = localCancellationWrapper(local.fs, () => true);

	expect(() => wrapper.read('note.md')).toThrow(syncCancelledError);
	expect(local.calls.read).toStrictEqual([]);
});

test('remote post-call write guard throws after successful release path', async () => {
	let cancelled = false;
	const writeDeferred = deferred<string>();
	const remote = remoteFs();
	remote.control.write = async () => await writeDeferred.promise;
	const wrapper = remoteCancellationWrapper(remote.fs, () => cancelled);

	const pendingWrite = wrapper.write('release.md', bytes('1234'));
	await flush();
	cancelled = true;
	writeDeferred.resolve('write-uid');

	expect(pendingWrite).rejects.toBe(syncCancelledError);
	expect(remote.calls.write).toStrictEqual([['release.md', 4]]);
});

test('local post-call write guard throws after successful release path', async () => {
	let cancelled = false;
	const writeDeferred = deferred<string>();
	const local = localFs();
	local.control.writeStream = async () => await writeDeferred.promise;
	const wrapper = localCancellationWrapper(local.fs, () => cancelled);

	const pendingWrite = wrapper.writeStream('release.md', stream(['1234']));
	await flush();
	cancelled = true;
	writeDeferred.resolve('write-uid');

	expect(pendingWrite).rejects.toBe(syncCancelledError);
	expect(local.calls.writeStream).toStrictEqual(['release.md']);
});

test('remote request post-check aborts in-flight read after cancellation', async () => {
	let cancelled = false;
	const responseDeferred = deferred<{
		headers: Record<string, string>;
		status: number;
		text: string;
	}>();
	const remote = remoteFs();
	remote.control.request = async () => await responseDeferred.promise;
	const wrapper = remoteCancellationWrapper(remote.fs, () => cancelled);

	const pendingRead = wrapper.read('in-flight.md');
	await flush();
	cancelled = true;
	responseDeferred.resolve({ headers: {}, status: 200, text: '' });

	expect(pendingRead).rejects.toBe(syncCancelledError);
	expect(remote.state.requestCalls).toStrictEqual(['in-flight.md']);
});

test('queued remote request fails before network send after cancellation', async () => {
	let cancelled = false;
	const firstResponse = deferred<{
		headers: Record<string, string>;
		status: number;
		text: string;
	}>();
	const remote = remoteFs();
	remote.control.request = async () => {
		if (remote.state.requestCalls.length === 1) return await firstResponse.promise;
		return { headers: {}, status: 200, text: '' };
	};
	const wrapper = rateLimiterWrapper(
		remoteCancellationWrapper(remote.fs, () => cancelled),
		{
			maxConcurrency: 1,
			minInterval: 0,
		},
	);

	const firstRead = wrapper.read('first.md');
	const secondRead = wrapper.read('second.md');
	const firstReadError = Promise.resolve(firstRead).catch((error: unknown) => error);
	const secondReadError = Promise.resolve(secondRead).catch((error: unknown) => error);
	await flush();
	expect(remote.state.requestCalls).toStrictEqual(['first.md']);
	cancelled = true;
	firstResponse.resolve({ headers: {}, status: 200, text: '' });

	expect(firstReadError).resolves.toBe(syncCancelledError);
	expect(secondReadError).resolves.toBe(syncCancelledError);
	expect(remote.state.requestCalls).toStrictEqual(['first.md']);
});
