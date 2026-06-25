import type { App, Command, IconName } from 'obsidian';
import type { Ref } from 'synthkernel';
import { Notice, Platform } from 'obsidian';
import { computed, ref } from 'synthkernel';
import type { Progress } from '~/fs';
import { formatTime } from '~/utils/unit-converter';
import type { Dispatch, On } from './EventBus';
import type { Translate } from './I18n';
import type { SyncTrigger, TaskInfo } from './Sync';
import { toErrorMessage } from './Sync';

export type SyncStage =
	| 'none'
	| 'walkingRemote'
	| 'awaitingConfirmation'
	| 'executing'
	| 'completed'
	| 'completedNoop'
	| 'cancelled'
	| 'failed';

const MOBILE_SYNC_NOTICE_HIDE_DELAY = 2000;

export type AddRibbonIcon = (
	icon: IconName,
	title: string,
	callback: (evt: MouseEvent) => void,
) => HTMLElement;

export default class Observability {
	private lastSyncTime = 0;
	private readonly sinceLastSyncText = ref('');
	private readonly syncStage = ref<SyncStage>('none');
	private readonly walkProgress = ref<Progress>({ completed: 0, total: 1 });
	private readonly executionProgress = ref<Progress<TaskInfo>>({ completed: 0, total: 0 });
	private readonly cleanupCallbacks: Array<() => void> = [];
	private readonly t: Translate;
	private startIcon?: HTMLElement;
	private stopIcon?: HTMLElement;
	private readonly progressText = computed(
		() => {
			const stage = this.syncStage();
			if (stage === 'walkingRemote') {
				const { completed, total } = this.walkProgress();
				return `${this.t('walkingRemote')} ${completed}/${total}`;
			} else if (stage === 'awaitingConfirmation') return this.t('awaitingConfirmation');
			else if (stage === 'executing') {
				const { completed, total } = this.executionProgress();
				return `${this.t('executing')} ${roundPercent(completed, total)}%`;
			} else if (stage === 'cancelled') return this.t('cancelled');
			else if (stage === 'completed')
				return `${this.t('completed')}${this.sinceLastSyncText()}`;
			else if (stage === 'completedNoop')
				return `${this.t('completedNoop')}${this.sinceLastSyncText()}`;
			else if (stage === 'failed') return this.t('failed');
			else return '';
		},
		{
			deps: [
				this.syncStage,
				this.walkProgress,
				this.executionProgress,
				this.sinceLastSyncText,
			],
		},
	);

	declare readonly settings: { noticeStatusOnMobile: boolean };
	declare readonly i18n: {
		executing: string;
		walkingRemote: string;
		awaitingConfirmation: string;
		completed: string;
		completedNoop: string;
		cancelled: string;
		failed: string;
		startSync: string;
		startNonInteractiveSync: string;
		stopSync: string;
		showProgress: string;
		exportLogs: string;
		exportLogsFailed: string;
	};

	constructor(
		private readonly ctx: {
			addStatusBarItem: () => HTMLElement;
			on: On;
			translate: Translate;
			isIdle: Ref<boolean>;
			dispatch: Dispatch;
			requestSync: (trigger: SyncTrigger) => Promise<void>;
			showProgress: () => void;
			addCommand: (command: Command) => Command;
			addRibbonIcon: AddRibbonIcon;
			getLogs: () => string;
			app: App;
		},
	) {
		let totalSyncTasks = 0;
		let completedTasks = 0;
		let updateInterval: number | undefined;
		let noticeTimeout: number | undefined;
		let mobileSyncNotice: Notice | undefined;
		const status = ctx.addStatusBarItem();
		this.t = ctx.translate;

		this.cleanupCallbacks.push(
			ctx.on('syncStarted', () => {
				this.syncStage('walkingRemote');
				window.clearInterval(updateInterval);
				this.sinceLastSyncText('');
				if (this.settings.noticeStatusOnMobile && Platform.isMobile)
					mobileSyncNotice = new Notice(this.progressText());
			}),
			ctx.on('requestConfirmDelete', () => this.syncStage('awaitingConfirmation')),
			ctx.on('requestConfirmTasks', () => this.syncStage('awaitingConfirmation')),
			ctx.on('executionStarted', (tasks) => {
				totalSyncTasks = tasks.length;
				completedTasks = 0;
				this.syncStage('executing');
			}),
			ctx.on('remoteWalkProgress', (progress) => this.walkProgress(progress)),
			ctx.on('taskCompleted', (current) => {
				completedTasks += 1;
				this.executionProgress({
					completed: completedTasks,
					current,
					total: totalSyncTasks,
				});
			}),
			ctx.on('syncTerminate', (reason) => {
				const { result } = reason;
				if (mobileSyncNotice)
					if (result === 'failed') {
						mobileSyncNotice.hide();
						mobileSyncNotice = undefined;
					} else
						noticeTimeout = window.setTimeout(() => {
							mobileSyncNotice?.hide();
							mobileSyncNotice = undefined;
						}, MOBILE_SYNC_NOTICE_HIDE_DELAY);
				this.lastSyncTime = Date.now();
				const setUpdateInterval = () =>
					(updateInterval = window.setInterval(() => {
						const sinceNow = Date.now() - this.lastSyncTime;
						const time = formatTime(sinceNow).replace(' ', '');
						this.sinceLastSyncText(` ${time} ago`);
					}, 60_000));
				if (result === 'cancelled') this.syncStage('cancelled');
				else if (result === 'completed') {
					this.syncStage('completed');
					setUpdateInterval();
				} else if (result === 'noop') {
					this.syncStage('completedNoop');
					setUpdateInterval();
				} else if (result === 'failed') {
					this.syncStage('failed');
					new Notice(`${this.t('failed')}: ${reason.error}`);
				}
			}),
			this.progressText.subscribe((text) => {
				status.setText(text);
				mobileSyncNotice?.setMessage(text);
			}),
			this.ctx.isIdle.subscribe(
				(idle) => {
					if (idle) {
						this.startIcon?.removeAttribute('aria-disabled');
						this.startIcon?.removeClass('webdav-sync-spinning');
						this.stopIcon?.classList.add('hidden');
					} else {
						this.startIcon?.setAttr('aria-disabled', 'true');
						this.startIcon?.addClass('webdav-sync-spinning');
						this.stopIcon?.classList.remove('hidden');
					}
				},
				{ immediate: true },
			),
			() => {
				window.clearInterval(updateInterval);
				window.clearTimeout(noticeTimeout);
				mobileSyncNotice = undefined;
			},
		);
	}

	readonly start = () => {
		this.setupCommands();
		this.startIcon = this.ctx.addRibbonIcon('refresh-ccw', this.t('startSync'), () =>
			this.ctx.requestSync('manual'),
		);
		this.stopIcon = this.ctx.addRibbonIcon('square', this.t('stopSync'), () =>
			this.ctx.dispatch('syncCanceled'),
		);
	};

	private readonly setupCommands = () =>
		[
			{
				checkCallback: (checking: boolean) => {
					if (checking) {
						if (!this.ctx.isIdle()) return false;
						return true;
					}
					void this.ctx.requestSync('manual');
				},
				icon: 'refresh-ccw',
				id: 'start-sync',
				name: this.t('startSync'),
			},
			{
				checkCallback: (checking: boolean) => {
					if (checking) {
						if (!this.ctx.isIdle()) return false;
						return true;
					}
					void this.ctx.requestSync('nonInteractiveManual');
				},
				icon: 'refresh-ccw-dot',
				id: 'start-non-interactive-sync',
				name: this.t('startNonInteractiveSync'),
			},
			{
				checkCallback: (checking: boolean) => {
					if (checking) {
						if (this.ctx.isIdle()) return false;
						return true;
					}
					this.ctx.dispatch('syncCanceled');
				},
				icon: 'x-circle',
				id: 'stop-sync',
				name: this.t('stopSync'),
			},
			{
				checkCallback: (checking: boolean) => {
					if (checking) {
						if (this.ctx.isIdle()) return false;
						return true;
					}
					this.ctx.showProgress();
				},
				icon: 'activity',
				id: 'show-progress',
				name: this.t('showProgress'),
			},
			{
				callback: () => {
					try {
						void exportLogs(this.ctx.getLogs(), this.ctx.app);
					} catch (error) {
						const message = toErrorMessage(error);
						new Notice(this.t('exportLogsFailed', { message }));
						this.ctx.dispatch('log', `Export log failed: \`${message}\`.`);
					}
				},
				icon: 'scroll-text',
				id: 'export-logs',
				name: this.t('exportLogs'),
			},
		].forEach((command) => this.ctx.addCommand(command));

	readonly dispose = () => {
		for (const unsub of this.cleanupCallbacks) unsub();
		this.progressText.dispose();
		this.stopIcon = undefined;
		this.startIcon = undefined;
	};

	root = {
		executionProgress: this.executionProgress,
		syncStage: this.syncStage,
		walkProgress: this.walkProgress,
	};
}

export function roundPercent(completed: number, total: number) {
	return Math.round((completed / total || 1) * 10_000) / 100;
}

async function exportLogs(log: string, app: App) {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const fileName = `${timestamp}.md`;
	const dirPath = 'Sync Engine Logs';
	const filePath = `${dirPath}/${fileName}`;
	const folderExists = app.vault.getFolderByPath(dirPath);
	if (!folderExists) await app.vault.createFolder(dirPath);
	const file = await app.vault.create(filePath, log);
	await app.workspace.getLeaf().openFile(file);
}
