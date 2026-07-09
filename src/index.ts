import './global.css';
import { Plugin } from 'obsidian';
import type { PluginSettings, GlobMatchOptions } from './settings';
import type { SyncEncryptionContext } from './utils/encryption';
import SyncRibbonManager from './components/SyncRibbonManager';
import { syncCancel } from './events';
import V3MigrationService from './migration';
import { normalizeBaseDir } from './platform/path';
import setupCommands from './services/command.setup';
import ObservabilityService from './services/observability.service';
import SyncExecutorService from './services/sync-executor.service';
import SyncSchedulerService from './services/sync-scheduler.service';
import { WebDAVService } from './services/webdav.service';
import {
	SyncSettingTab,
	setPluginInstance,
	ConflictStrategy,
	UnmergeableStrategy,
} from './settings';
import {
	IndexedDbBaseTextStore,
	IndexedDbFileChunkStore,
	IndexedDbSyncStateStore,
} from './storage';
import { createSyncEncryptionContext } from './utils/encryption';
import getCredential from './utils/get-credential';
import patchWebDav from './webdav-patch';

function createGlobMatchOptions(expr: string) {
	return {
		expr,
		options: {
			caseSensitive: false,
		},
	} satisfies GlobMatchOptions;
}

export default class WebDAVSyncPlugin extends Plugin {
	public isSyncing = false;
	public isV3MigrationRunning = false;
	public v3MigrationService!: V3MigrationService;
	private syncEncryptionContext: SyncEncryptionContext | undefined;
	public settings: PluginSettings = {
		account: '',
		confirmBeforeDeleteInAutoSync: true,
		confirmBeforeSync: true,
		conflictStrategy: ConflictStrategy.DiffMatchPatch,
		customHeaders: {},
		encryption: {
			enabled: false,
			value: '',
		},
		exhaustiveRemoteTraversal: false,
		fastRealtimeSync: true,
		filterRules: {
			exclusionRules: [
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
				this.app.vault.configDir,
			].map(createGlobMatchOptions),
			inclusionRules: [],
		},
		maxSyncTaskConcurrency: {
			enabled: true,
			value: 100,
		},
		maxThroughputConcurrency: {
			enabled: true,
			value: 52_428_800,
		},
		maxWebDAVConcurrency: {
			enabled: true,
			value: 100,
		},
		minWebDAVRequestInterval: {
			enabled: false,
			value: 0,
		},
		neverShowV3Migration: false,
		realtimeSync: {
			enabled: false,
			value: 5000,
		},
		remoteDir: normalizeBaseDir(this.app.vault.getName()),
		scheduledSync: {
			enabled: false,
			value: 6000,
		},
		serverUrl: '',
		showSyncStatusInNotificationOnMobile: true,
		skipLargeFiles: {
			enabled: false,
			value: 31_457_280,
		},
		startupSync: {
			enabled: false,
			value: 0,
		},
		token: '',
		unmergeableStrategy: UnmergeableStrategy.LatestTimeStamp,
		useGitStyle: false,
		v3Exists: false,
	};

	public syncStateStore = new IndexedDbSyncStateStore();
	public baseTextStore = new IndexedDbBaseTextStore();
	public fileChunkStore = new IndexedDbFileChunkStore();
	public observabilityService = new ObservabilityService(this);
	public webDAVService = new WebDAVService(this);
	public syncExecutorService = new SyncExecutorService(this);
	public syncSchedulerService = new SyncSchedulerService(this, this.syncExecutorService);
	public ribbonManager = new SyncRibbonManager(this);

	async onload() {
		Object.assign(this.settings, await this.loadData());
		await this.syncStateStore.initialize();
		await this.baseTextStore.initialize();
		await this.fileChunkStore.initialize();
		this.addSettingTab(new SyncSettingTab(this.app, this));
		setPluginInstance(this);
		setupCommands(this);
		this.syncSchedulerService.start();
		patchWebDav();
		this.v3MigrationService = new V3MigrationService(this);
		this.v3MigrationService.checkAndPromptOnStartup();
	}

	onunload() {
		this.v3MigrationService?.dispose();
		setPluginInstance(this);
		void this.syncStateStore.unload();
		void this.baseTextStore.unload();
		void this.fileChunkStore.unload();
		syncCancel();
		this.syncSchedulerService.unload();
		this.observabilityService.unload();
	}

	saveSettings = async () => await this.saveData(this.settings);

	toggleSyncUI(isSyncing: boolean) {
		this.isSyncing = isSyncing;
		this.ribbonManager.update();
	}

	getToken() {
		const token = `${this.settings.account}:${getCredential(this)}`;
		return btoa(token);
	}

	prepareSyncEncryptionKeys() {
		this.syncEncryptionContext = undefined;
	}

	getSyncEncryptionKeys() {
		return this.getSyncEncryptionContext().keysPromise;
	}

	getSyncEncryptionContext() {
		this.syncEncryptionContext ??= createSyncEncryptionContext(
			this.settings,
			this.app.secretStorage,
		);
		return this.syncEncryptionContext;
	}

	clearSyncEncryptionKeys() {
		this.syncEncryptionContext = undefined;
	}

	/**
	 * 检查账号配置是否完整
	 * @returns true 表示配置完整，false 表示未配置或配置不完整
	 */
	isAccountConfigured(): boolean {
		return (
			Boolean(this.settings.serverUrl) &&
			this.settings.serverUrl.trim() !== '' &&
			Boolean(this.settings.account) &&
			this.settings.account.trim() !== '' &&
			Boolean(this.settings.token) &&
			this.settings.token.trim() !== '' &&
			Boolean(this.app.secretStorage.getSecret(this.settings.token))
		);
	}
}
