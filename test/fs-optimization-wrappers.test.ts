import type { Vault } from 'obsidian';
import { expect, test } from 'bun:test';
import type { RootVaultFs, Stat } from '~/fs';
import { commonOptimizationWrapper, vaultOptimizationWrapper } from '~/fs';
import { ShimmedRemoteFs } from './utils';

function toBuffer(value: string) {
	return new TextEncoder().encode(value).buffer;
}

function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, reject, resolve };
}

async function flushMicrotasks(turns = 4) {
	for (let index = 0; index < turns; index += 1)
		await new Promise<void>((resolve) => queueMicrotask(resolve));
}

function createEmptyStream() {
	return new ReadableStream<ArrayBuffer>({
		start(controller) {
			controller.close();
		},
	});
}

function createVaultStub() {
	const calls = {
		delete: [] as Array<string>,
		listAll: [] as Array<string>,
		mkdir: [] as Array<string>,
		move: [] as Array<[string, string]>,
		read: [] as Array<[string, number | undefined]>,
		stat: [] as Array<string>,
		write: [] as Array<[string, number]>,
		writeStream: [] as Array<string>,
	};

	const control = {
		deleteResponse: async (_key: string): Promise<void> => undefined,
		listAllResponse: async (_key: string): Promise<Array<Stat>> => [],
		mkdirResponse: async (_key: string): Promise<void> => undefined,
		moveResponse: async (_oldKey: string, _newKey: string): Promise<void> => undefined,
		readResponse: async (_key: string, _size?: number): Promise<ArrayBuffer> =>
			new ArrayBuffer(0),
		statResponse: async (key: string): Promise<Stat> =>
			key.endsWith('/')
				? ({ isDir: true, key } as Stat)
				: ({ isDir: false, key, mtime: 1, size: 1, uid: key } as Stat),
		writeResponse: async (_key: string, _value: ArrayBuffer): Promise<string> => 'write-uid',
		writeStreamResponse: async (
			_key: string,
			_value: ReadableStream<ArrayBuffer>,
		): Promise<string> => 'stream-uid',
	};

	const original: RootVaultFs = {
		delete: async (key: string) => {
			calls.delete.push(key);
			return await control.deleteResponse(key);
		},
		getUid: () => 'vault',
		listAll: async (key: string) => {
			calls.listAll.push(key);
			return await control.listAllResponse(key);
		},
		mkdir: async (key: string) => {
			calls.mkdir.push(key);
			return await control.mkdirResponse(key);
		},
		move: async (oldKey: string, newKey: string) => {
			calls.move.push([oldKey, newKey]);
			return await control.moveResponse(oldKey, newKey);
		},
		read: async (key: string, size?: number) => {
			calls.read.push([key, size]);
			return await control.readResponse(key, size);
		},
		stat: async (key: string) => {
			calls.stat.push(key);
			return await control.statResponse(key);
		},
		vault: { getName: () => 'Vault' } as unknown as Vault,
		write: async (key: string, value: ArrayBuffer) => {
			calls.write.push([key, value.byteLength]);
			return await control.writeResponse(key, value);
		},
		writeStream: async (key: string, value: ReadableStream<ArrayBuffer>) => {
			calls.writeStream.push(key);
			return await control.writeStreamResponse(key, value);
		},
	};

	return { calls, control, original };
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
	const wrapper = vaultOptimizationWrapper(original);
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
	const wrapper = vaultOptimizationWrapper(original);
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
