import type { Command, IconName } from 'obsidian';
import type { Ref } from 'synthkernel';
import { Notice } from 'obsidian';
import { computed, ref } from 'synthkernel';
import type { Progress } from '~/fs';
import { formatTime } from '~/utils/unit-converter';
import type { Dispatch, On } from './EventBus';
import type { Translate } from './I18n';
import type { SyncTrigger, TaskInfo } from './Sync';

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
		stopSync: string;
		showProgress: string;
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
			addCommand: (command: Command) => void;
			addRibbonIcon: AddRibbonIcon;
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
				if (this.settings.noticeStatusOnMobile)
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
			ctx.on('syncTerminate', ({ result }) => {
				if (mobileSyncNotice)
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
				} else if (result === 'failed') this.syncStage('failed');
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
				icon: 'refresh-cw',
				id: 'start-sync',
				name: this.t('startSync'),
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

export const roundPercent = (completed: number, total: number) =>
	Math.round((completed / total || 1) * 10_000) / 100;
