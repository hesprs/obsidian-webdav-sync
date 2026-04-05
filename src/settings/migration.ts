import { parse as bytesParse } from 'bytes-iec';
import { normalizeBaseDir } from '~/platform/path';
import { ConflictStrategy } from '~/sync/tasks/conflict-resolve.task';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';

// TODO: Remove migration in October 2026
export function migrateSettings(plugin: WebDAVSyncPlugin): void {
	let changed = false;

	const skip = plugin.settings.skipLargeFiles;
	if (skip.bytes === undefined) {
		const bytes = bytesParse(skip.maxSize, { mode: 'jedec' });
		if (bytes === null)
			plugin.settings.skipLargeFiles = {
				maxSize: '30 MB',
				bytes: 31457280,
			};
		else skip.bytes = bytes;
		logger.info('Migrated skipLargeFiles.maxSize to bytes');
		changed = true;
	}

	const conflictStrategy = plugin.settings.conflictStrategy;
	const map = {
		'diff-match-patch': ConflictStrategy.DiffMatchPatch,
		'local-wins': ConflictStrategy.KeepLocal,
		'remote-wins': ConflictStrategy.KeepRemote,
		skip: ConflictStrategy.Skip,
		'latest-timestamp': ConflictStrategy.LatestTimeStamp,
	};
	if (conflictStrategy in map) {
		plugin.settings.conflictStrategy = map[conflictStrategy as keyof typeof map];
		logger.info(
			`Migrated conflictStrategy from ${conflictStrategy} to ${plugin.settings.conflictStrategy}`,
		);
		changed = true;
	}

	if (plugin.settings.remoteDir === '') {
		plugin.settings.remoteDir = normalizeBaseDir(plugin.app.vault.getName());
		logger.info(`Migrated remoteDir to ${plugin.settings.remoteDir}`);
		changed = true;
	}

	if (changed) void plugin.saveSettings();
}
