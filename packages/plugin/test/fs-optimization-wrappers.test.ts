import { expect, test } from 'bun:test';
import { commonOptimizationWrapper, localOptimizationWrapper } from '@/fs';
import { testKit } from '@/sdk';

const { deferred, flush, bytes, remoteFs, localFs, stream } = testKit;

test('common optimization wrapper collapses nested deletes into shallowest remote delete', async () => {
	const remote = remoteFs();
	const wrapper = commonOptimizationWrapper(remote.fs);

	await Promise.all([wrapper.delete('folder/'), wrapper.delete('folder/file.md')]);

	expect(remote.calls.delete).toStrictEqual(['folder/']);
});

test('common optimization wrapper runs mkdir from shallowest to deepest before writes', async () => {
	const remote = remoteFs();
	const wrapper = commonOptimizationWrapper(remote.fs);
	const folderDeferred = deferred<void>();
	const notesDeferred = deferred<void>();
	const nestedDeferred = deferred<void>();

	remote.control.mkdir = async (key) => {
		if (key === 'folder/') return await folderDeferred.promise;
		if (key === 'notes/') return await notesDeferred.promise;
		if (key === 'folder/nested/') return await nestedDeferred.promise;
	};

	const writeValue = bytes('data');
	const pending = Promise.all([
		wrapper.mkdir('folder/'),
		wrapper.mkdir('notes/'),
		wrapper.mkdir('folder/nested/'),
		wrapper.write('folder/nested/file.md', writeValue),
	]);

	await flush();
	expect(remote.calls.mkdir).toStrictEqual(['folder/', 'notes/']);
	expect(remote.calls.write).toStrictEqual([]);

	folderDeferred.resolve();
	await flush();
	expect(remote.calls.mkdir).toStrictEqual(['folder/', 'notes/']);

	notesDeferred.resolve();
	await flush();
	expect(remote.calls.mkdir).toStrictEqual(['folder/', 'notes/', 'folder/nested/']);
	expect(remote.calls.write).toStrictEqual([]);

	nestedDeferred.resolve();
	await flush();
	expect(remote.calls.write).toStrictEqual([['folder/nested/file.md', writeValue.byteLength]]);

	await pending;
});

test('common optimization wrapper bypasses batching for single eligible call', async () => {
	const remote = remoteFs();
	const wrapper = commonOptimizationWrapper(remote.fs);
	const recursiveValues: Array<boolean | undefined> = [];

	remote.control.mkdir = async (_key, recursive) => {
		recursiveValues.push(recursive);
	};

	await wrapper.mkdir('folder/nested/', true);

	expect(remote.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(recursiveValues).toStrictEqual([true]);
});

test('common optimization wrapper delays write until delete and mkdir finish', async () => {
	const remote = remoteFs();
	const wrapper = commonOptimizationWrapper(remote.fs);
	const deleteDeferred = deferred<void>();
	const mkdirDeferred = deferred<void>();

	remote.control.delete = async () => await deleteDeferred.promise;
	remote.control.mkdir = async (key) => {
		if (key === 'folder/nested/') await mkdirDeferred.promise;
	};

	const pendingDelete = wrapper.delete('folder/');
	const pendingMkdir = wrapper.mkdir('folder/nested/');

	await flush();
	const pendingWrite = wrapper.write('folder/nested/file.md', bytes('later'));

	expect(remote.calls.delete).toStrictEqual(['folder/']);
	expect(remote.calls.mkdir).toStrictEqual([]);
	expect(remote.calls.write).toStrictEqual([]);

	deleteDeferred.resolve();
	await flush();
	expect(remote.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(remote.calls.write).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flush();
	expect(remote.calls.write).toStrictEqual([['folder/nested/file.md', 'later'.length]]);

	await Promise.all([pendingDelete, pendingMkdir, pendingWrite]);
});

test('vault optimization wrapper delays writeStream until delete and mkdir finish', async () => {
	const local = localFs();
	const wrapper = localOptimizationWrapper(local.fs);
	const deleteDeferred = deferred<void>();
	const mkdirDeferred = deferred<void>();

	local.control.delete = async () => await deleteDeferred.promise;
	local.control.mkdir = async () => await mkdirDeferred.promise;

	const pendingDelete = wrapper.delete('folder/');
	const pendingMkdir = wrapper.mkdir('folder/nested/');

	await flush();
	const pendingWriteStream = wrapper.writeStream('folder/nested/file.md', stream());

	expect(local.calls.delete).toStrictEqual(['folder/']);
	expect(local.calls.mkdir).toStrictEqual([]);
	expect(local.calls.writeStream).toStrictEqual([]);

	deleteDeferred.resolve();
	await flush();
	expect(local.calls.mkdir).toStrictEqual(['folder/nested/']);
	expect(local.calls.writeStream).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flush();
	expect(local.calls.writeStream).toStrictEqual(['folder/nested/file.md']);

	await Promise.all([pendingDelete, pendingMkdir, pendingWriteStream]);
});

test('vault optimization wrapper collapses nested deletes and runs write and writeStream in final phase', async () => {
	const local = localFs();
	const wrapper = localOptimizationWrapper(local.fs);
	const deleteDeferred = deferred<void>();
	const mkdirDeferred = deferred<void>();
	const events: Array<string> = [];

	local.control.delete = async (key) => {
		events.push(`delete:${key}`);
		await deleteDeferred.promise;
	};
	local.control.mkdir = async (key) => {
		events.push(`mkdir:${key}`);
		await mkdirDeferred.promise;
	};
	local.control.write = async (key) => {
		events.push(`write:${key}`);
		return 'write-uid';
	};
	local.control.writeStream = async (key) => {
		events.push(`writeStream:${key}`);
		return 'stream-uid';
	};

	const writeValue = bytes('final');
	const pending = Promise.all([
		wrapper.delete('folder/'),
		wrapper.delete('folder/file.md'),
		wrapper.mkdir('folder/sub/'),
		wrapper.write('folder/sub/note.md', writeValue),
		wrapper.writeStream('folder/sub/stream.md', stream()),
	]);

	await flush();
	expect(local.calls.delete).toStrictEqual(['folder/']);
	expect(local.calls.mkdir).toStrictEqual([]);
	expect(local.calls.write).toStrictEqual([]);
	expect(local.calls.writeStream).toStrictEqual([]);

	deleteDeferred.resolve();
	await flush();
	expect(local.calls.mkdir).toStrictEqual(['folder/sub/']);
	expect(local.calls.write).toStrictEqual([]);
	expect(local.calls.writeStream).toStrictEqual([]);

	mkdirDeferred.resolve();
	await flush();
	expect(local.calls.write).toStrictEqual([['folder/sub/note.md', writeValue.byteLength]]);
	expect(local.calls.writeStream).toStrictEqual(['folder/sub/stream.md']);
	expect(events.slice(0, 2)).toStrictEqual(['delete:folder/', 'mkdir:folder/sub/']);
	expect(events.slice(2).sort()).toStrictEqual(
		['write:folder/sub/note.md', 'writeStream:folder/sub/stream.md'].sort(),
	);

	await pending;
});
