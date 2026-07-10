import { expect, mock, test } from 'bun:test';
import { hash } from '~/platform/crypto';
import { setPluginInstance } from '~/settings/plugin-instance';
import { createSyncEncryptionContext } from '~/utils/encryption';
import { getSyncStateKey } from '~/utils/get-sync-state-key';

type MemoryStore = {
	clear: () => Promise<void>;
	destroy: () => Promise<void>;
	dropInstance: (options: { name: string }) => Promise<void>;
	getItem: (key: string) => Promise<unknown>;
	getItems: (keys: Array<string>) => Promise<Array<{ key: string; value: unknown }>>;
	keys: () => Promise<Array<string>>;
	removeItems: (keys: Array<string>) => Promise<void>;
	ready: () => Promise<void>;
	setItem: (key: string, value: unknown) => Promise<void>;
	setItems: (items: Array<{ key: string; value: unknown }>) => Promise<void>;
};

const memoryDatabases = new Map<string, Map<string, Map<string, unknown>>>();

function getStoreMap(databaseName: string, storeName: string): Map<string, unknown> {
	let database = memoryDatabases.get(databaseName);
	if (!database) {
		database = new Map<string, Map<string, unknown>>();
		memoryDatabases.set(databaseName, database);
	}

	let store = database.get(storeName);
	if (!store) {
		store = new Map<string, unknown>();
		database.set(storeName, store);
	}

	return store;
}

function createMemoryStore(databaseName: string, storeName: string): MemoryStore {
	const store = getStoreMap(databaseName, storeName);
	return {
		clear: async () => {
			store.clear();
		},
		destroy: async () => {},
		dropInstance: async ({ name }) => {
			memoryDatabases.delete(name);
		},
		getItem: async (key: string) => store.get(key),
		getItems: async (keys: Array<string>) =>
			keys.map((key) => ({ key, value: store.get(key) })),
		keys: async () => [...store.keys()],
		ready: async () => {},
		removeItems: async (keys: Array<string>) => {
			for (const key of keys) store.delete(key);
		},
		setItem: async (key: string, value: unknown) => {
			store.set(key, value);
		},
		setItems: async (items: Array<{ key: string; value: unknown }>) => {
			for (const item of items) store.set(item.key, item.value);
		},
	};
}

const memoryLocalspace = {
	INDEXEDDB: 'indexeddb',
	createInstance(options: { name: string; storeName: string }) {
		return createMemoryStore(options.name, options.storeName);
	},
};

void mock.module('localspace', () => ({
	INDEXEDDB: memoryLocalspace.INDEXEDDB,
	default: memoryLocalspace,
}));

let requestedPath = '';
let responseHref = '';
const requestUrlMock = mock(async (options: { url: string }) => {
	requestedPath = new URL(options.url).pathname;
	responseHref = requestedPath;
	return { headers: {}, text: '<xml />' };
});
const parseXMLMock = mock(() => ({
	multistatus: {
		response: [
			{
				href: responseHref,
				propstat: {
					prop: {
						getcontentlength: '12',
						getetag: 'etag-123',
						getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
						resourcetype: {},
					},
					status: 'HTTP/1.1 200 OK',
				},
			},
		],
	},
}));

void mock.module('~/utils/request-url', () => ({
	default: requestUrlMock,
}));
void mock.module('~/composable/parse-xml', () => ({
	default: parseXMLMock,
}));

const storageModulePromise = import('../src/migration/storage');
const remoteStatModulePromise = import('../src/migration/remote-stat');

type SeedNamespace = {
	currentNamespace: string;
};

async function cleanupDatabases(): Promise<void> {
	memoryDatabases.clear();
}

async function openStore(databaseName: string, storeName: string): Promise<MemoryStore> {
	const store = memoryLocalspace.createInstance({ name: databaseName, storeName });
	await store.ready();
	return store;
}

async function seedSourceNamespace(seed: SeedNamespace): Promise<void> {
	const syncState = await openStore('obsidian-webdav-sync', 'sync-state');
	const baseText = await openStore('obsidian-webdav-sync', 'base-text');
	const fileChunk = await openStore('obsidian-webdav-sync', 'file-chunk');

	try {
		await syncState.setItems([
			{
				key: `sync-state:${seed.currentNamespace}:/Folder/`,
				value: {
					local: { isDir: true, path: '/Folder/' },
					remote: { isDir: true, path: '/Folder/' },
				},
			},
			{
				key: `sync-state:${seed.currentNamespace}:/Folder/note.md`,
				value: {
					local: { isDir: false, mtime: 101, path: '/Folder/note.md', size: 12 },
					remote: { isDir: false, mtime: 201, path: '/Folder/note.md', size: 12 },
				},
			},
			{
				key: `sync-state:${seed.currentNamespace}:/Folder/second.md`,
				value: {
					local: { isDir: false, mtime: 301, path: '/Folder/second.md', size: 21 },
					remote: { isDir: false, mtime: 401, path: '/Folder/second.md', size: 21 },
				},
			},
			{
				key: 'sync-state:other-namespace:/Other/keep.md',
				value: {
					local: { isDir: false, mtime: 501, path: '/Other/keep.md', size: 7 },
					remote: { isDir: false, mtime: 601, path: '/Other/keep.md', size: 7 },
				},
			},
		]);

		await baseText.setItems([
			{ key: `base-text:${seed.currentNamespace}:/Folder/`, value: 'folder text' },
			{ key: `base-text:${seed.currentNamespace}:/Folder/note.md`, value: 'note text' },
			{ key: `base-text:${seed.currentNamespace}:/Folder/second.md`, value: 'second text' },
			{ key: 'base-text:other-namespace:/Other/keep.md', value: 'keep text' },
		]);

		await fileChunk.setItems([
			{
				key: `file-chunk:${seed.currentNamespace}:12:0:12:Folder/note.md`,
				value: new Uint8Array([1, 2, 3]).buffer,
			},
			{
				key: `file-chunk:${seed.currentNamespace}:21:0:21:Folder/second.md`,
				value: new Uint8Array([4, 5, 6]).buffer,
			},
			{
				key: 'file-chunk:other-namespace:7:0:7:Other/keep.md',
				value: new Uint8Array([7, 8]).buffer,
			},
		]);
	} finally {
		await Promise.all([syncState.destroy(), baseText.destroy(), fileChunk.destroy()]);
	}
}

test('buildV3Namespace and toV3UnifiedKey follow v3 path rules', async () => {
	const { buildV3Namespace, toV3UnifiedKey } = await storageModulePromise;

	expect(toV3UnifiedKey('/', false)).toBe('/');
	expect(toV3UnifiedKey('/Folder/note.md', false)).toBe('Folder/note.md');
	expect(toV3UnifiedKey('Folder/sub/', true)).toBe('Folder/sub/');

	const namespaceOptions = {
		baseDirectory: '/remote/base/',
		endpoint: 'https://dav.example.com///',
		username: 'alice',
		vaultName: 'Vault',
	};
	expect(buildV3Namespace(namespaceOptions)).toBe(
		hash('obsidian-vault~Vault~~webdav~https://dav.example.com///~alice~remote/base/'),
	);
	expect(buildV3Namespace({ ...namespaceOptions, baseDirectory: '/remote/base' })).toBe(
		buildV3Namespace(namespaceOptions),
	);
	expect(buildV3Namespace({ ...namespaceOptions, endpoint: 'https://dav.example.com' })).not.toBe(
		buildV3Namespace(namespaceOptions),
	);
});

test('migrateCurrentNamespaceStorage copies current namespace and preserves unrelated data', async () => {
	await cleanupDatabases();
	try {
		const { buildV3Namespace, migrateCurrentNamespaceStorage, toV3UnifiedKey } =
			await storageModulePromise;
		const sourceNamespace = getSyncStateKey({
			account: 'alice',
			remoteBaseDir: '/remote/base/',
			serverUrl: 'https://dav.example.com',
			vaultName: 'Vault',
		});
		const targetNamespace = buildV3Namespace({
			baseDirectory: '/remote/base/',
			endpoint: 'https://dav.example.com',
			username: 'alice',
			vaultName: 'Vault',
		});

		await seedSourceNamespace({ currentNamespace: sourceNamespace });

		const currentResolveMap = new Map([
			['Folder/note.md', 'etag-note'],
			['Folder/second.md', '401~21'],
		]);

		await migrateCurrentNamespaceStorage({
			resolveRemoteUid: async (path) => {
				const value = currentResolveMap.get(path);
				if (!value) throw new Error(`missing remote uid for ${path}`);
				return value;
			},
			sourceNamespace,
			targetNamespace,
			toV3Key: toV3UnifiedKey,
		});

		const targetBaseText = await openStore('sync-engine', `base-text-${targetNamespace}`);
		const targetSyncState = await openStore('sync-engine', targetNamespace);
		const sourceSyncState = await openStore('obsidian-webdav-sync', 'sync-state');
		const sourceBaseText = await openStore('obsidian-webdav-sync', 'base-text');
		const sourceFileChunk = await openStore('obsidian-webdav-sync', 'file-chunk');

		try {
			expect((await targetSyncState.getItem('Folder/')) as any).toStrictEqual({
				isDir: true,
			});
			expect((await targetSyncState.getItem('Folder/note.md')) as any).toStrictEqual({
				isDir: false,
				local: '101~12',
				remote: 'etag-note',
			});
			expect((await targetSyncState.getItem('Folder/second.md')) as any).toStrictEqual({
				isDir: false,
				local: '301~21',
				remote: '401~21',
			});
			expect((await targetBaseText.getItem('Folder/note.md')) as any).toBe('note text');
			expect((await targetBaseText.getItem('Folder/second.md')) as any).toBe('second text');
			expect((await targetBaseText.getItem('Folder/')) as any).toBeUndefined();

			const targetDatabase = memoryDatabases.get('sync-engine');
			expect(targetDatabase?.has('sync-state')).toBe(false);
			expect(targetDatabase?.has('base-text')).toBe(false);
			expect(targetDatabase?.has('__uni-kv-meta__')).toBe(false);

			expect((await sourceSyncState.keys()).sort()).toStrictEqual([
				'sync-state:other-namespace:/Other/keep.md',
			]);
			expect((await sourceBaseText.keys()).sort()).toStrictEqual([
				'base-text:other-namespace:/Other/keep.md',
			]);
			expect((await sourceFileChunk.keys()).sort()).toStrictEqual([
				'file-chunk:b08c8cd4:12:0:12:Folder/note.md',
				'file-chunk:b08c8cd4:21:0:21:Folder/second.md',
				'file-chunk:other-namespace:7:0:7:Other/keep.md',
			]);
		} finally {
			await Promise.all([
				targetBaseText.destroy(),
				targetSyncState.destroy(),
				sourceSyncState.destroy(),
				sourceBaseText.destroy(),
				sourceFileChunk.destroy(),
			]);
		}
	} finally {
		await cleanupDatabases();
	}
});

test('migrateCurrentNamespaceStorage leaves source data intact when target write setup fails', async () => {
	await cleanupDatabases();
	try {
		const { buildV3Namespace, migrateCurrentNamespaceStorage, toV3UnifiedKey } =
			await storageModulePromise;
		const sourceNamespace = getSyncStateKey({
			account: 'alice',
			remoteBaseDir: '/remote/base/',
			serverUrl: 'https://dav.example.com',
			vaultName: 'Vault',
		});
		const targetNamespace = buildV3Namespace({
			baseDirectory: '/remote/base/',
			endpoint: 'https://dav.example.com',
			username: 'alice',
			vaultName: 'Vault',
		});

		await seedSourceNamespace({ currentNamespace: sourceNamespace });

		let migrationError: unknown;
		try {
			await migrateCurrentNamespaceStorage({
				resolveRemoteUid: async (path) => {
					if (path === 'Folder/note.md') return 'etag-note';
					throw new Error('remote uid unavailable');
				},
				sourceNamespace,
				targetNamespace,
				toV3Key: toV3UnifiedKey,
			});
		} catch (error) {
			migrationError = error;
		}

		expect(migrationError).toBeInstanceOf(Error);
		expect((migrationError as Error).message).toBe('remote uid unavailable');

		const targetBaseText = await openStore('sync-engine', `base-text-${targetNamespace}`);
		const targetSyncState = await openStore('sync-engine', targetNamespace);
		const sourceSyncState = await openStore('obsidian-webdav-sync', 'sync-state');
		const sourceBaseText = await openStore('obsidian-webdav-sync', 'base-text');
		const sourceFileChunk = await openStore('obsidian-webdav-sync', 'file-chunk');

		try {
			expect((await targetSyncState.keys()) as any).toStrictEqual([]);
			expect((await targetBaseText.keys()) as any).toStrictEqual([]);
			expect(memoryDatabases.get('sync-engine')?.has('__uni-kv-meta__')).toBe(false);
			expect((await sourceSyncState.keys()) as any).toStrictEqual([
				`sync-state:${sourceNamespace}:/Folder/`,
				`sync-state:${sourceNamespace}:/Folder/note.md`,
				`sync-state:${sourceNamespace}:/Folder/second.md`,
				'sync-state:other-namespace:/Other/keep.md',
			]);
			expect((await sourceBaseText.keys()) as any).toStrictEqual([
				`base-text:${sourceNamespace}:/Folder/`,
				`base-text:${sourceNamespace}:/Folder/note.md`,
				`base-text:${sourceNamespace}:/Folder/second.md`,
				'base-text:other-namespace:/Other/keep.md',
			]);
			expect((await sourceFileChunk.keys()) as any).toStrictEqual([
				`file-chunk:${sourceNamespace}:12:0:12:Folder/note.md`,
				`file-chunk:${sourceNamespace}:21:0:21:Folder/second.md`,
				'file-chunk:other-namespace:7:0:7:Other/keep.md',
			]);
		} finally {
			await Promise.all([
				targetBaseText.destroy(),
				targetSyncState.destroy(),
				sourceSyncState.destroy(),
				sourceBaseText.destroy(),
				sourceFileChunk.destroy(),
			]);
		}
	} finally {
		await cleanupDatabases();
	}
});

test('getRemoteUidStat stats encrypted execution paths', async () => {
	const { getRemoteUidStat } = await remoteStatModulePromise;
	const plugin: any = {
		app: { secretStorage: { getSecret: () => 'password' } },
		getSyncEncryptionContext() {
			return createSyncEncryptionContext(
				this.settings as never,
				this.app.secretStorage as never,
			);
		},
		getToken() {
			return 'token-value';
		},
		settings: {
			account: 'alice',
			customHeaders: { Authorization: 'Bearer token' },
			encryption: { enabled: true, value: 'secret-ref' },
			remoteDir: '/remote.php/dav/files/alice',
			serverUrl: 'https://dav.example.com',
		},
	};

	setPluginInstance(plugin as never);
	try {
		const stat = await getRemoteUidStat(
			plugin as never,
			'/remote.php/dav/files/alice/Folder/note.md',
		);

		expect(requestedPath).not.toBe('/remote.php/dav/files/alice/Folder/note.md');
		expect(requestedPath).toMatch(/^\/remote\.php\/dav\/files\/alice\//);
		expect(stat).toStrictEqual({
			etag: 'etag-123',
			isDir: false,
			mtime: new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf(),
			size: 12,
		});
	} finally {
		setPluginInstance();
	}
});
