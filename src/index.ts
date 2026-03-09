import 'blob-polyfill';
import 'core-js/stable';
import './webdav-patch';
import './assets/global.css';
import { toBase64 } from 'js-base64';
import { normalizePath, Plugin } from 'obsidian';
import type { GlobMatchOptions } from './utils/glob-match';
import { SyncRibbonManager } from './components/SyncRibbonManager';
import { emitCancelSync } from './events';
import CommandService from './services/command.service';
import EventsService from './services/events.service';
import I18nService from './services/i18n.service';
import LoggerService from './services/logger.service';
import { ProgressService } from './services/progress.service';
import RealtimeSyncService from './services/realtime-sync.service';
import ScheduledSyncService from './services/scheduled-sync.service';
import { StatusService } from './services/status.service';
import SyncExecutorService from './services/sync-executor.service';
import { WebDAVService } from './services/webdav.service';
import { type PluginSettings, SyncSettingTab, setPluginInstance, SyncMode } from './settings';
import { ConflictStrategy } from './sync/tasks/conflict-resolve.task';
import { stdRemotePath } from './utils/std-remote-path';

function createGlobMathOptions(expr: string) {
	return {
		expr,
		options: {
			caseSensitive: false,
		},
	} satisfies GlobMatchOptions;
}

export default class WebDAVSyncPlugin extends Plugin {
	public isSyncing: boolean = false;
	public settings: PluginSettings = {
		serverUrl: '',
		account: '',
		credential: '',
		remoteDir: '',
		remoteCacheDir: '',
		useGitStyle: false,
		conflictStrategy: ConflictStrategy.DiffMatchPatch,
		confirmBeforeSync: true,
		confirmBeforeDeleteInAutoSync: true,
		syncMode: SyncMode.LOOSE,
		filterRules: {
			exclusionRules: ['**/.git', '**/.DS_Store', '**/.trash', this.app.vault.configDir].map(
				createGlobMathOptions,
			),
			inclusionRules: [],
		},
		skipLargeFiles: {
			maxSize: '30 MB',
		},
		realtimeSync: false,
		startupSyncDelaySeconds: 0,
		autoSyncIntervalSeconds: 300,
		language: undefined,
	};

	public commandService = new CommandService(this);
	public eventsService = new EventsService(this);
	public i18nService = new I18nService(this);
	public loggerService = new LoggerService(this);
	public progressService = new ProgressService(this);
	public ribbonManager = new SyncRibbonManager(this);
	public statusService = new StatusService(this);
	public webDAVService = new WebDAVService(this);
	public syncExecutorService = new SyncExecutorService(this);
	public realtimeSyncService = new RealtimeSyncService(this, this.syncExecutorService);
	public scheduledSyncService = new ScheduledSyncService(this, this.syncExecutorService);

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SyncSettingTab(this.app, this));
		setPluginInstance(this);

		await this.scheduledSyncService.start();
	}

	async onunload() {
		setPluginInstance(null);
		emitCancelSync();
		this.scheduledSyncService.unload();
		this.progressService.unload();
		this.eventsService.unload();
		this.realtimeSyncService.unload();
		this.statusService.unload();
	}

	async loadSettings() {
		Object.assign(this.settings, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	toggleSyncUI(isSyncing: boolean) {
		this.isSyncing = isSyncing;
		this.ribbonManager.update();
	}

	async getToken() {
		const token = `${this.settings.account}:${this.settings.credential}`;
		return toBase64(token);
	}

	/**
	 * 检查账号配置是否完整
	 * @returns true 表示配置完整，false 表示未配置或配置不完整
	 */
	isAccountConfigured(): boolean {
		return (
			!!this.settings.serverUrl &&
			this.settings.serverUrl.trim() !== '' &&
			!!this.settings.account &&
			this.settings.account.trim() !== '' &&
			!!this.settings.credential &&
			this.settings.credential.trim() !== ''
		);
	}

	get remoteBaseDir() {
		let remoteDir = normalizePath(this.settings.remoteDir.trim());
		if (remoteDir === '' || remoteDir === '/') {
			remoteDir = this.app.vault.getName();
		}
		return stdRemotePath(remoteDir);
	}
}
