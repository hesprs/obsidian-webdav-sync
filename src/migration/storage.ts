import type { LocalSpaceInstance } from 'localspace';
import localspace from 'localspace';
import type { RecordStatModel } from '~/types';
import { hash } from '~/platform/crypto';
import { normalizeRemotePath } from '~/platform/path';
import {
	BASE_TEXT_STORE_NAME,
	STORAGE_NAME as SOURCE_STORAGE_NAME,
	parseKey,
} from '~/storage/store.interface';
import { isNil } from '~/utils/fns';

export type V2NamespaceSnapshot = {
	namespace: string;
	syncStateKeys: Array<string>;
	baseTextKeys: Array<string>;
};

export type MigrateStorageOptions = {
	sourceNamespace: string;
	targetNamespace: string;
	toV3Key: (v2Path: string, isDir: boolean) => string;
	resolveRemoteUid: (path: string) => Promise<string>;
	beforeSourceCleanup?: () => Promise<void>;
};

export type CleanupStorageOptions = Pick<
	MigrateStorageOptions,
	'sourceNamespace' | 'beforeSourceCleanup'
>;

export type BuildV3NamespaceOptions = {
	vaultName: string;
	endpoint: string;
	username: string;
	baseDirectory: string;
};

type SourceNamespaceRecord = {
	key: string;
	path: string;
	value: RecordStatModel;
};

type SourceNamespaceText = {
	key: string;
	path: string;
	value: string;
};

type SourceNamespaceSnapshot = {
	baseText: Array<SourceNamespaceText>;
	syncState: Array<SourceNamespaceRecord>;
};

type TargetRecordStatModel = { isDir: true } | { isDir: false; local: string; remote: string };

const TARGET_STORAGE_NAME = 'sync-engine';
const TARGET_SYNC_STATE_STORE_NAME = 'sync-state';

function createStore(storeName: string, databaseName: string): LocalSpaceInstance {
	return localspace.createInstance({
		coalesceWrites: false,
		driver: [localspace.INDEXEDDB],
		name: databaseName,
		storeName,
	});
}

function loadSourceStore(databaseName: string, storeName: string) {
	return createStore(storeName, databaseName);
}

function loadTargetStore(storeName: string) {
	return createStore(storeName, TARGET_STORAGE_NAME);
}

function getSmartMergeBaseTextStoreName(namespace: string): string {
	return `base-text-${namespace}`;
}

function normalizeV2Path(path: string): string {
	if (path === '/') return '/';
	return normalizeRemotePath(path);
}

export function normalizeV3BaseDir(path: string): string {
	const normalized = path
		.split('/')
		.filter((segment) => segment !== '')
		.map((segment) => decodeURIComponent(segment.normalize('NFC')))
		.join('/');
	return normalized === '' ? '/' : `${normalized}/`;
}

function isDirectoryPath(path: string): boolean {
	return path === '/' || path.endsWith('/');
}

async function snapshotSourceNamespace(
	sourceNamespace: string,
	stores: {
		syncState: LocalSpaceInstance;
		baseText: LocalSpaceInstance;
	},
): Promise<SourceNamespaceSnapshot> {
	const [syncStateKeys, baseTextKeys] = await Promise.all([
		stores.syncState.keys(),
		stores.baseText.keys(),
	]);

	const filteredSyncStateKeys = syncStateKeys.filter(
		(key) => parseKey(key).namespace === sourceNamespace,
	);
	const filteredBaseTextKeys = baseTextKeys.filter(
		(key) => parseKey(key).namespace === sourceNamespace,
	);

	const [syncStateEntries, baseTextEntries] = await Promise.all([
		stores.syncState.getItems<RecordStatModel>(filteredSyncStateKeys),
		stores.baseText.getItems<string>(filteredBaseTextKeys),
	]);

	return {
		baseText: baseTextEntries
			.filter(({ value }) => !isNil(value))
			.map(({ key, value }) => ({
				key,
				path: parseKey(key).path,
				value: value as string,
			})),
		syncState: syncStateEntries
			.filter(({ value }) => !isNil(value))
			.map(({ key, value }) => ({
				key,
				path: parseKey(key).path,
				value: value as RecordStatModel,
			})),
	};
}

export function buildV3Namespace({
	vaultName,
	endpoint,
	username,
	baseDirectory,
}: BuildV3NamespaceOptions) {
	return hash(
		`obsidian-vault~${vaultName}~~webdav~${endpoint}~${username}~${normalizeV3BaseDir(baseDirectory)}`,
	);
}

export function toV3UnifiedKey(v2Path: string, isDir: boolean) {
	const normalizedPath = normalizeV2Path(v2Path);
	if (normalizedPath === '/') return '/';
	const strippedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
	return isDir || strippedPath.endsWith('/')
		? `${strippedPath.replace(/\/+$/, '')}/`
		: strippedPath;
}

async function writeTargetNamespace(
	stores: {
		baseText: LocalSpaceInstance;
		syncState: LocalSpaceInstance;
	},
	entries: {
		baseText: Array<{ key: string; value: string }>;
		syncState: Array<{ key: string; value: TargetRecordStatModel }>;
	},
) {
	await Promise.all([
		stores.syncState.setItems(entries.syncState),
		stores.baseText.setItems(entries.baseText),
	]);
}

async function cleanupSourceNamespace(
	stores: {
		baseText: LocalSpaceInstance;
		syncState: LocalSpaceInstance;
	},
	namespaceSnapshot: V2NamespaceSnapshot,
) {
	const cleanupOperations = [
		stores.syncState.removeItems(namespaceSnapshot.syncStateKeys),
		stores.baseText.removeItems(namespaceSnapshot.baseTextKeys),
	];
	await Promise.all(cleanupOperations);
}

async function sourceNamespaceIsEmpty(stores: {
	baseText: LocalSpaceInstance;
	syncState: LocalSpaceInstance;
}): Promise<boolean> {
	const [syncStateKeys, baseTextKeys] = await Promise.all([
		stores.syncState.keys(),
		stores.baseText.keys(),
	]);
	return syncStateKeys.length === 0 && baseTextKeys.length === 0;
}

async function destroyStores(stores: Array<LocalSpaceInstance>) {
	await Promise.all(stores.map((store) => store.destroy()));
}

export async function cleanupCurrentNamespaceStorage({
	sourceNamespace,
	beforeSourceCleanup,
}: CleanupStorageOptions): Promise<void> {
	const sourceStores = {
		baseText: loadSourceStore(SOURCE_STORAGE_NAME, BASE_TEXT_STORE_NAME),
		syncState: loadSourceStore(SOURCE_STORAGE_NAME, TARGET_SYNC_STATE_STORE_NAME),
	};

	try {
		await Promise.all([sourceStores.baseText.ready(), sourceStores.syncState.ready()]);
		const snapshot = await snapshotSourceNamespace(sourceNamespace, sourceStores);
		await beforeSourceCleanup?.();
		await cleanupSourceNamespace(sourceStores, {
			baseTextKeys: snapshot.baseText.map(({ key }) => key),
			namespace: sourceNamespace,
			syncStateKeys: snapshot.syncState.map(({ key }) => key),
		});
		if (await sourceNamespaceIsEmpty(sourceStores))
			await sourceStores.syncState.dropInstance({ name: SOURCE_STORAGE_NAME });
	} finally {
		await destroyStores([sourceStores.baseText, sourceStores.syncState]);
	}
}

export async function migrateCurrentNamespaceStorage({
	sourceNamespace,
	targetNamespace,
	toV3Key,
	resolveRemoteUid,
	beforeSourceCleanup,
}: MigrateStorageOptions): Promise<void> {
	const sourceStores = {
		baseText: loadSourceStore(SOURCE_STORAGE_NAME, BASE_TEXT_STORE_NAME),
		syncState: loadSourceStore(SOURCE_STORAGE_NAME, TARGET_SYNC_STATE_STORE_NAME),
	};
	const targetStores = {
		baseText: loadTargetStore(getSmartMergeBaseTextStoreName(targetNamespace)),
		syncState: loadTargetStore(targetNamespace),
	};

	try {
		await Promise.all([
			sourceStores.baseText.ready(),
			sourceStores.syncState.ready(),
			targetStores.baseText.ready(),
			targetStores.syncState.ready(),
		]);

		const snapshot = await snapshotSourceNamespace(sourceNamespace, sourceStores);
		const syncRecordMap = new Map(snapshot.syncState.map(({ path, value }) => [path, value]));

		const targetSyncStateEntries = await Promise.all(
			snapshot.syncState.map(async ({ path, value }) => {
				const targetKey = toV3Key(path, value.local.isDir || value.remote.isDir);
				if (value.local.isDir || value.remote.isDir)
					return {
						key: targetKey,
						value: { isDir: true } as const,
					};

				const remoteUid = await resolveRemoteUid(targetKey);
				return {
					key: targetKey,
					value: {
						isDir: false,
						local: `${value.local.mtime}~${value.local.size}`,
						remote: remoteUid,
					} as const,
				};
			}),
		);

		const targetBaseTextEntries = snapshot.baseText
			.filter(({ path }) => {
				const record = syncRecordMap.get(path);
				return record
					? !(record.local.isDir || record.remote.isDir)
					: !isDirectoryPath(path);
			})
			.map(({ path, value }) => ({
				key: toV3Key(path, false),
				value,
			}));

		await writeTargetNamespace(targetStores, {
			baseText: targetBaseTextEntries,
			syncState: targetSyncStateEntries,
		});
		await beforeSourceCleanup?.();

		const cleanupSnapshot: V2NamespaceSnapshot = {
			baseTextKeys: snapshot.baseText.map(({ key }) => key),
			namespace: sourceNamespace,
			syncStateKeys: snapshot.syncState.map(({ key }) => key),
		};
		await cleanupSourceNamespace(sourceStores, cleanupSnapshot);

		if (await sourceNamespaceIsEmpty(sourceStores))
			await sourceStores.syncState.dropInstance({ name: SOURCE_STORAGE_NAME });
	} finally {
		await destroyStores([
			sourceStores.baseText,
			sourceStores.syncState,
			targetStores.baseText,
			targetStores.syncState,
		]);
	}
}
