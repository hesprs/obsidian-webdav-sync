import { expect, test } from 'bun:test';
import type { MemoryControlSharedState } from '~/fs';
import { remoteMemoryControlWrapper, localMemoryControlWrapper } from '~/fs';
import { ShimmedRemoteFs, createDeferred, createVaultFs, flushMicrotasks, toBuffer } from './utils';

const FOUR_MIB = 4 * 1024 * 1024;

function createSharedState(maxMemory: number, memoryConsumption = 0): MemoryControlSharedState {
	return {
		hangingOperations: [],
		maxMemory,
		memoryConsumption,
	};
}

function createStreamFromChunks(chunks: Array<ArrayBuffer>) {
	return new ReadableStream<ArrayBuffer>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

test('remote memory wrapper delays read when shared budget is exhausted', async () => {
	const state = createSharedState(5);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 5);
	const delayedRead = wrapper.read('delayed.md', 4);

	expect(original.calls.read).toStrictEqual(['held.md']);

	await wrapper.write('release.md', toBuffer('12345'));
	await flushMicrotasks();

	expect(original.calls.read).toStrictEqual(['held.md', 'delayed.md']);
	expect(state.memoryConsumption).toBe(4);
	await delayedRead;
});

test('remote memory wrapper resumes queued reads after write completes', async () => {
	const state = createSharedState(5);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 5);
	const firstQueuedRead = wrapper.read('first.md', 2);
	const secondQueuedRead = wrapper.read('second.md', 3);

	expect(original.calls.read).toStrictEqual(['held.md']);

	await wrapper.write('release.md', toBuffer('12345'));
	await flushMicrotasks();

	expect(original.calls.read).toStrictEqual(['held.md', 'first.md', 'second.md']);
	await Promise.all([firstQueuedRead, secondQueuedRead]);
});

test('remote memory wrapper reserves fixed 4 MiB for readStream', async () => {
	const state = createSharedState(FOUR_MIB + 1);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 1);
	await wrapper.readStream('large.md', FOUR_MIB * 2);

	expect(original.calls.readStream).toStrictEqual([['large.md', FOUR_MIB * 2]]);
	expect(state.memoryConsumption).toBe(FOUR_MIB + 1);
});

test('vault memory wrapper releases budget only after writeStream fully drains', async () => {
	const state = createSharedState(8);
	const { calls, control, original } = createVaultFs();
	const wrapper = localMemoryControlWrapper(original, state);
	const continueDrain = createDeferred<void>();

	await wrapper.read('held.md', 4);
	const pendingRead = wrapper.read('later.md', 5);

	control.writeStreamResponse = async (_key, stream) => {
		const reader = stream.getReader();
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

	const pendingWriteStream = wrapper.writeStream(
		'stream.md',
		createStreamFromChunks([toBuffer('ab'), toBuffer('cd')]),
	);

	await flushMicrotasks();
	expect(calls.read).toStrictEqual([['held.md', 4]]);
	expect(state.memoryConsumption).toBe(4);

	await pendingWriteStream;
	await flushMicrotasks();

	expect(calls.read).toStrictEqual([
		['held.md', 4],
		['later.md', 5],
	]);
	expect(state.memoryConsumption).toBe(5);
	await pendingRead;
});

test('shared state spans remote and vault wrappers', async () => {
	const state = createSharedState(6);
	const remoteOriginal = new ShimmedRemoteFs(async () => ({
		headers: {},
		status: 200,
		text: '',
	}));
	const { calls: vaultCalls, original: vaultOriginal } = createVaultFs();
	const remoteWrapper = remoteMemoryControlWrapper(remoteOriginal, state);
	const vaultWrapper = localMemoryControlWrapper(vaultOriginal, state);

	await remoteWrapper.read('held.md', 4);
	const pendingVaultRead = vaultWrapper.read('later.md', 5);

	await flushMicrotasks();
	expect(vaultCalls.read).toStrictEqual([]);

	await remoteWrapper.write('release.md', toBuffer('1234'));
	await flushMicrotasks();

	expect(vaultCalls.read).toStrictEqual([['later.md', 5]]);
	await pendingVaultRead;
});

test('write failure releases reserved budget', async () => {
	const state = createSharedState(10);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 4);
	original.writeResponse = async () => {
		throw new Error('write failed');
	};

	expect(wrapper.write('failed.md', toBuffer('1234'))).rejects.toThrow('write failed');
	expect(state.memoryConsumption).toBe(0);
});

test('read failure does not leave counter incremented', async () => {
	const state = createSharedState(10);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	original.readResponse = async () => {
		throw new Error('read failed');
	};

	expect(wrapper.read('failed.md', 4)).rejects.toThrow('read failed');
	expect(state.memoryConsumption).toBe(0);
});

test('vault writeStream error releases consumed budget', async () => {
	const state = createSharedState(10);
	const { control, original } = createVaultFs();
	const wrapper = localMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 4);
	control.writeStreamResponse = async (_key: string, stream: ReadableStream<ArrayBuffer>) => {
		const reader = stream.getReader();
		await reader.read();
		throw new Error('stream failed');
	};

	expect(
		wrapper.writeStream('failed.md', createStreamFromChunks([toBuffer('1234')])),
	).rejects.toThrow('stream failed');
	expect(state.memoryConsumption).toBe(0);
});

test('vault writeStream cancel releases consumed budget', async () => {
	const state = createSharedState(10);
	const { control, original } = createVaultFs();
	const wrapper = localMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 4);
	control.writeStreamResponse = async (_key: string, stream: ReadableStream<ArrayBuffer>) => {
		const reader = stream.getReader();
		await reader.read();
		await reader.cancel();
		return 'stream-uid';
	};

	await wrapper.writeStream('cancelled.md', createStreamFromChunks([toBuffer('1234')]));
	expect(state.memoryConsumption).toBe(0);
});

test('memory wrapper keeps hanging pool sorted and resumes maximum possible reads', async () => {
	const state = createSharedState(10);
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = remoteMemoryControlWrapper(original, state);

	await wrapper.read('held.md', 10);
	void wrapper.read('seven.md', 7);
	const oneRead = wrapper.read('one.md', 1);
	void wrapper.read('four.md', 4);
	const threeRead = wrapper.read('three.md', 3);

	await wrapper.write('release.md', toBuffer('1234'));
	await flushMicrotasks();

	expect(original.calls.read).toStrictEqual(['held.md', 'one.md', 'three.md']);
	expect(state.hangingOperations.map(({ size }) => size)).toStrictEqual([4, 7]);
	await Promise.all([oneRead, threeRead]);
});
