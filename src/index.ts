import './assets/global.css';
import { Plugin } from 'obsidian';
import type { PluginSettings, GlobMatchOptions } from './settings';
import SyncRibbonManager from './components/SyncRibbonManager';
import { syncCancel } from './events';
import { normalizeBaseDir } from './platform/path';
import setupCommands from './services/command.setup';
import ObservabilityService from './services/observability.service';
import RealtimeSyncService from './services/realtime-sync.service';
import ScheduledSyncService from './services/scheduled-sync.service';
import SyncExecutorService from './services/sync-executor.service';
import SyncSchedulerService from './services/sync-scheduler.service';
import { WebDAVService } from './services/webdav.service';
import {
	SyncSettingTab,
	setPluginInstance,
	ConflictStrategy,
	UnmergeableStrategy,
} from './settings';
import processSettings from './settings/process';
import {
	IndexedDbBaseTextStore,
	IndexedDbFileChunkStore,
	IndexedDbSyncStateStore,
} from './storage';
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
	public settings: PluginSettings = {
		account: '',
		confirmBeforeDeleteInAutoSync: true,
		confirmBeforeSync: true,
		conflictStrategy: ConflictStrategy.DiffMatchPatch,
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
		realtimeSync: {
			enabled: false,
			value: 5000,
		},
		remoteDir: normalizeBaseDir(this.app.vault.getName()),
		scheduledSync: {
			enabled: false,
			value: 600,
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
	};

	public syncStateStore = new IndexedDbSyncStateStore();
	public baseTextStore = new IndexedDbBaseTextStore();
	public fileChunkStore = new IndexedDbFileChunkStore();
	public observabilityService = new ObservabilityService(this);
	public webDAVService = new WebDAVService(this);
	public syncExecutorService = new SyncExecutorService(this);
	public syncSchedulerService = new SyncSchedulerService(this, this.syncExecutorService);
	public ribbonManager = new SyncRibbonManager(this);
	public realtimeSyncService = new RealtimeSyncService(this, this.syncSchedulerService);
	public scheduledSyncService = new ScheduledSyncService(this, this.syncSchedulerService);

	async onload() {
		await this.loadSettings();
		await this.syncStateStore.initialize();
		await this.baseTextStore.initialize();
		await this.fileChunkStore.initialize();
		this.addSettingTab(new SyncSettingTab(this.app, this));
		setPluginInstance(this);
		setupCommands(this);
		this.scheduledSyncService.start();
		patchWebDav();
	}

	onunload() {
		setPluginInstance();
		void this.syncStateStore.unload();
		void this.baseTextStore.unload();
		void this.fileChunkStore.unload();
		syncCancel();
		this.scheduledSyncService.unload();
		this.syncSchedulerService.unload();
		this.observabilityService.unload();
	}

	async loadSettings() {
		Object.assign(this.settings, await this.loadData());
		processSettings(this);
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
