import type { Vault } from 'obsidian';
import { arrayBufferToText, textToArrayBuffer } from '@repo/shared';
import { expect, test } from 'bun:test';
import type { RootLocalFs } from '@/fs';
import type { HarnessState } from '@/sdk/test-utils';
import type { MaybePromise } from '@/types';
import { VaultFs } from '@/fs';
import { testKit } from '@/sdk';

const { stream } = testKit;

type VaultFixtureStat = {
	mtime: number;
	size?: number;
	type: 'file' | 'folder';
};

type VaultCalls = {
	appendBinary: Array<[string, string]>;
	exists: Array<string>;
	list: Array<string>;
	mkdir: Array<string>;
	readBinary: Array<string>;
	remove: Array<string>;
	rename: Array<[string, string]>;
	stat: Array<string>;
	trashLocal: Array<string>;
	trashSystem: Array<string>;
	writeBinary: Array<[string, string]>;
};

type VaultControl = {
	appendBinary: (path: string, data: ArrayBuffer) => MaybePromise<void>;
	exists: (path: string) => MaybePromise<boolean>;
	list: (path: string) => MaybePromise<{ files: Array<string>; folders: Array<string> }>;
	mkdir: (path: string) => MaybePromise<void>;
	readBinary: (path: string) => MaybePromise<ArrayBuffer>;
	remove: (path: string) => MaybePromise<void>;
	rename: (path: string, newPath: string) => MaybePromise<void>;
	stat: (path: string) => MaybePromise<VaultFixtureStat | undefined>;
	trashLocal: (path: string) => MaybePromise<void>;
	trashSystem: (path: string) => MaybePromise<boolean>;
	writeBinary: (path: string, data: ArrayBuffer) => MaybePromise<void>;
};

type VaultHarness = {
	calls: VaultCalls;
	control: VaultControl;
	fs: RootLocalFs;
	state: HarnessState;
};

type VaultHarnessOptions = {
	config?: { trashOption?: 'local' };
	control?: Partial<VaultControl>;
	list?: Record<string, { files: Array<string>; folders: Array<string> }>;
	stats?: Record<string, VaultFixtureStat | undefined>;
	trashSystem?: Record<string, boolean>;
};

function createVaultControl(options: VaultHarnessOptions): VaultControl {
	return {
		appendBinary: async () => undefined,
		exists: async () => false,
		list: async (path: string) => options.list?.[path] ?? { files: [], folders: [] },
		mkdir: async () => undefined,
		readBinary: async () => new ArrayBuffer(0),
		remove: async () => undefined,
		rename: async () => undefined,
		stat: async (path: string) => options.stats?.[path],
		trashLocal: async () => undefined,
		trashSystem: async (path: string) => options.trashSystem?.[path] ?? true,
		writeBinary: async () => undefined,
		...options.control,
	};
}

function createVaultStub(options: VaultHarnessOptions): VaultHarness {
	const calls: VaultCalls = {
		appendBinary: [],
		exists: [],
		list: [],
		mkdir: [],
		readBinary: [],
		remove: [],
		rename: [],
		stat: [],
		trashLocal: [],
		trashSystem: [],
		writeBinary: [],
	};
	const control = createVaultControl(options);
	const adapter = {
		appendBinary: async (path: string, data: ArrayBuffer) => {
			calls.appendBinary.push([path, arrayBufferToText(data)]);
			return await control.appendBinary(path, data);
		},
		exists: async (path: string) => {
			calls.exists.push(path);
			return await control.exists(path);
		},
		list: async (path: string) => {
			calls.list.push(path);
			return await control.list(path);
		},
		mkdir: async (path: string) => {
			calls.mkdir.push(path);
			return await control.mkdir(path);
		},
		readBinary: async (path: string) => {
			calls.readBinary.push(path);
			return await control.readBinary(path);
		},
		remove: async (path: string) => {
			calls.remove.push(path);
			return await control.remove(path);
		},
		rename: async (path: string, newPath: string) => {
			calls.rename.push([path, newPath]);
			return await control.rename(path, newPath);
		},
		stat: async (path: string) => {
			calls.stat.push(path);
			return await control.stat(path);
		},
		trashLocal: async (path: string) => {
			calls.trashLocal.push(path);
			return await control.trashLocal(path);
		},
		trashSystem: async (path: string) => {
			calls.trashSystem.push(path);
			return await control.trashSystem(path);
		},
		writeBinary: async (path: string, data: ArrayBuffer) => {
			calls.writeBinary.push([path, arrayBufferToText(data)]);
			return await control.writeBinary(path, data);
		},
	};

	const vault = {
		adapter,
		config: options.config,
		getName: () => 'Vault Name',
	} as unknown as Vault;

	return {
		calls,
		control,
		fs: new VaultFs(vault),
		state: { requestCalls: [], vault, writePayloads: [] },
	};
}

test('stat should normalize root, file, and folder keys', async () => {
	const vault = createVaultStub({
		stats: {
			folder: { mtime: 1, size: 0, type: 'folder' },
			'note.md': { mtime: 123, size: 9, type: 'file' },
		},
	});

	expect(await vault.fs.stat('/')).toEqual({ isDir: true, key: '/' });
	expect(await vault.fs.stat('note.md')).toEqual({
		isDir: false,
		key: 'note.md',
		mtime: 123,
		size: 9,
		uid: '123',
	});
	expect(await vault.fs.stat('folder/')).toEqual({ isDir: true, key: 'folder/' });
});

test('write should return refreshed file uid from stat', async () => {
	const vault = createVaultStub({
		stats: {
			'note.md': { mtime: 456, size: 11, type: 'file' },
		},
	});
	const data = textToArrayBuffer('hello');

	expect(await vault.fs.write('note.md', data)).toBe('456');
	expect(vault.calls.writeBinary).toStrictEqual([['note.md', 'hello']]);
	expect(vault.calls.stat).toStrictEqual(['note.md']);
});

test('writeStream should append to temp file then rename into place', async () => {
	const vault = createVaultStub({
		stats: {
			'note.md': { mtime: 999, size: 6, type: 'file' },
		},
	});

	const uid = await vault.fs.writeStream('note.md', stream(['ab', 'cdef']));

	expect(uid).toBe('999');
	expect(vault.calls.writeBinary).toStrictEqual([]);
	expect(vault.calls.appendBinary).toHaveLength(2);
	expect(vault.calls.appendBinary[0]?.[0]).toStartWith('.trash/sync-engine-temp/');
	expect(vault.calls.appendBinary[0]?.[1]).toBe('ab');
	expect(vault.calls.appendBinary[1]?.[0]).toStartWith('.trash/sync-engine-temp/');
	expect(vault.calls.appendBinary[1]?.[1]).toBe('cdef');
	expect(vault.calls.rename[0]).toBeDefined();
	expect(vault.calls.rename[0]?.[1]).toBe('note.md');
});

test('delete should follow Obsidian trash fallback policy', async () => {
	const localVault = createVaultStub({ config: { trashOption: 'local' } });
	await localVault.fs.delete('note.md');
	expect(localVault.calls.trashLocal).toStrictEqual(['note.md']);
	expect(localVault.calls.trashSystem).toStrictEqual([]);

	const systemVault = createVaultStub({ trashSystem: { 'note.md': true } });
	await systemVault.fs.delete('note.md');
	expect(systemVault.calls.trashSystem).toStrictEqual(['note.md']);
	expect(systemVault.calls.trashLocal).toStrictEqual([]);

	const fallbackVault = createVaultStub({ trashSystem: { 'note.md': false } });
	await fallbackVault.fs.delete('note.md');
	expect(fallbackVault.calls.trashSystem).toStrictEqual(['note.md']);
	expect(fallbackVault.calls.trashLocal).toStrictEqual(['note.md']);
});

test('listAll should BFS descendants and exclude queried root', async () => {
	const vault = createVaultStub({
		list: {
			'/': { files: ['root.md'], folders: ['folder'] },
			folder: { files: ['folder/child.md'], folders: ['folder/nested'] },
			'folder/nested': { files: ['folder/nested/deep.md'], folders: [] },
		},
		stats: {
			folder: { mtime: 1, size: 0, type: 'folder' },
			'folder/child.md': { mtime: 2, size: 2, type: 'file' },
			'folder/nested': { mtime: 3, size: 0, type: 'folder' },
			'folder/nested/deep.md': { mtime: 4, size: 4, type: 'file' },
			'root.md': { mtime: 1, size: 1, type: 'file' },
		},
	});

	const stats = await vault.fs.listAll('/');

	expect(stats.map((stat) => stat.key)).toStrictEqual([
		'root.md',
		'folder/',
		'folder/child.md',
		'folder/nested/',
		'folder/nested/deep.md',
	]);
	expect(stats.some((stat) => stat.key === '/')).toBe(false);
});
