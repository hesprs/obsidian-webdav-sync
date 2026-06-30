import { expect, test } from 'bun:test';
import type { InputAtom, OutputAtom } from '@/fs';
import type { MaybePromise } from '@/sdk';
import { hierarchalOptimizer } from '@/fs';
import { testKit } from '@/sdk';

const { deferred, flush } = testKit;

function runOptimizer(atoms: Array<InputAtom>) {
	const started = new WeakMap<OutputAtom, MaybePromise<string | void>>();
	const executeAtom = (atom: OutputAtom) => {
		const pending = started.get(atom);
		if (pending) return pending;
		const result = Promise.resolve(atom.execute());
		started.set(atom, result);
		return result;
	};

	return {
		executeAtom,
		optimized: hierarchalOptimizer({ atoms, executeAtom, fs: {} as never }),
	};
}

test('mkdir chain waits for ancestor mkdir', async () => {
	const logs: Array<string> = [];
	const root = deferred<void>();
	const nested = deferred<void>();
	const atoms: Array<InputAtom> = [
		{
			execute: async () => {
				logs.push('mkdir:folder/');
				await root.promise;
			},
			key: 'folder/',
			type: 'mkdir',
		},
		{
			execute: async () => {
				logs.push('mkdir:folder/nested/');
				await nested.promise;
			},
			key: 'folder/nested/',
			type: 'mkdir',
		},
		{
			execute: async () => {
				logs.push('write:folder/nested/file.md');
				return 'write-uid';
			},
			key: 'folder/nested/file.md',
			type: 'write',
		},
	];
	const { executeAtom, optimized } = runOptimizer(atoms);
	const pending = Promise.all(optimized.map(executeAtom));

	await flush();
	expect(logs).toStrictEqual(['mkdir:folder/']);

	root.resolve();
	await flush();
	expect(logs).toStrictEqual(['mkdir:folder/', 'mkdir:folder/nested/']);

	nested.resolve();
	await flush();
	expect(logs).toStrictEqual([
		'mkdir:folder/',
		'mkdir:folder/nested/',
		'write:folder/nested/file.md',
	]);

	await pending;
});

test('move waits for source descendants and gates target descendants', async () => {
	const logs: Array<string> = [];
	const move = deferred<void>();
	const atoms: Array<InputAtom> = [
		{
			execute: async () => {
				logs.push('write:folder/src/note.md');
				return 'src-uid';
			},
			key: 'folder/src/note.md',
			type: 'write',
		},
		{
			execute: async () => {
				logs.push('move:folder/src/->folder/dst/');
				await move.promise;
			},
			newKey: 'folder/dst/',
			oldKey: 'folder/src/',
			type: 'move',
		},
		{
			execute: async () => {
				logs.push('write:folder/dst/note.md');
				return 'dst-uid';
			},
			key: 'folder/dst/note.md',
			type: 'write',
		},
	];
	const { executeAtom, optimized } = runOptimizer(atoms);
	const pending = Promise.all(optimized.map(executeAtom));

	await flush();
	expect(logs).toStrictEqual(['write:folder/src/note.md', 'move:folder/src/->folder/dst/']);

	move.resolve();
	await flush();
	expect(logs).toStrictEqual([
		'write:folder/src/note.md',
		'move:folder/src/->folder/dst/',
		'write:folder/dst/note.md',
	]);

	await pending;
});

test('delete blocks folder/file collision write', async () => {
	const logs: Array<string> = [];
	const release = deferred<void>();
	const atoms: Array<InputAtom> = [
		{
			execute: async () => {
				logs.push('delete:folder/');
				await release.promise;
			},
			key: 'folder/',
			type: 'delete',
		},
		{
			execute: async () => {
				logs.push('write:folder');
				return 'file-uid';
			},
			key: 'folder',
			type: 'write',
		},
	];
	const { executeAtom, optimized } = runOptimizer(atoms);
	const pending = Promise.all(optimized.map(executeAtom));

	await flush();
	expect(logs).toStrictEqual(['delete:folder/']);

	release.resolve();
	await flush();
	expect(logs).toStrictEqual(['delete:folder/', 'write:folder']);

	await pending;
});
