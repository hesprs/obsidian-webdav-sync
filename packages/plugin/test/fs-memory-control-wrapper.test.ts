import { expect, test } from 'bun:test';
import type { MemoryControlSharedState } from '@/fs';
import { localMemoryControlWrapper, remoteMemoryControlWrapper } from '@/fs';
import { testKit } from '@/sdk';

const { flush, bytes, localFs, remoteFs, deferred, stream } = testKit;
const FOUR_MIB = 4 * 1024 * 1024;

function createSharedState(maxMemory: number, memoryConsumption = 0): MemoryControlSharedState {
	return {
		hangingOperations: [],
		maxMemory,
		memoryConsumption,
	};
}

test('remote memory wrapper delays read when shared budget is exhausted', async () => {
	const state = createSharedState(5);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	await wrapper.read('held.md', 5);
	const delayedRead = wrapper.read('delayed.md', 4);

	expect(remote.calls.read).toStrictEqual([['held.md', 5]]);

	await wrapper.write('release.md', bytes('12345'));
	await flush();

	expect(remote.calls.read).toStrictEqual([
		['held.md', 5],
		['delayed.md', 4],
	]);
	expect(state.memoryConsumption).toBe(4);
	await delayedRead;
});

test('remote memory wrapper resumes queued reads after write completes', async () => {
	const state = createSharedState(5);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	await wrapper.read('held.md', 5);
	const firstQueuedRead = wrapper.read('first.md', 2);
	const secondQueuedRead = wrapper.read('second.md', 3);

	expect(remote.calls.read).toStrictEqual([['held.md', 5]]);

	await wrapper.write('release.md', bytes('12345'));
	await flush();

	expect(remote.calls.read).toStrictEqual([
		['held.md', 5],
		['first.md', 2],
		['second.md', 3],
	]);
	await Promise.all([firstQueuedRead, secondQueuedRead]);
});

test('remote memory wrapper reserves fixed 4 MiB for readStream', async () => {
	const state = createSharedState(FOUR_MIB + 1);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	await wrapper.read('held.md', 1);
	await wrapper.readStream('large.md', FOUR_MIB * 2);

	expect(remote.calls.readStream).toStrictEqual([['large.md', FOUR_MIB * 2]]);
	expect(state.memoryConsumption).toBe(FOUR_MIB + 1);
});

test('vault memory wrapper releases budget only after writeStream fully drains', async () => {
	const state = createSharedState(8);
	const local = localFs();
	const wrapper = localMemoryControlWrapper(local.fs, state);
	const continueDrain = deferred<void>();

	await wrapper.read('held.md', 4);
	const pendingRead = wrapper.read('later.md', 5);

	local.control.writeStream = async (_key, source) => {
		const reader = source.getReader();
		const firstChunk = await reader.read();
		expect(firstChunk.done).toBe(false);

		continueDrain.resolve();
		await continueDrain.promise;

		const secondChunk = await reader.read();
		expect(secondChunk.done).toBe(false);
		const doneChunk = await reader.read();
		expect(doneChunk.done).toBe(true);
		return 'stream-uid';
	};

	const pendingWriteStream = wrapper.writeStream('stream.md', stream(['ab', 'cd']));

	await flush();
	expect(local.calls.read).toStrictEqual([['held.md', 4]]);
	expect(state.memoryConsumption).toBe(4);

	await pendingWriteStream;
	await flush();

	expect(local.calls.read).toStrictEqual([
		['held.md', 4],
		['later.md', 5],
	]);
	expect(state.memoryConsumption).toBe(5);
	await pendingRead;
});

test('shared state spans remote and vault wrappers', async () => {
	const state = createSharedState(6);
	const remote = remoteFs();
	const local = localFs();
	const remoteWrapper = remoteMemoryControlWrapper(remote.fs, state);
	const vaultWrapper = localMemoryControlWrapper(local.fs, state);

	await remoteWrapper.read('held.md', 4);
	const pendingVaultRead = vaultWrapper.read('later.md', 5);

	await flush();
	expect(local.calls.read).toStrictEqual([]);

	await remoteWrapper.write('release.md', bytes('1234'));
	await flush();

	expect(local.calls.read).toStrictEqual([['later.md', 5]]);
	await pendingVaultRead;
});

test('write failure releases reserved budget', async () => {
	const state = createSharedState(10);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	await wrapper.read('held.md', 4);
	remote.control.write = async () => {
		throw new Error('write failed');
	};

	expect(wrapper.write('failed.md', bytes('1234'))).rejects.toThrow('write failed');
	expect(state.memoryConsumption).toBe(0);
});

test('read failure does not leave counter incremented', async () => {
	const state = createSharedState(10);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	remote.control.read = async () => {
		throw new Error('read failed');
	};

	expect(wrapper.read('failed.md', 4)).rejects.toThrow('read failed');
	expect(state.memoryConsumption).toBe(0);
});

test('vault writeStream error releases consumed budget', async () => {
	const state = createSharedState(10);
	const local = localFs();
	const wrapper = localMemoryControlWrapper(local.fs, state);

	await wrapper.read('held.md', 4);
	local.control.writeStream = async (_key: string, source: ReadableStream<ArrayBuffer>) => {
		const reader = source.getReader();
		await reader.read();
		throw new Error('stream failed');
	};

	expect(wrapper.writeStream('failed.md', stream(['1234']))).rejects.toThrow('stream failed');
	expect(state.memoryConsumption).toBe(0);
});

test('vault writeStream cancel releases consumed budget', async () => {
	const state = createSharedState(10);
	const local = localFs();
	const wrapper = localMemoryControlWrapper(local.fs, state);

	await wrapper.read('held.md', 4);
	local.control.writeStream = async (_key: string, source: ReadableStream<ArrayBuffer>) => {
		const reader = source.getReader();
		await reader.read();
		await reader.cancel();
		return 'stream-uid';
	};

	await wrapper.writeStream('cancelled.md', stream(['1234']));
	expect(state.memoryConsumption).toBe(0);
});

test('memory wrapper keeps hanging pool sorted and resumes maximum possible reads', async () => {
	const state = createSharedState(10);
	const remote = remoteFs();
	const wrapper = remoteMemoryControlWrapper(remote.fs, state);

	await wrapper.read('held.md', 10);
	void wrapper.read('seven.md', 7);
	const oneRead = wrapper.read('one.md', 1);
	void wrapper.read('four.md', 4);
	const threeRead = wrapper.read('three.md', 3);

	await wrapper.write('release.md', bytes('1234'));
	await flush();

	expect(remote.calls.read).toStrictEqual([
		['held.md', 10],
		['one.md', 1],
		['three.md', 3],
	]);
	expect(state.hangingOperations.map(({ size }) => size)).toStrictEqual([4, 7]);
	await Promise.all([oneRead, threeRead]);
});
