import { expect, mock, test } from 'bun:test';
import { getSyncStateKey } from '~/utils/get-sync-state-key';

type RequestUrlInput = string | { url: string };

let requestUrlBehavior: (
	options: RequestUrlInput,
) => Promise<{ headers: Record<string, string>; text: string }> = async () => ({
	headers: {},
	text: '{}',
});
const requestUrlMock = mock(async (options: RequestUrlInput) => await requestUrlBehavior(options));
const parseXMLMock = mock(() => ({ multistatus: { response: [] } }));

const memoryDatabases = new Map<string, Map<string, Map<string, unknown>>>();
let throwOnSourceCleanup = false;

function getUrl(options: RequestUrlInput): string {
	return typeof options === 'string' ? options : options.url;
}

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

function createMemoryStore(databaseName: string, storeName: string) {
	const store = getStoreMap(databaseName, storeName);
	return {
		destroy: async () => {},
		dropInstance: async ({ name }: { name: string }) => {
			memoryDatabases.delete(name);
		},
		getItems: async (keys: Array<string>) =>
			keys.map((key) => ({ key, value: store.get(key) })),
		keys: async () => [...store.keys()],
		ready: async () => {},
		removeItems: async (keys: Array<string>) => {
			if (
				throwOnSourceCleanup &&
				databaseName === 'obsidian-webdav-sync' &&
				storeName === 'sync-state'
			)
				throw new Error('source cleanup failed');
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

void mock.module('~/utils/request-url', () => ({
	default: requestUrlMock,
}));
void mock.module('~/composable/parse-xml', () => ({
	default: parseXMLMock,
}));
void mock.module('~/components/V3MigrationModal', () => ({
	default: class {
		containerEl = { isConnected: true };
		close() {}
		renderPrompt() {}
		open() {}
	},
}));
void mock.module('~/utils/v3-exists', () => ({
	default: mock(async () => false),
}));
void mock.module('localspace', () => ({
	INDEXEDDB: 'indexeddb',
	default: {
		INDEXEDDB: 'indexeddb',
		createInstance: (options: { name: string; storeName: string }) =>
			createMemoryStore(options.name, options.storeName),
	},
}));

const migrationModule = import('../src/migration/index');

function seedSourceStorage(namespace: string): void {
	getStoreMap('obsidian-webdav-sync', 'sync-state').set(`sync-state:${namespace}:/Folder/`, {
		local: { isDir: true, path: '/Folder/' },
		remote: { isDir: true, path: '/Folder/' },
	});
}

function createPlugin(syncResult: unknown): any {
	const adapter = {
		exists: mock(async () => true),
		mkdir: mock(async () => undefined),
		rmdir: mock(async () => undefined),
		write: mock(async () => undefined),
	};
	const store = {
		store: {
			getItems: mock(async () => []),
			keys: mock(async () => []),
			removeItems: mock(async () => undefined),
			setItems: mock(async () => undefined),
		},
	};

	return {
		adapter,
		baseTextStore: store,
		fileChunkStore: store,
		plugin: {
			app: {
				vault: {
					adapter,
					configDir: '.obsidian',
					getName: () => 'Vault',
				},
			},
			baseTextStore: store,
			fileChunkStore: store,
			isSyncing: false,
			isV3MigrationRunning: false,
			saveSettings: mock(async () => undefined),
			settings: {
				account: 'alice',
				confirmBeforeDeleteInAutoSync: false,
				confirmBeforeSync: false,
				customHeaders: {},
				encryption: { enabled: false, value: 'secret-ref' },
				exhaustiveRemoteTraversal: false,
				fastRealtimeSync: false,
				filterRules: { exclusionRules: [], inclusionRules: [] },
				maxSyncTaskConcurrency: { enabled: false, value: 1 },
				maxThroughputConcurrency: { enabled: false, value: 1 },
				maxWebDAVConcurrency: { enabled: false, value: 1 },
				minWebDAVRequestInterval: { enabled: false, value: 1 },
				neverShowV3Migration: false,
				realtimeSync: { enabled: false, value: 1 },
				remoteDir: '/remote/base/',
				scheduledSync: { enabled: false, value: 1 },
				serverUrl: 'https://dav.example.com',
				showSyncStatusInNotificationOnMobile: false,
				skipLargeFiles: { enabled: false, value: 1 },
				startupSync: { enabled: false, value: 1 },
				token: 'token-value',
				unmergeableStrategy: 'skip',
				useGitStyle: false,
				v3Exists: true,
			},
			syncSchedulerService: {
				requestSync: mock(async () => syncResult),
			},
			syncStateStore: store,
		},
		syncStateStore: store,
	};
}

test('runMigration aborts when prerequisite sync is not executed', async () => {
	const { default: V3MigrationService } = await migrationModule;
	const { plugin, adapter, baseTextStore, fileChunkStore, syncStateStore } = createPlugin({
		executed: false,
	});
	const service = new V3MigrationService(plugin as never);
	const progress: Array<{ step: string }> = [];

	const result = await service.runMigration((update) => progress.push({ step: update.step }));

	expect(result).toStrictEqual({
		error: new Error('Prerequisite sync did not complete.'),
		ok: false,
		rolledBack: false,
	});
	expect(progress.map((item) => item.step)).toStrictEqual(['prepSync']);
	expect(adapter.write.mock.calls).toHaveLength(0);
	expect(adapter.rmdir.mock.calls).toHaveLength(0);
	expect(baseTextStore.store.setItems.mock.calls).toHaveLength(0);
	expect(fileChunkStore.store.removeItems.mock.calls).toHaveLength(0);
	expect(syncStateStore.store.removeItems.mock.calls).toHaveLength(0);
});

test('runMigration aborts when prerequisite sync is cancelled or failed', async () => {
	const { default: V3MigrationService } = await migrationModule;
	for (const syncResult of [
		{ executed: true, run: { stage: 'cancelled' } },
		{ executed: true, run: { stage: 'failed' } },
	]) {
		const { plugin, adapter, baseTextStore, fileChunkStore, syncStateStore } =
			createPlugin(syncResult);
		const service = new V3MigrationService(plugin as never);
		const progress: Array<{ step: string }> = [];

		const result = await service.runMigration((update) => progress.push({ step: update.step }));

		if (result.ok) throw new Error('unexpected success');
		expect(result.rolledBack).toBe(false);
		expect(result.error.message).toBe('Prerequisite sync failed.');
		expect(progress.map((item) => item.step)).toStrictEqual(['prepSync']);
		expect(adapter.write.mock.calls).toHaveLength(0);
		expect(adapter.rmdir.mock.calls).toHaveLength(0);
		expect(baseTextStore.store.setItems.mock.calls).toHaveLength(0);
		expect(fileChunkStore.store.removeItems.mock.calls).toHaveLength(0);
		expect(syncStateStore.store.removeItems.mock.calls).toHaveLength(0);
	}
});

test('runMigration rolls back target artifacts on fatal failure before source cleanup', async () => {
	requestUrlBehavior = async () => {
		throw new Error('catalog unavailable');
	};
	const previousIndexedDb = (globalThis as any).indexedDB;
	(globalThis as any).indexedDB = {
		deleteDatabase() {
			return {
				addEventListener(type: string, callback: () => void) {
					if (type === 'success') queueMicrotask(callback);
				},
			};
		},
	};
	try {
		const { default: V3MigrationService } = await migrationModule;
		const { plugin, adapter, baseTextStore, fileChunkStore, syncStateStore } = createPlugin({
			executed: true,
			run: { stage: 'completed' },
		});
		const service = new V3MigrationService(plugin as never);
		const progress: Array<{ step: string }> = [];

		const result = await service.runMigration((update) => progress.push({ step: update.step }));

		if (result.ok) throw new Error('unexpected success');
		expect(result.rolledBack).toBe(true);
		expect(result.error.message).toBe('catalog unavailable');
		expect(progress.map((item) => item.step)).toStrictEqual(['prepSync', 'fetchCatalog']);
		expect(adapter.rmdir.mock.calls).toHaveLength(1);
		const rmdirCalls = adapter.rmdir.mock.calls as Array<[string, boolean]>;
		expect(rmdirCalls[0][0]).toBe('.obsidian/plugins/sync-engine');
		expect(adapter.write.mock.calls).toHaveLength(0);
		expect(baseTextStore.store.setItems.mock.calls).toHaveLength(0);
		expect(fileChunkStore.store.removeItems.mock.calls).toHaveLength(0);
		expect(syncStateStore.store.removeItems.mock.calls).toHaveLength(0);
	} finally {
		(globalThis as any).indexedDB = previousIndexedDb;
	}
});

test('runMigration keeps target artifacts when source cleanup fails after settings save', async () => {
	memoryDatabases.clear();
	throwOnSourceCleanup = true;
	requestUrlBehavior = async (options) => {
		const url = getUrl(options);
		if (url.endsWith('/modules.json'))
			return {
				headers: {},
				text: JSON.stringify([
					{
						description: 'webdav',
						main: 'https://cdn.example.com/webdav.js',
						name: 'WebDAV',
						version: '1.0.0',
					},
				]),
			};
		return { headers: {}, text: 'module code' };
	};

	try {
		const { default: V3MigrationService } = await migrationModule;
		const { plugin, adapter } = createPlugin({
			executed: true,
			run: { stage: 'completed' },
		});
		const sourceNamespace = getSyncStateKey({
			account: plugin.settings.account,
			remoteBaseDir: plugin.settings.remoteDir,
			serverUrl: plugin.settings.serverUrl,
			vaultName: plugin.app.vault.getName(),
		});
		seedSourceStorage(sourceNamespace);
		const service = new V3MigrationService(plugin as never);

		const result = await service.runMigration(() => undefined);

		if (result.ok) throw new Error('unexpected success');
		expect(result.rolledBack).toBe(false);
		expect(result.error.message).toBe('source cleanup failed');
		expect(plugin.settings.neverShowV3Migration).toBe(true);
		expect(adapter.rmdir.mock.calls).toHaveLength(0);
		expect(adapter.write.mock.calls).toHaveLength(2);
	} finally {
		throwOnSourceCleanup = false;
		memoryDatabases.clear();
	}
});

test('runMigration skips v3 IndexedDB migration for encrypted vaults', async () => {
	memoryDatabases.clear();
	requestUrlBehavior = async (options) => {
		const url = getUrl(options);
		if (url.endsWith('/modules.json'))
			return {
				headers: {},
				text: JSON.stringify([
					{
						description: 'webdav',
						main: 'https://cdn.example.com/webdav.js',
						name: 'WebDAV',
						version: '1.0.0',
					},
					{
						description: 'encryption',
						main: 'https://cdn.example.com/encryption.js',
						name: 'Encryption',
						version: '1.0.0',
					},
				]),
			};
		return { headers: {}, text: 'module code' };
	};

	try {
		const { default: V3MigrationService } = await migrationModule;
		const { plugin } = createPlugin({
			executed: true,
			run: { stage: 'completed' },
		});
		plugin.settings.encryption.enabled = true;
		const sourceNamespace = getSyncStateKey({
			account: plugin.settings.account,
			remoteBaseDir: plugin.settings.remoteDir,
			serverUrl: plugin.settings.serverUrl,
			vaultName: plugin.app.vault.getName(),
		});
		seedSourceStorage(sourceNamespace);
		getStoreMap('obsidian-webdav-sync', 'base-text').set(
			`base-text:${sourceNamespace}:/note.md`,
			'note text',
		);
		const progress: Array<{ step: string }> = [];

		const result = await new V3MigrationService(plugin as never).runMigration((update) =>
			progress.push({ step: update.step }),
		);

		expect(result).toStrictEqual({ encryptionEnabled: true, ok: true });
		expect(memoryDatabases.has('sync-engine')).toBe(false);
		expect(memoryDatabases.has('obsidian-webdav-sync')).toBe(false);
		expect(progress.map((item) => item.step)).not.toContain('migrateStorage');
	} finally {
		memoryDatabases.clear();
	}
});
