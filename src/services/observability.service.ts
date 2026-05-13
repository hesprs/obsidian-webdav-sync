import type WebDAVSyncPlugin from '~';
import { Notice, Platform } from 'obsidian';
import type { SyncRunSnapshot, SyncRunStage, SyncRunWarning } from '~/events';
import type { BaseTask } from '~/sync/tasks/task.interface';
import SyncProgressModal from '~/components/SyncProgressModal';
import { syncRun } from '~/events';
import t from '~/i18n';
import formatRelativeTime from '~/utils/format-relative-time';

export const TERMINAL_STAGES: Array<SyncRunStage> = [
	'completed',
	'completed_noop',
	'cancelled',
	'failed',
];
const MOBILE_SYNC_NOTICE_HIDE_DELAY = 2000;

export default class ObservabilityService {
	private previousRun: SyncRunSnapshot | undefined;
	private readonly unsubscribe = syncRun.subscribe((run) => {
		if (!run) return;
		this.apply(run);
		this.previousRun = run;
	});
	private readonly syncStatusBar: HTMLElement;
	private lastSyncTime: number | undefined;
	private updateInterval: number | undefined;
	private baseStatusText = '';
	private mobileSyncNotice: Notice | undefined;
	private mobileSyncNoticeHideTimeout: number | undefined;
	private progressModal: SyncProgressModal | undefined;

	constructor(private readonly plugin: WebDAVSyncPlugin) {
		this.syncStatusBar = plugin.addStatusBarItem();
	}

	unload() {
		this.unsubscribe();
		this.progressModal?.close();
		this.stopTimeUpdates();
		this.hideMobileSyncNotice();
	}

	syncMobileNoticeWithSettings() {
		if (!this.shouldUseMobileSyncNotice()) this.hideMobileSyncNotice();
	}

	private setCurrentStatus(text: string): void {
		this.stopTimeUpdates();
		this.syncStatusBar.setText(text);
	}

	private setLastSuccessfulStatus(timestamp: number, text: string): void {
		this.lastSyncTime = timestamp;
		this.baseStatusText = text;

		this.updateStatusBarWithTime();
		this.stopTimeUpdates();
		this.updateInterval = window.setInterval(() => {
			this.updateStatusBarWithTime();
		}, 60_000);
	}

	private updateStatusBarWithTime(): void {
		if (!this.lastSyncTime) return;

		const now = Date.now();
		const diffSeconds = Math.floor((now - this.lastSyncTime) / 1000);

		// Don't show relative time if less than 60 seconds (just now)
		if (diffSeconds < 60) this.syncStatusBar.setText(this.baseStatusText);
		else {
			const relativeTime = formatRelativeTime(this.lastSyncTime);
			const statusText = `${this.baseStatusText} (${relativeTime})`;
			this.syncStatusBar.setText(statusText);
		}
	}

	private stopTimeUpdates(): void {
		if (this.updateInterval !== undefined) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = undefined;
		}
	}

	private apply(run: SyncRunSnapshot) {
		this.plugin.toggleSyncUI(!TERMINAL_STAGES.includes(run.stage));
		this.applyStatus(run);
		this.applyMobileSyncNotice(run);
		this.applyNotice(run, this.previousRun);
		this.applyProgressModal(run, this.previousRun);
	}

	private applyMobileSyncNotice(run: SyncRunSnapshot) {
		if (!this.shouldUseMobileSyncNotice()) {
			this.hideMobileSyncNotice();
			return;
		}

		this.clearMobileSyncNoticeHideTimeout();
		const text = this.getStatusText(run);

		if (this.mobileSyncNotice) this.mobileSyncNotice.setMessage(text);
		else this.mobileSyncNotice = new Notice(text, 0);

		if (TERMINAL_STAGES.includes(run.stage))
			this.mobileSyncNoticeHideTimeout = window.setTimeout(() => {
				this.hideMobileSyncNotice();
			}, MOBILE_SYNC_NOTICE_HIDE_DELAY);
	}

	private applyStatus(run: SyncRunSnapshot) {
		const text = this.getStatusText(run);
		if (
			(run.stage === 'completed' || run.stage === 'completed_noop') &&
			(run.resultSummary?.failedTasks ?? 0) === 0 &&
			run.timestamps.endedAt !== undefined
		) {
			this.setLastSuccessfulStatus(run.timestamps.endedAt, text);
			return;
		}

		this.setCurrentStatus(text);
	}

	private applyNotice(run: SyncRunSnapshot, previousRun?: SyncRunSnapshot) {
		const warning = this.getNewWarning(run, previousRun);
		if (warning) {
			new Notice(t(warning.messageKey), 5000);
			return;
		}

		if (this.shouldUseMobileSyncNotice()) return;

		const noticeText = this.getNoticeText(run, previousRun);
		if (noticeText) new Notice(noticeText);
	}

	private shouldUseMobileSyncNotice(): boolean {
		return Platform.isMobile && this.plugin.settings.showSyncStatusInNotificationOnMobile;
	}

	private clearMobileSyncNoticeHideTimeout(): void {
		if (this.mobileSyncNoticeHideTimeout !== undefined) {
			window.clearTimeout(this.mobileSyncNoticeHideTimeout);
			this.mobileSyncNoticeHideTimeout = undefined;
		}
	}

	private hideMobileSyncNotice(): void {
		this.clearMobileSyncNoticeHideTimeout();
		this.mobileSyncNotice?.hide();
		this.mobileSyncNotice = undefined;
	}

	private getStatusText(run: SyncRunSnapshot): string {
		const getText = (text: string) => `${t(`sync.runKind.${run.runKind}`)} · ${text}`;
		switch (run.stage) {
			case 'queued':
			case 'pre_connecting': {
				return getText(t('sync.preConnecting'));
			}
			case 'walking_remote': {
				const { totalItems, completedItems } = run.remoteWalkSummary ?? {};
				return getText(`${t('sync.walkingRemote')} (${completedItems}/${totalItems})`);
			}
			case 'awaiting_confirmation': {
				return getText(t('sync.awaitingConfirmation'));
			}
			case 'executing': {
				const { totalTasks, completedTasks } = run.progressSummary;
				const percent = Math.round((completedTasks / totalTasks || 1) * 10_000) / 100;
				return getText(t('sync.progress', { percent }));
			}
			case 'completed': {
				return run.resultSummary?.failedTasks
					? getText(
							t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							}),
						)
					: getText(t('sync.complete'));
			}
			case 'completed_noop': {
				return getText(
					t(run.trigger === 'manual' ? 'sync.alreadyUpToDate' : 'sync.upToDate'),
				);
			}
			case 'cancelled': {
				return getText(t('sync.cancelled'));
			}
			case 'failed': {
				return run.resultSummary?.failedTasks
					? getText(
							t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							}),
						)
					: getText(t('sync.failedStatus'));
			}
		}
	}

	private getNoticeText(run: SyncRunSnapshot, previousRun?: SyncRunSnapshot): string | undefined {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		if (!isNewStage) return;
		const ifManual = (text: string) => (run.trigger === 'manual' ? text : undefined);

		switch (run.stage) {
			case 'pre_connecting': {
				return ifManual(t('sync.preConnecting'));
			}
			case 'walking_remote': {
				return ifManual(t('sync.walkingRemote'));
			}
			case 'executing': {
				return ifManual(t('sync.syncingFiles'));
			}
			case 'completed': {
				return ifManual(
					run.resultSummary?.failedTasks
						? t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							})
						: t('sync.complete'),
				);
			}
			case 'completed_noop': {
				return ifManual(t('sync.alreadyUpToDate'));
			}
			case 'cancelled': {
				return ifManual(t('sync.cancelled'));
			}
			case 'failed': {
				return ifManual(
					run.resultSummary?.failedTasks
						? t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							})
						: t('sync.failedWithError', {
								error: run.errorSummary?.message ?? t('sync.failedStatus'),
							}),
				);
			}
			default: {
				return;
			}
		}
	}

	private getNewWarning(
		run: SyncRunSnapshot,
		previousRun?: SyncRunSnapshot,
	): SyncRunWarning | undefined {
		const currentWarnings = run.planSummary?.warnings ?? [];
		const previousWarnings =
			previousRun?.runId === run.runId ? (previousRun.planSummary?.warnings ?? []) : [];

		for (const warning of currentWarnings)
			if (!previousWarnings.some((item) => item.code === warning.code)) return warning;
	}

	private applyProgressModal(run: SyncRunSnapshot, previousRun?: SyncRunSnapshot) {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		const failed = run.stage === 'failed' && run.resultSummary?.failed?.length !== 0;
		if (((isNewStage && run.trigger === 'manual') || failed) && !this.progressModal)
			this.createProgressModal().open();
		this.progressModal?.update(run);
		if (failed) this.progressModal?.setFailedTasks(run.resultSummary?.failed ?? []);
	}

	showProgressModal() {
		if (!this.previousRun || TERMINAL_STAGES.includes(this.previousRun.stage)) {
			new Notice(t('sync.notSyncing'));
			return;
		}
		if (this.progressModal) this.progressModal.open();
		else this.createProgressModal().open();
	}

	createProgressModal() {
		this.progressModal = new SyncProgressModal(
			this.plugin,
			() => (this.progressModal = undefined),
		);
		return this.progressModal;
	}

	private ensureProgressModal(): { modal: SyncProgressModal; autoOpened: boolean } {
		if (this.progressModal) return { autoOpened: false, modal: this.progressModal };
		const modal = this.createProgressModal();
		modal.open();
		return { autoOpened: true, modal };
	}

	public confirmManualTasks(tasks: Array<BaseTask>): Promise<{
		confirmed: boolean;
		selectedTasks: Array<BaseTask>;
	}> {
		const { modal, autoOpened } = this.ensureProgressModal();
		return new Promise((resolve) => {
			const finish = (confirmed: boolean) => {
				const selectedTasks = confirmed ? modal.getSelectedTasks() : [];
				if (confirmed && autoOpened) this.progressModal?.close();
				resolve({ confirmed, selectedTasks });
			};

			modal.showTaskConfirmation(tasks, {
				onCancel: () => finish(false),
				onConfirm: () => finish(true),
			});
		});
	}
}
