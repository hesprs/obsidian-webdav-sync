import { parse as bytesParse } from 'bytes-iec';
import { normalizeBaseDir } from '~/platform/path';
import { ConflictStrategy } from '~/sync/tasks/merge.task';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';

// TODO: remove migration in October 2026
export function processSettings(plugin: WebDAVSyncPlugin): void {
	let changed = false;

	// v2 migration
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

	// v2 migration
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

	// v2 migration
	if (plugin.settings.remoteDir === '') {
		plugin.settings.remoteDir = normalizeBaseDir(plugin.app.vault.getName());
		logger.info(`Migrated remoteDir to ${plugin.settings.remoteDir}`);
		changed = true;
	} else plugin.settings.remoteDir = normalizeBaseDir(plugin.settings.remoteDir);

	// remove at 19 April 2026
	if (plugin.settings.maxConcurrentWebDAVCalls === 0) {
		plugin.settings.maxConcurrentWebDAVCalls = 100;
		logger.info(`Set max concurrent WebDAV calls to 100.`);
	}

	// ensure config dir is excluded
	const configDir = plugin.app.vault.configDir;
	const hasConfigDirRule = plugin.settings.filterRules.exclusionRules.some(
		(rule) => rule.expr === configDir,
	);
	if (!hasConfigDirRule) {
		plugin.settings.filterRules.exclusionRules.push({
			expr: configDir,
			options: { caseSensitive: false },
		});
		changed = true;
	}

	if (changed) void plugin.saveSettings();
}
