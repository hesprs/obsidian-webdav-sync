import { expect, test } from 'bun:test';
import { commonOptimizationWrapper, localOptimizationWrapper } from '~/fs';
import {
	ShimmedRemoteFs,
	createDeferred,
	createVaultStub,
	flushMicrotasks,
	toBuffer,
} from './utils';

function createEmptyStream() {
	return new ReadableStream<ArrayBuffer>({
		start(controller) {
			controller.close();
		},
	});
}

test('common optimization wrapper collapses nested deletes into shallowest remote delete', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = commonOptimizationWrapper(original);

	await Promise.all([wrapper.delete('folder/'), wrapper.delete('folder/file.md')]);

	expect(original.calls.delete).toStrictEqual(['folder/']);
});

test('common optimization wrapper runs mkdir from shallowest to deepest before writes', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = commonOptimizationWrapper(original);
	const folderDeferred = createDeferred<void>();
	const notesDeferred = createDeferred<void>();
	const nestedDeferred = createDeferred<void>();

	original.mkdirResponse = async (key) => {
		if (key === 'folder/') return await folderDeferred.promise;
		if (key === 'notes/') return await notesDeferred.promise;
		if (key === 'folder/nested/') return await nestedDeferred.promise;
	};

	const writeValue = toBuffer('data');
	const pending = Promise.all([
		wrapper.mkdir('folder/'),
		wrapper.mkdir('notes/'),
		wrapper.mkdir('folder/nested/'),
		wrapper.write('folder/nested/file.md', writeValue),
	]);

	await flushMicrotasks();
	expect(original.calls.mkdir).toStrictEqual(['folder/', 'notes/']);
	expect(original.calls.write).toStrictEqual([]);

	folderDeferred.resolve();
	await flushMicrotasks();
	expect(original.calls.mkdir).toStrictEqual(['folder/', 'notes/']);

	notesDeferred.resolve();
	await flushMicrotasks();
	expect(original.calls.mkdir).toStrictEqual(['folder/', 'notes/', 'folder/nested/']);
	expect(original.calls.write).toStrictEqual([]);

	nestedDeferred.resolve();
	await flushMicrotasks();
	expect(original.calls.write).toStrictEqual([['folder/nested/file.md', writeValue.byteLength]]);

	await pending;
});

test('common optimization wrapper bypasses batching for single eligible call', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = commonOptimizationWrapper(original);
	const recursiveValues: Array<boolean | undefined> = [];

	original.mkdirResponse = async (_key, recursive) => {
		recursiveValues.push(recursive);
	};

	await wrapper.mkdir('folder/nested/', true);

	expect(original.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(recursiveValues).toStrictEqual([true]);
});

test('common optimization wrapper delays write until delete and mkdir finish', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrapper = commonOptimizationWrapper(original);
	const deleteDeferred = createDeferred<void>();
	const mkdirDeferred = createDeferred<void>();

	original.deleteResponse = async () => await deleteDeferred.promise;
	original.mkdirResponse = async (key) => {
		if (key === 'folder/nested/') await mkdirDeferred.promise;
	};

	const pendingDelete = wrapper.delete('folder/');
	const pendingMkdir = wrapper.mkdir('folder/nested/');

	await flushMicrotasks();
	const pendingWrite = wrapper.write('folder/nested/file.md', toBuffer('later'));

	expect(original.calls.delete).toStrictEqual(['folder/']);
	expect(original.calls.mkdir).toStrictEqual([]);
	expect(original.calls.write).toStrictEqual([]);

	deleteDeferred.resolve();
	await flushMicrotasks();
	expect(original.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(original.calls.write).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flushMicrotasks();
	expect(original.calls.write).toStrictEqual([['folder/nested/file.md', 'later'.length]]);

	await Promise.all([pendingDelete, pendingMkdir, pendingWrite]);
});

test('vault optimization wrapper delays writeStream until delete and mkdir finish', async () => {
	const { calls, control, original } = createVaultStub();
	const wrapper = localOptimizationWrapper(original);
	const deleteDeferred = createDeferred<void>();
	const mkdirDeferred = createDeferred<void>();

	control.deleteResponse = async () => await deleteDeferred.promise;
	control.mkdirResponse = async () => await mkdirDeferred.promise;

	const pendingDelete = wrapper.delete('folder/');
	const pendingMkdir = wrapper.mkdir('folder/nested/');

	await flushMicrotasks();
	const pendingWriteStream = wrapper.writeStream('folder/nested/file.md', createEmptyStream());

	expect(calls.delete).toStrictEqual(['folder/']);
	expect(calls.mkdir).toStrictEqual([]);
	expect(calls.writeStream).toStrictEqual([]);

	deleteDeferred.resolve();
	await flushMicrotasks();
	expect(calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(calls.writeStream).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flushMicrotasks();
	expect(calls.writeStream).toStrictEqual(['folder/nested/file.md']);

	await Promise.all([pendingDelete, pendingMkdir, pendingWriteStream]);
});

test('vault optimization wrapper collapses nested deletes and runs write and writeStream in final phase', async () => {
	const { calls, control, original } = createVaultStub();
	const wrapper = localOptimizationWrapper(original);
	const deleteDeferred = createDeferred<void>();
	const mkdirDeferred = createDeferred<void>();
	const events: Array<string> = [];

	control.deleteResponse = async (key) => {
		events.push(`delete:${key}`);
		await deleteDeferred.promise;
	};
	control.mkdirResponse = async (key) => {
		events.push(`mkdir:${key}`);
		await mkdirDeferred.promise;
	};
	control.writeResponse = async (key) => {
		events.push(`write:${key}`);
		return 'write-uid';
	};
	control.writeStreamResponse = async (key) => {
		events.push(`writeStream:${key}`);
		return 'stream-uid';
	};

	const writeValue = toBuffer('final');
	const pending = Promise.all([
		wrapper.delete('folder/'),
		wrapper.delete('folder/file.md'),
		wrapper.mkdir('folder/sub/'),
		wrapper.write('folder/sub/note.md', writeValue),
		wrapper.writeStream('folder/sub/stream.md', createEmptyStream()),
	]);

	await flushMicrotasks();
	expect(calls.delete).toStrictEqual(['folder/']);
	expect(calls.mkdir).toStrictEqual([]);
	expect(calls.write).toStrictEqual([]);
	expect(calls.writeStream).toStrictEqual([]);

	deleteDeferred.resolve();
	await flushMicrotasks();
	expect(calls.mkdir).toStrictEqual(['folder/sub/']);
	expect(calls.write).toStrictEqual([]);
	expect(calls.writeStream).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flushMicrotasks();
	expect(calls.write).toStrictEqual([['folder/sub/note.md', writeValue.byteLength]]);
	expect(calls.writeStream).toStrictEqual(['folder/sub/stream.md']);
	expect(events.slice(0, 2)).toStrictEqual(['delete:folder/', 'mkdir:folder/sub/']);
	expect(events.slice(2).sort()).toStrictEqual(
		['write:folder/sub/note.md', 'writeStream:folder/sub/stream.md'].sort(),
	);

	await pending;
});
