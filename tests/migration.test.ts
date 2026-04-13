import type WebDAVSyncPlugin from '~';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatModel } from '~/types';
import { normalizeVaultPath } from '~/platform/path';
import { migrateStorage } from '~/storage';
import {
	BASE_TEXT_STORE_NAME,
	STORAGE_NAME,
	SYNC_STATE_STORE_NAME,
} from '~/storage/store.interface';
import { getSyncStateKey } from '~/utils/get-sync-state-key';

const hoisted = vi.hoisted(() => ({
	loggerError: vi.fn(),
	fakeDatabases: new Map<string, Map<string, unknown>>(),
	failOnSetKeys: new Set<string>(),
}));

type LocalspaceValue = string | number | boolean | Record<string, unknown> | StatModel | null;

function getBucket(name: string, storeName: string): Map<string, unknown> {
	const bucketKey = `${name}:${storeName}`;
	const bucket = hoisted.fakeDatabases.get(bucketKey);
	if (bucket) return bucket;
	const nextBucket = new Map<string, unknown>();
	hoisted.fakeDatabases.set(bucketKey, nextBucket);
	return nextBucket;
}

function createFakeStore(name: string, storeName: string) {
	const bucket = getBucket(name, storeName);

	return {
		ready: async () => {},
		getItem: async <T>(key: string) => {
			return (bucket.get(key) as T | undefined) ?? null;
		},
		setItems: async <T extends { key: string; value: unknown }>(items: T[]) => {
			// Simulate atomic-ish batch write: fail early if any key is configured to fail
			for (const item of items) {
				if (hoisted.failOnSetKeys.has(item.key)) throw new Error(`set failed: ${item.key}`);
			}
			for (const item of items) {
				bucket.set(item.key, item.value as LocalspaceValue);
			}
		},
		setItem: async <T>(key: string, value: T) => {
			if (hoisted.failOnSetKeys.has(key)) throw new Error(`set failed: ${key}`);
			bucket.set(key, value as LocalspaceValue);
		},
		keys: async () => {
			return Array.from(bucket.keys());
		},
		getItems: async <T>(keys: string[]) => {
			return keys.map((key) => ({
				key,
				value: (bucket.get(key) as T | undefined) ?? null,
			}));
		},
		removeItem: async (key: string) => {
			bucket.delete(key);
		},
		removeItems: async (keys: string[]) => {
			for (const key of keys) bucket.delete(key);
		},
		clear: async () => {
			bucket.clear();
		},
	};
}

vi.mock('~/utils/logger', () => ({
	default: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: hoisted.loggerError,
	},
}));

vi.mock('localspace', () => ({
	default: {
		INDEXEDDB: 'INDEXEDDB',
		createInstance: ({ name, storeName }: { name: string; storeName: string }) =>
			createFakeStore(name, storeName),
	},
}));

vi.stubGlobal('window', {
	setTimeout: vi.fn((cb: Function, delay: number) => setTimeout(cb, delay)),
	clearTimeout: vi.fn((id) => clearTimeout(id)),
});

function stateStoreBucket() {
	return getBucket(STORAGE_NAME, SYNC_STATE_STORE_NAME);
}

function baseTextStoreBucket() {
	return getBucket(STORAGE_NAME, BASE_TEXT_STORE_NAME);
}

function createPluginStub(remoteBaseDir: string = '/remote/'): WebDAVSyncPlugin {
	return {
		app: {
			vault: {
				getName: () => 'test-vault',
			},
		},
		settings: {
			serverUrl: 'https://dav.example.com/',
			account: 'alice',
			remoteDir: remoteBaseDir,
		},
		syncStateStore: {
			get: async (namespace: string, path: string) =>
				(stateStoreBucket().get(`sync-state:${namespace}:${path}`) as
					| { version?: number }
					| undefined) ?? undefined,
		},
	} as unknown as WebDAVSyncPlugin;
}

function namespaceOf(plugin: WebDAVSyncPlugin): string {
	return getSyncStateKey({
		vaultName: plugin.app.vault.getName(),
		remoteBaseDir: plugin.settings.remoteDir,
		serverUrl: plugin.settings.serverUrl,
		account: plugin.settings.account,
	});
}

function buildFileStat(path: string, mtime: number, size: number): StatModel {
	return {
		isDir: false,
		path,
		mtime,
		size,
	};
}

describe('migrateLegacySyncState', () => {
	beforeEach(() => {
		hoisted.fakeDatabases.clear();
		hoisted.failOnSetKeys.clear();
		hoisted.loggerError.mockClear();
	});

	it('migrates v1 local/remote/baseText to v2 layout', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:local`, {
			'Folder/Note.md': {
				local: buildFileStat('Folder/Note.md', 10, 120),
				baseText: 'base-content',
			},
		});
		stateStoreBucket().set(`sync-state:${namespace}:remote`, {
			nodes: {
				'/': [buildFileStat('/remote/Folder/Note.md', 11, 121)],
			},
		});

		await migrateStorage(plugin);

		expect(stateStoreBucket().has(`sync-state:${namespace}:local`)).toBe(false);
		expect(stateStoreBucket().has(`sync-state:${namespace}:remote`)).toBe(false);
		expect(baseTextStoreBucket().get(`base-text:${namespace}:Folder/Note.md`)).toBe(
			'base-content',
		);
		expect(stateStoreBucket().get(`sync-state:${namespace}:Folder/Note.md`)).toEqual({
			local: buildFileStat('Folder/Note.md', 10, 120),
			remote: buildFileStat('/remote/Folder/Note.md', 11, 121),
		});
	});

	it('is idempotent when migration runs repeatedly', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:local`, {
			'a.md': { local: buildFileStat('a.md', 1, 1), baseText: 'A' },
		});
		stateStoreBucket().set(`sync-state:${namespace}:remote`, {
			nodes: {
				'/': [buildFileStat('/remote/a.md', 2, 2)],
			},
		});

		await migrateStorage(plugin);
		const afterFirstRun = Array.from(stateStoreBucket().entries());
		await migrateStorage(plugin);

		expect(Array.from(stateStoreBucket().entries())).toEqual(afterFirstRun);
	});

	it('infers remote stat when legacy remote record is missing', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:local`, {
			'dir/file.md': { local: buildFileStat('dir/file.md', 3, 33) },
		});

		await migrateStorage(plugin);

		expect(stateStoreBucket().get(`sync-state:${namespace}:dir/file.md`)).toEqual({
			local: buildFileStat('dir/file.md', 3, 33),
			remote: buildFileStat('/remote/dir/file.md', 3, 33),
		});
	});

	it('aborts when legacy local record is missing', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:remote`, {
			nodes: {
				'/': [buildFileStat('/remote/a.md', 2, 2)],
			},
		});

		await migrateStorage(plugin);

		expect(stateStoreBucket().get(`sync-state:${namespace}:meta`)).toEqual({
			version: 1,
		});
		expect(stateStoreBucket().has(`sync-state:${namespace}:remote`)).toBe(true);
		expect(stateStoreBucket().has(`sync-state:${namespace}:local`)).toBe(false);
		expect(hoisted.loggerError).toHaveBeenCalledTimes(1);
	});

	it('keeps legacy keys and meta v1 when a write fails mid-migration', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:local`, {
			'a.md': { local: buildFileStat('a.md', 1, 1) },
			'b.md': { local: buildFileStat('b.md', 2, 2) },
		});

		hoisted.failOnSetKeys.add(`sync-state:${namespace}:b.md`);

		await migrateStorage(plugin);

		expect(stateStoreBucket().get(`sync-state:${namespace}:meta`)).toEqual({
			version: 1,
		});
		expect(stateStoreBucket().has(`sync-state:${namespace}:local`)).toBe(true);
		expect(stateStoreBucket().has(`sync-state:${namespace}:remote`)).toBe(false);
		expect(hoisted.loggerError).toHaveBeenCalledTimes(1);
	});

	it('handles edge names and path normalization consistently', async () => {
		const plugin = createPluginStub();
		const namespace = namespaceOf(plugin);
		const unicodeNfd = 'Cafe\u0301.md';
		const unicodeNfc = 'Café.md';

		stateStoreBucket().set(`sync-state:${namespace}:meta`, { version: 1 });
		stateStoreBucket().set(`sync-state:${namespace}:local`, {
			[`folder:${unicodeNfd}`]: {
				local: buildFileStat(`folder:${unicodeNfd}`, 7, 70),
			},
			'/': {
				local: { isDir: true, path: '/' },
			},
		});
		stateStoreBucket().set(`sync-state:${namespace}:remote`, {
			nodes: {
				'/': [
					buildFileStat(`/remote/folder:${unicodeNfd}`, 8, 80),
					{ isDir: true, path: '/remote/' },
				],
			},
		});

		await migrateStorage(plugin);

		const normalizedFilePath = normalizeVaultPath(`folder:${unicodeNfd}`);
		expect(normalizedFilePath).toBe(`folder:${unicodeNfc}`);
		expect(stateStoreBucket().get(`sync-state:${namespace}:${normalizedFilePath}`)).toEqual({
			local: buildFileStat(`folder:${unicodeNfc}`, 7, 70),
			remote: buildFileStat(`/remote/folder:${unicodeNfc}`, 8, 80),
		});
		expect(stateStoreBucket().get(`sync-state:${namespace}:`)).toEqual({
			local: { isDir: true, path: '' },
			remote: { isDir: true, path: '/remote/' },
		});
	});
});
