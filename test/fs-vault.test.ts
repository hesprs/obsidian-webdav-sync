import type { Vault } from 'obsidian';
import { expect, test } from 'bun:test';
import { VaultFs } from '~/fs';

type NativeStat = {
	type: 'file' | 'folder';
	mtime: number;
	size: number;
};

type AdapterMock = {
	appendBinary: (path: string, data: ArrayBuffer) => Promise<void>;
	exists: (path: string) => Promise<boolean>;
	list: (path: string) => Promise<{ files: Array<string>; folders: Array<string> }>;
	mkdir: (path: string) => Promise<void>;
	readBinary: (path: string) => Promise<ArrayBuffer>;
	rename: (path: string, newPath: string) => Promise<void>;
	remove: (path: string) => Promise<void>;
	stat: (path: string) => Promise<NativeStat | undefined>;
	trashLocal: (path: string) => Promise<void>;
	trashSystem: (path: string) => Promise<boolean>;
	writeBinary: (path: string, data: ArrayBuffer) => Promise<void>;
};

function toUtf8(data: ArrayBuffer): string {
	return new TextDecoder().decode(data);
}

function createVaultFs(options?: {
	config?: { trashOption?: 'local' };
	stats?: Record<string, NativeStat | undefined>;
	list?: Record<string, { files: Array<string>; folders: Array<string> }>;
	trashSystem?: Record<string, boolean>;
}) {
	const calls = {
		appendBinary: [] as Array<[string, string]>,
		exists: [] as Array<string>,
		list: [] as Array<string>,
		mkdir: [] as Array<string>,
		readBinary: [] as Array<string>,
		remove: [] as Array<string>,
		rename: [] as Array<[string, string]>,
		stat: [] as Array<string>,
		trashLocal: [] as Array<string>,
		trashSystem: [] as Array<string>,
		writeBinary: [] as Array<[string, string]>,
	};

	const adapter: AdapterMock = {
		appendBinary: async (path, data) => {
			calls.appendBinary.push([path, toUtf8(data)]);
		},
		exists: async (path) => {
			calls.exists.push(path);
			return false;
		},
		list: async (path) => {
			calls.list.push(path);
			return options?.list?.[path] ?? { files: [], folders: [] };
		},
		mkdir: async (path) => {
			calls.mkdir.push(path);
		},
		readBinary: async (path) => {
			calls.readBinary.push(path);
			return new ArrayBuffer(0);
		},
		remove: async (path) => {
			calls.remove.push(path);
		},
		rename: async (path, newPath) => {
			calls.rename.push([path, newPath]);
		},
		stat: async (path) => {
			calls.stat.push(path);
			return options?.stats?.[path];
		},
		trashLocal: async (path) => {
			calls.trashLocal.push(path);
		},
		trashSystem: async (path) => {
			calls.trashSystem.push(path);
			return options?.trashSystem?.[path] ?? true;
		},
		writeBinary: async (path, data) => {
			calls.writeBinary.push([path, toUtf8(data)]);
		},
	};

	const vault = {
		adapter,
		config: options?.config,
		getName: () => 'Vault Name',
	} as unknown as Vault;

	return { calls, fs: new VaultFs(vault), vault };
}

test('stat should normalize root, file, and folder keys', async () => {
	const { fs } = createVaultFs({
		stats: {
			folder: { mtime: 1, size: 0, type: 'folder' },
			'note.md': { mtime: 123, size: 9, type: 'file' },
		},
	});

	expect(await fs.stat('/')).toEqual({ isDir: true, key: '/' });
	expect(await fs.stat('note.md')).toEqual({
		isDir: false,
		key: 'note.md',
		mtime: 123,
		size: 9,
		uid: '123',
	});
	expect(await fs.stat('folder/')).toEqual({ isDir: true, key: 'folder/' });
});

test('write should return refreshed file uid from stat', async () => {
	const { calls, fs } = createVaultFs({
		stats: {
			'note.md': { mtime: 456, size: 11, type: 'file' },
		},
	});
	const data = new TextEncoder().encode('hello').buffer;

	expect(await fs.write('note.md', data)).toBe('456');
	expect(calls.writeBinary).toStrictEqual([['note.md', 'hello']]);
	expect(calls.stat).toStrictEqual(['note.md']);
});

test('writeStream should append to temp file then rename into place', async () => {
	const { calls, fs } = createVaultFs({
		stats: {
			'note.md': { mtime: 999, size: 6, type: 'file' },
		},
	});
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(new TextEncoder().encode('ab'));
			controller.enqueue(new TextEncoder().encode('cdef'));
			controller.close();
		},
	});

	const uid = await fs.writeStream('note.md', stream);

	expect(uid).toBe('999');
	expect(calls.writeBinary[0]?.[0]).toContain('.trash/webdav-sync-temp/');
	expect(calls.appendBinary).toHaveLength(1);
	expect(calls.appendBinary[0]?.[1]).toBe('cdef');
	expect(calls.rename[0]).toBeDefined();
	expect(calls.rename[0]?.[1]).toBe('note.md');
});

test('delete should follow Obsidian trash fallback policy', async () => {
	const localVault = createVaultFs({ config: { trashOption: 'local' } });
	await localVault.fs.delete('note.md');
	expect(localVault.calls.trashLocal).toStrictEqual(['note.md']);
	expect(localVault.calls.trashSystem).toStrictEqual([]);

	const systemVault = createVaultFs({ trashSystem: { 'note.md': true } });
	await systemVault.fs.delete('note.md');
	expect(systemVault.calls.trashSystem).toStrictEqual(['note.md']);
	expect(systemVault.calls.trashLocal).toStrictEqual([]);

	const fallbackVault = createVaultFs({ trashSystem: { 'note.md': false } });
	await fallbackVault.fs.delete('note.md');
	expect(fallbackVault.calls.trashSystem).toStrictEqual(['note.md']);
	expect(fallbackVault.calls.trashLocal).toStrictEqual(['note.md']);
});

test('listAll should BFS descendants and exclude queried root', async () => {
	const { fs } = createVaultFs({
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

	const stats = await fs.listAll('/');

	expect(stats.map((stat) => stat.key)).toStrictEqual([
		'root.md',
		'folder/',
		'folder/child.md',
		'folder/nested/',
		'folder/nested/deep.md',
	]);
	expect(stats.some((stat) => stat.key === '/')).toBe(false);
});
