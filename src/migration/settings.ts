import type { PluginSettings } from '~/settings';
import { normalizeV3BaseDir } from './storage';

export type V3ModuleToggleMap = Record<string, boolean>;

export type V3CustomHeader = {
	key: string;
	value: string;
	type: 'plaintext';
};

export type V3PluginData = {
	asymmetricStorage: boolean;
	confirmDeleteInAutoSync: boolean;
	confirmTasksInSync: boolean;
	conflictResolver: 'smartMerge' | 'latestSurvive' | 'keepLocal' | 'keepRemote' | 'skip';
	customHeaders: Array<V3CustomHeader>;
	decider: 'bidirectional';
	exclusionRules: PluginSettings['filterRules']['exclusionRules'];
	inclusionRules: PluginSettings['filterRules']['inclusionRules'];
	maxFileSize: PluginSettings['skipLargeFiles'];
	maxMemoryConsumption: { enabled: boolean; value: number };
	maxRequestConcurrency: PluginSettings['maxWebDAVConcurrency'];
	minRequestInterval: PluginSettings['minWebDAVRequestInterval'];
	moduleAutoUpdate: boolean;
	moduleSources: Array<string>;
	modules: V3ModuleToggleMap;
	noticeStatusOnMobile: boolean;
	realtimeSync: PluginSettings['realtimeSync'];
	realtimeSyncFastMode: boolean;
	remoteFs: 'webdav';
	scheduledSync: PluginSettings['scheduledSync'];
	startupSync: PluginSettings['startupSync'];
	'Smart Merge'?: {
		conflictAEnd: string;
		conflictAStart: string;
		conflictBEnd: string;
		conflictBStart: string;
		deletionEnd: string;
		deletionStart: string;
	};
	WebDAV: {
		baseDirectory: string;
		depthInfinity: boolean;
		endpoint: string;
		password: string;
		username: string;
	};
	Encryption?: {
		enabled: boolean;
		password: string;
	};
};

export type BuildV3PluginDataOptions = {
	settings: PluginSettings;
	locale: string;
	localeModuleNames: Array<string>;
};

const SMART_MERGE_CONFLICT_STRATEGY = 'diffMatchPatch' as PluginSettings['conflictStrategy'];

export function buildV3PluginData({
	settings,
	locale,
	localeModuleNames,
}: BuildV3PluginDataOptions): V3PluginData {
	void locale;

	const modules: V3ModuleToggleMap = { WebDAV: true };
	const smartMergeEnabled = settings.conflictStrategy === SMART_MERGE_CONFLICT_STRATEGY;
	const conflictResolverMap = {
		diffMatchPatch: 'smartMerge',
		keepLocal: 'keepLocal',
		keepRemote: 'keepRemote',
		latestTimestamp: 'latestSurvive',
		skip: 'skip',
	} as const;

	if (settings.encryption.enabled) modules.Encryption = true;
	for (const localeModuleName of new Set(
		localeModuleNames.map((moduleName) => moduleName.trim()).filter(Boolean),
	))
		modules[localeModuleName] = true;
	if (smartMergeEnabled) modules['Smart Merge'] = true;

	const conflictResolver = conflictResolverMap[settings.conflictStrategy];

	return {
		WebDAV: {
			baseDirectory: normalizeV3BaseDir(settings.remoteDir),
			depthInfinity: settings.exhaustiveRemoteTraversal,
			endpoint: settings.serverUrl,
			password: settings.token,
			username: settings.account,
		},
		asymmetricStorage: settings.encryption.enabled, // Encrypted users will be prompted to re-upload the entire vault, remote compatibility is not in consideration, so this can keep enabled
		confirmDeleteInAutoSync: settings.confirmBeforeDeleteInAutoSync,
		confirmTasksInSync: settings.confirmBeforeSync,
		conflictResolver,
		customHeaders: Object.entries(settings.customHeaders).map(([key, value]) => ({
			key,
			type: 'plaintext',
			value,
		})),
		decider: 'bidirectional',
		exclusionRules: settings.filterRules.exclusionRules,
		inclusionRules: settings.filterRules.inclusionRules,
		maxFileSize: settings.skipLargeFiles,
		maxMemoryConsumption: { enabled: true, value: 100 * 1024 ** 2 },
		maxRequestConcurrency: settings.maxWebDAVConcurrency,
		minRequestInterval: settings.minWebDAVRequestInterval,
		moduleAutoUpdate: true,
		moduleSources: ['https://sync.consensia.cc/modules.json'],
		modules,
		noticeStatusOnMobile: settings.showSyncStatusInNotificationOnMobile,
		realtimeSync: settings.realtimeSync,
		realtimeSyncFastMode: settings.fastRealtimeSync,
		remoteFs: 'webdav',
		scheduledSync: settings.scheduledSync,
		startupSync: settings.startupSync,
		...(smartMergeEnabled
			? {
					'Smart Merge': {
						conflictAEnd: settings.useGitStyle ? '===' : '</mark>',
						conflictAStart: settings.useGitStyle
							? '<<<<<<<'
							: '<mark class="conflict ours">',
						conflictBEnd: settings.useGitStyle ? '>>>>>>>' : '</mark>',
						conflictBStart: settings.useGitStyle
							? '==='
							: '<mark class="conflict theirs">',
						deletionEnd: '</mark>',
						deletionStart: '<mark class="conflict deleted">',
					},
				}
			: {}),
		...(settings.encryption.enabled
			? {
					Encryption: {
						enabled: true,
						password: settings.encryption.value,
					},
				}
			: {}),
	};
}
