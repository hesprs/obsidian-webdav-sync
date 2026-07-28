import type { PluginSettings } from '~/settings';
import { normalizeV3BaseDir } from './storage';

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
	modules: Record<string, object>;
	noticeStatusOnMobile: boolean;
	realtimeSync: PluginSettings['realtimeSync'];
	realtimeSyncFastMode: boolean;
	remoteFs: 'webdav';
	scheduledSync: PluginSettings['scheduledSync'];
	startupSync: PluginSettings['startupSync'];
};

export type BuildV3PluginDataOptions = {
	settings: PluginSettings;
};

const SMART_MERGE_CONFLICT_STRATEGY = 'diffMatchPatch' as PluginSettings['conflictStrategy'];

export function buildV3PluginData({ settings }: BuildV3PluginDataOptions): V3PluginData {
	const smartMergeEnabled = settings.conflictStrategy === SMART_MERGE_CONFLICT_STRATEGY;
	const conflictResolverMap = {
		diffMatchPatch: 'smartMerge',
		keepLocal: 'keepLocal',
		keepRemote: 'keepRemote',
		latestTimestamp: 'latestSurvive',
		skip: 'skip',
	} as const;

	const modules: Record<string, object> = {
		webdav: {
			baseDirectory: normalizeV3BaseDir(settings.remoteDir),
			chunkedUpload: false,
			depthInfinity: settings.exhaustiveRemoteTraversal,
			endpoint: settings.serverUrl,
			password: settings.token,
			username: settings.account,
		},
	};

	if (settings.encryption.enabled)
		modules.encryption = { enabled: true, password: settings.encryption.value };

	if (smartMergeEnabled)
		modules['smart-merge'] = {
			conflictAEnd: settings.useGitStyle ? '===' : '</mark>',
			conflictAStart: settings.useGitStyle ? '<<<<<<<' : '<mark class="conflict ours">',
			conflictBEnd: settings.useGitStyle ? '>>>>>>>' : '</mark>',
			conflictBStart: settings.useGitStyle ? '===' : '<mark class="conflict theirs">',
			deletionEnd: '</mark>',
			deletionStart: '<mark class="conflict deleted">',
		};

	return {
		asymmetricStorage: settings.encryption.enabled,
		confirmDeleteInAutoSync: settings.confirmBeforeDeleteInAutoSync,
		confirmTasksInSync: settings.confirmBeforeSync,
		conflictResolver: conflictResolverMap[settings.conflictStrategy],
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
	};
}
