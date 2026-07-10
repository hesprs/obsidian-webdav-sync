import { expect, test } from 'bun:test';
import type { PluginSettings } from '~/settings';
import { buildV3PluginData } from '../src/migration/settings';

function numericToggle(value: number) {
	return { enabled: true, value };
}

function buildSettings(): PluginSettings {
	return {
		account: 'alice',
		confirmBeforeDeleteInAutoSync: false,
		confirmBeforeSync: true,
		conflictStrategy: 'keepRemote' as PluginSettings['conflictStrategy'],
		customHeaders: {
			Authorization: 'Bearer token',
			'X-Trace': 'trace-value',
		},
		encryption: { enabled: true, value: 'secret-ref' },
		exhaustiveRemoteTraversal: true,
		fastRealtimeSync: false,
		filterRules: { exclusionRules: [], inclusionRules: [] },
		maxSyncTaskConcurrency: numericToggle(4),
		maxThroughputConcurrency: numericToggle(6),
		maxWebDAVConcurrency: numericToggle(8),
		minWebDAVRequestInterval: numericToggle(2),
		neverShowV3Migration: true,
		realtimeSync: numericToggle(15),
		remoteDir: '/remote/base/',
		scheduledSync: numericToggle(30),
		serverUrl: 'https://dav.example.com///',
		showSyncStatusInNotificationOnMobile: true,
		skipLargeFiles: numericToggle(16),
		startupSync: numericToggle(45),
		token: 'token-value',
		unmergeableStrategy: 'skip' as PluginSettings['unmergeableStrategy'],
		useGitStyle: true,
		v3Exists: true,
	};
}

test('buildV3PluginData maps v2 settings into v3 payload', () => {
	const data = buildV3PluginData({
		locale: 'en',
		localeModuleNames: [],
		settings: buildSettings(),
	});

	expect(data).toStrictEqual({
		Encryption: { enabled: true, password: 'secret-ref' },
		WebDAV: {
			baseDirectory: 'remote/base/',
			depthInfinity: true,
			endpoint: 'https://dav.example.com///',
			password: 'token-value',
			username: 'alice',
		},
		asymmetricStorage: true,
		confirmDeleteInAutoSync: false,
		confirmTasksInSync: true,
		conflictResolver: 'keepRemote',
		customHeaders: [
			{ key: 'Authorization', type: 'plaintext', value: 'Bearer token' },
			{ key: 'X-Trace', type: 'plaintext', value: 'trace-value' },
		],
		decider: 'bidirectional',
		exclusionRules: [],
		inclusionRules: [],
		maxFileSize: { enabled: true, value: 16 },
		maxMemoryConsumption: { enabled: true, value: 100 * 1024 ** 2 },
		maxRequestConcurrency: { enabled: true, value: 8 },
		minRequestInterval: { enabled: true, value: 2 },
		moduleAutoUpdate: true,
		moduleSources: ['https://sync.consensia.cc/modules.json'],
		modules: { Encryption: true, WebDAV: true },
		noticeStatusOnMobile: true,
		realtimeSync: { enabled: true, value: 15 },
		realtimeSyncFastMode: false,
		remoteFs: 'webdav',
		scheduledSync: { enabled: true, value: 30 },
		startupSync: { enabled: true, value: 45 },
	});
	expect(data).not.toHaveProperty('Smart Merge');
});

test('buildV3PluginData includes Smart Merge only for diffMatchPatch', () => {
	const data = buildV3PluginData({
		locale: 'zh-TW',
		localeModuleNames: [' I18n British English ', 'I18n British English', 'I18n 繁體中文', ''],
		settings: {
			...buildSettings(),
			conflictStrategy: 'diffMatchPatch' as PluginSettings['conflictStrategy'],
			encryption: { enabled: false, value: 'secret-ref' },
			useGitStyle: true,
		},
	});

	expect(data.modules).toStrictEqual({
		'I18n British English': true,
		'I18n 繁體中文': true,
		'Smart Merge': true,
		WebDAV: true,
	});
	expect(data).toHaveProperty('Smart Merge', {
		conflictAEnd: '===',
		conflictAStart: '<<<<<<<',
		conflictBEnd: '>>>>>>>',
		conflictBStart: '===',
		deletionEnd: '</mark>',
		deletionStart: '<mark class="conflict deleted">',
	});
	expect(data.conflictResolver).toBe('smartMerge');
	expect(data).not.toHaveProperty('Encryption');
});

test('buildV3PluginData uses html markers when git style is disabled', () => {
	const data = buildV3PluginData({
		locale: 'en',
		localeModuleNames: [],
		settings: {
			...buildSettings(),
			conflictStrategy: 'diffMatchPatch' as PluginSettings['conflictStrategy'],
			encryption: { enabled: false, value: 'secret-ref' },
			useGitStyle: false,
		},
	});

	expect(data).toHaveProperty('Smart Merge', {
		conflictAEnd: '</mark>',
		conflictAStart: '<mark class="conflict ours">',
		conflictBEnd: '</mark>',
		conflictBStart: '<mark class="conflict theirs">',
		deletionEnd: '</mark>',
		deletionStart: '<mark class="conflict deleted">',
	});
	expect(data.modules).toStrictEqual({ 'Smart Merge': true, WebDAV: true });
	expect(data).not.toHaveProperty('Encryption');
});
