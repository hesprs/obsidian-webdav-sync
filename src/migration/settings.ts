import type { PluginSettings } from '~/settings';

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
	conflictStrategy: PluginSettings['conflictStrategy'];
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
	unmergeableStrategy: PluginSettings['unmergeableStrategy'];
	useGitStyle: boolean;
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

export function buildV3PluginData({
	settings,
	locale,
	localeModuleNames,
}: BuildV3PluginDataOptions): V3PluginData {
	void locale;

	const modules: V3ModuleToggleMap = { WebDAV: true };

	if (settings.encryption.enabled) modules.Encryption = true;
	for (const localeModuleName of new Set(
		localeModuleNames.map((moduleName) => moduleName.trim()).filter(Boolean),
	))
		modules[localeModuleName] = true;

	return {
		WebDAV: {
			baseDirectory: settings.remoteDir,
			depthInfinity: settings.exhaustiveRemoteTraversal,
			endpoint: settings.serverUrl,
			password: settings.token,
			username: settings.account,
		},
		asymmetricStorage: true,
		confirmDeleteInAutoSync: settings.confirmBeforeDeleteInAutoSync,
		confirmTasksInSync: settings.confirmBeforeSync,
		conflictStrategy: settings.conflictStrategy,
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
		unmergeableStrategy: settings.unmergeableStrategy,
		useGitStyle: settings.useGitStyle,
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
