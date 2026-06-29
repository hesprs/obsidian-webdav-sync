import { expect, test } from 'bun:test';
import type { BatchOptimizer, LocalFs, RemoteFs } from '@/fs';
import { localOptimizationWrapper, remoteOptimizationWrapper } from '@/fs';
import { testKit } from '@/sdk';

const { bytes, deferred, flush, localFs, remoteFs, stream } = testKit;

function createBatchRecorder<Fs extends RemoteFs | LocalFs>() {
	const seen: Array<Array<string>> = [];
	const batchOptimizer: BatchOptimizer<Fs> = ({ atoms }) => {
		seen.push(atoms.map(({ type }) => type));
		return atoms;
	};

	return { batchOptimizer, seen };
}

test('remote optimization wrapper forwards queued atoms to batch optimizer', async () => {
	const remote = remoteFs();
	const { batchOptimizer, seen } = createBatchRecorder<RemoteFs>();
	const wrapper = remoteOptimizationWrapper(remote.fs, {
		batchOptimizer,
		localPool: [],
		remotePool: [],
	});

	const pending = Promise.all([wrapper.delete('folder/'), wrapper.mkdir('notes/')]);

	await flush();
	await pending;

	expect(seen).toStrictEqual([['delete', 'mkdir']]);
	expect(remote.calls.delete).toStrictEqual(['folder/']);
	expect(remote.calls.mkdir).toStrictEqual(['notes/']);
});

test('local optimization wrapper forwards pooled write alongside queued ops', async () => {
	const local = localFs();
	const remote = remoteFs();
	const localPool: Array<string> = [];
	const remotePool: Array<string> = [];
	const { batchOptimizer, seen } = createBatchRecorder<LocalFs>();
	const localWrapper = localOptimizationWrapper(local.fs, {
		batchOptimizer,
		localPool,
		remotePool,
	});
	const remoteWrapper = remoteOptimizationWrapper(remote.fs, {
		batchOptimizer: (({ atoms }) => atoms) as BatchOptimizer<RemoteFs>,
		localPool,
		remotePool,
	});
	const deleteDeferred = deferred<void>();
	const mkdirDeferred = deferred<void>();

	local.control.delete = async () => await deleteDeferred.promise;
	local.control.mkdir = async () => await mkdirDeferred.promise;

	await remoteWrapper.read('folder/note.md');

	const pendingBatch = Promise.all([
		localWrapper.delete('folder/'),
		localWrapper.mkdir('folder/sub/'),
	]);
	await flush();

	expect(seen).toStrictEqual([['delete', 'mkdir', 'write']]);
	expect(local.calls.write).toStrictEqual([]);

	const pendingWrite = localWrapper.write('folder/note.md', bytes('body'));
	deleteDeferred.resolve();
	mkdirDeferred.resolve();

	await Promise.all([pendingBatch, pendingWrite]);

	expect(local.calls.write).toStrictEqual([['folder/note.md', 4]]);
});

test('local optimization wrapper forwards pooled writeStream alongside queued ops', async () => {
	const local = localFs();
	const remote = remoteFs();
	const localPool: Array<string> = [];
	const remotePool: Array<string> = [];
	const { batchOptimizer, seen } = createBatchRecorder<LocalFs>();
	const localWrapper = localOptimizationWrapper(local.fs, {
		batchOptimizer,
		localPool,
		remotePool,
	});
	const remoteWrapper = remoteOptimizationWrapper(remote.fs, {
		batchOptimizer: (({ atoms }) => atoms) as BatchOptimizer<RemoteFs>,
		localPool,
		remotePool,
	});
	const deleteDeferred = deferred<void>();
	const mkdirDeferred = deferred<void>();

	local.control.delete = async () => await deleteDeferred.promise;
	local.control.mkdir = async () => await mkdirDeferred.promise;

	await remoteWrapper.read('folder/stream.md');

	const pendingBatch = Promise.all([
		localWrapper.delete('folder/'),
		localWrapper.mkdir('folder/sub/'),
	]);
	await flush();

	expect(seen).toStrictEqual([['delete', 'mkdir', 'write']]);
	expect(local.calls.writeStream).toStrictEqual([]);

	const pendingWriteStream = localWrapper.writeStream('folder/stream.md', stream(['body']));
	deleteDeferred.resolve();
	mkdirDeferred.resolve();

	await Promise.all([pendingBatch, pendingWriteStream]);

	expect(local.calls.writeStream).toStrictEqual(['folder/stream.md']);
});

test('single optimization call bypasses batch optimizer', async () => {
	const remote = remoteFs();
	const batchOptimizer: BatchOptimizer<RemoteFs> = () => {
		throw new Error('batch optimizer should not run');
	};
	const recursiveValues: Array<boolean | undefined> = [];
	const wrapper = remoteOptimizationWrapper(remote.fs, {
		batchOptimizer,
		localPool: [],
		remotePool: [],
	});

	remote.control.mkdir = async (_key, recursive) => {
		recursiveValues.push(recursive);
	};

	await wrapper.mkdir('folder/nested/', true);

	expect(remote.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(recursiveValues).toStrictEqual([true]);
});
