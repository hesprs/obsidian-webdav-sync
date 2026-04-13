import { parse as bytesParse } from 'bytes-iec';
import type { GlobMatchOptions } from '~/utils/glob-match';
import { hash } from '~/platform/crypto';
import { normalizeBaseDir } from '~/platform/path';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';
import { ConflictStrategy } from '.';

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

	// remove at 22 April 2026
	const originalHash = hash(
		['**/.git', '**/.DS_Store', '**/.trash', plugin.app.vault.configDir].map(
			createGlobMatchOptions,
		),
	);
	if (hash(plugin.settings.filterRules.exclusionRules) === originalHash) {
		changed = true;
		plugin.settings.filterRules.exclusionRules = [
			'**/.git',
			'**/.github',
			'**/.gitlab',
			'**/.svn',
			'**/node_modules',
			'**/.DS_Store',
			'**/__MACOSX',
			'**/desktop.ini',
			'**/Thumbs.db',
			'**/.trash',
			'**/~$*.doc',
			'**/~$*.docx',
			'**/~$*.ppt',
			'**/~$*.pptx',
			'**/~$*.xls',
			'**/~$*.xlsx',
			plugin.app.vault.configDir,
		].map(createGlobMatchOptions);
		logger.info(`Migrated exclusion rules.`);
	}

	// remove at 22 April 2026
	if ('language' in plugin.settings) {
		delete plugin.settings.language;
		changed = true;
		logger.info('Migrated user language settings.');
	}

	if (changed) void plugin.saveSettings();
}

function createGlobMatchOptions(expr: string) {
	return {
		expr,
		options: {
			caseSensitive: false,
		},
	} satisfies GlobMatchOptions;
}
