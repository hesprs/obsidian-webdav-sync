import localspace from 'localspace';
import { isNil } from 'lodash-es';
import type WebDAVSyncPlugin from '~/index';
import type { RecordStatModel, StatModel } from '~/types';
import {
	normalizePathToAbsolute,
	normalizePathToRelative,
	normalizeVaultPath,
} from '~/platform/path';
import { isMergeablePath } from '~/sync/utils/is-mergeable-path';
import logger from '~/utils/logger';
import {
	BASE_TEXT_STORE_NAME,
	parseKey,
	STORAGE_NAME,
	SYNC_STATE_STORE_NAME,
} from '../store.interface';

type LegacyLocalRecordModel = {
	local?: StatModel;
	baseText?: string;
};

type LegacyLocalRecordsModel = Record<string, LegacyLocalRecordModel>;

type LegacyRemoteRecordModel = {
	nodes?: Record<string, StatModel[]>;
};

function isLegacyLocalRecordsModel(value: unknown): value is LegacyLocalRecordsModel {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLegacyRemoteRecordModel(value: unknown): value is LegacyRemoteRecordModel {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isStatModel(value: unknown): value is StatModel {
	if (value === null || typeof value !== 'object' || !('path' in value) || !('isDir' in value))
		return false;

	if ((value as { isDir: boolean }).isDir) return true;

	return 'mtime' in value && 'size' in value;
}

function cloneStatWithPath(stat: StatModel, path: string): StatModel {
	if (stat.isDir) return { isDir: true, path };
	return {
		isDir: false,
		path,
		mtime: stat.mtime,
		size: stat.size,
	};
}

function inferRemoteStat(remoteBaseDir: string, localStat: StatModel): StatModel {
	const remotePath = normalizePathToAbsolute(remoteBaseDir, localStat.path, localStat.isDir);
	if (localStat.isDir) return { isDir: true, path: remotePath };
	return {
		isDir: false,
		path: remotePath,
		mtime: localStat.mtime,
		size: localStat.size,
	};
}

function yieldEventLoop(): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, 0);
	});
}

export async function migrate(plugin: WebDAVSyncPlugin, namespace: string): Promise<void> {
	await yieldEventLoop();

	const syncStateStore = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: SYNC_STATE_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: false,
	});
	const baseTextStore = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: BASE_TEXT_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: false,
	});

	await Promise.all([syncStateStore.ready(), baseTextStore.ready()]);

	const legacyLocalKey = `sync-state:${namespace}:local`;
	const legacyRemoteKey = `sync-state:${namespace}:remote`;
	const legacyMetaKey = `sync-state:${namespace}:meta`;

	try {
		const legacyLocalRaw = await syncStateStore.getItem<unknown>(legacyLocalKey);
		if (!isLegacyLocalRecordsModel(legacyLocalRaw)) {
			throw new Error('Legacy local records are missing or invalid');
		}

		const legacyRemoteRaw = await syncStateStore.getItem<unknown>(legacyRemoteKey);
		const legacyRemote = isLegacyRemoteRecordModel(legacyRemoteRaw)
			? legacyRemoteRaw
			: { nodes: {} };

		const remoteMap = new Map<string, StatModel>();

		for (const stats of Object.values(legacyRemote.nodes ?? {})) {
			if (!Array.isArray(stats)) continue;
			for (const stat of stats) {
				if (!isStatModel(stat)) continue;
				const vaultPath = normalizePathToRelative(plugin.settings.remoteDir, stat.path);
				remoteMap.set(vaultPath, stat);
			}
		}

		const localEntries = Object.entries(legacyLocalRaw)
			.map(([rawPath, localRecord]) => ({
				normalizedPath: normalizeVaultPath(rawPath),
				localRecord,
			}))
			.sort((a, b) => a.normalizedPath.localeCompare(b.normalizedPath));

		const queuedSyncStateReads: Array<string> = [];
		const queuedBaseTextReads: Array<string> = [];
		const queuedSyncStateWrites: Array<RecordStatModel> = [];
		const queuedBaseTextWrites: Array<string> = [];

		for (const { normalizedPath, localRecord } of localEntries) {
			if (!localRecord || !isStatModel(localRecord.local)) {
				throw new Error('Legacy local record entry is missing local stat');
			}

			const localStat = cloneStatWithPath(localRecord.local, normalizedPath);
			const matchedRemote = remoteMap.get(normalizedPath);
			const remoteStat = matchedRemote
				? cloneStatWithPath(
						matchedRemote,
						normalizePathToAbsolute(
							plugin.settings.remoteDir,
							matchedRemote.path,
							matchedRemote.isDir,
						),
					)
				: inferRemoteStat(plugin.settings.remoteDir, localStat);

			const syncKey = `sync-state:${namespace}:${normalizedPath}`;

			queuedSyncStateReads.push(syncKey);
			queuedSyncStateWrites.push({
				local: localStat,
				remote: remoteStat,
			});

			if (typeof localRecord.baseText === 'string' && isMergeablePath(localStat.path)) {
				const baseText = localRecord.baseText;
				const baseTextKey = `base-text:${namespace}:${normalizedPath}`;
				queuedBaseTextReads.push(baseTextKey);
				queuedBaseTextWrites.push(baseText);
			}
		}

		const [syncState, baseText] = await Promise.all([
			syncStateStore.getItems<RecordStatModel>(queuedSyncStateReads),
			baseTextStore.getItems<string>(queuedBaseTextReads),
		]);

		const finalSyncStateWrites: Array<{ key: string; value: RecordStatModel }> = [];
		const finalBaseTextWrites: Array<{ key: string; value: string }> = [];
		syncState.forEach((value, index) => {
			if (!isNil(value.value)) return;
			finalSyncStateWrites.push({
				key: value.key,
				value: queuedSyncStateWrites[index],
			});
		});
		baseText.forEach((value, index) => {
			if (!isNil(value.value)) return;
			finalBaseTextWrites.push({
				key: value.key,
				value: queuedBaseTextWrites[index],
			});
		});

		await Promise.all([
			syncStateStore.setItems<RecordStatModel>(finalSyncStateWrites),
			baseTextStore.setItems<string>(finalBaseTextWrites),
		]);

		await syncStateStore.removeItems([legacyLocalKey, legacyRemoteKey, legacyMetaKey]);

		logger.info('Successfully migrated legacy sync state');
	} catch (error) {
		logger.error('Failed to migrate legacy sync state', error);
	}
}

export async function pruneBaseTextStore(_namespace: string): Promise<void> {
	const baseTextStore = localspace.createInstance({
		name: STORAGE_NAME,
		storeName: BASE_TEXT_STORE_NAME,
		driver: [localspace.INDEXEDDB],
		coalesceWrites: false,
	});
	await baseTextStore.ready();
	const keys = (await baseTextStore.keys()).filter((key) => {
		const { namespace, path } = parseKey(key);
		return namespace === _namespace && !isMergeablePath(path);
	});
	if (keys.length > 0) {
		await baseTextStore.removeItems(keys);
		logger.info(`Successfully pruned ${keys.length} entries in base text store.`);
	}
}
