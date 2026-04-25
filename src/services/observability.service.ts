import type WebDAVSyncPlugin from '~';
import { Notice, Platform } from 'obsidian';
import type { BaseTask } from '~/sync/tasks/task.interface';
import FailedTasksModal from '~/components/FailedTasksModal';
import SyncProgressModal from '~/components/SyncProgressModal';
import { syncRun, type SyncRunSnapshot, type SyncRunStage, type SyncRunWarning } from '~/events';
import t from '~/i18n';
import { formatRelativeTime } from '~/utils/format-relative-time';

export const TERMINAL_STAGES: SyncRunStage[] = [
	'completed',
	'completed_noop',
	'cancelled',
	'failed',
];
const MOBILE_SYNC_NOTICE_HIDE_DELAY = 2000;

export default class ObservabilityService {
	private previousRun: SyncRunSnapshot | null = null;
	private shownFailureModalRunIds = new Set<string>();
	private unsubscribe = syncRun.subscribe((run) => {
		if (!run) return;
		this.apply(run);
		this.previousRun = run;
	});
	private syncStatusBar: HTMLElement;
	private lastSyncTime: number | null = null;
	private updateInterval: number | null = null;
	private baseStatusText: string = '';
	private mobileSyncNotice: Notice | null = null;
	private mobileSyncNoticeHideTimeout: number | null = null;
	private progressModal: SyncProgressModal | null = null;

	constructor(private plugin: WebDAVSyncPlugin) {
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
		}, 60000);
	}

	private updateStatusBarWithTime(): void {
		if (this.lastSyncTime === null) return;

		const now = Date.now();
		const diffSeconds = Math.floor((now - this.lastSyncTime) / 1000);

		// Don't show relative time if less than 60 seconds (just now)
		if (diffSeconds < 60) {
			this.syncStatusBar.setText(this.baseStatusText);
		} else {
			const relativeTime = formatRelativeTime(this.lastSyncTime);
			const statusText = `${this.baseStatusText} (${relativeTime})`;
			this.syncStatusBar.setText(statusText);
		}
	}

	private stopTimeUpdates(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	private apply(run: SyncRunSnapshot) {
		this.plugin.toggleSyncUI(!TERMINAL_STAGES.includes(run.stage));
		this.applyStatus(run);
		this.applyMobileSyncNotice(run);
		this.applyNotice(run, this.previousRun);
		this.applyProgressModal(run, this.previousRun);
		this.applyFailureModal(run);
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

		if (TERMINAL_STAGES.includes(run.stage)) {
			this.mobileSyncNoticeHideTimeout = window.setTimeout(() => {
				this.hideMobileSyncNotice();
			}, MOBILE_SYNC_NOTICE_HIDE_DELAY);
		}
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

	private applyNotice(run: SyncRunSnapshot, previousRun: SyncRunSnapshot | null) {
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
		if (this.mobileSyncNoticeHideTimeout !== null) {
			window.clearTimeout(this.mobileSyncNoticeHideTimeout);
			this.mobileSyncNoticeHideTimeout = null;
		}
	}

	private hideMobileSyncNotice(): void {
		this.clearMobileSyncNoticeHideTimeout();
		this.mobileSyncNotice?.hide();
		this.mobileSyncNotice = null;
	}

	private applyFailureModal(run: SyncRunSnapshot) {
		if (
			run.mode !== 'manual' ||
			run.stage !== 'failed' ||
			run.resultSummary === undefined ||
			run.resultSummary.failed.length === 0 ||
			this.shownFailureModalRunIds.has(run.runId)
		) {
			return;
		}

		this.shownFailureModalRunIds.add(run.runId);
		new FailedTasksModal(this.plugin.app, run.resultSummary.failed, {
			syncType: t(`sync.runKind.${run.runKind}`),
			failedCount: run.resultSummary.failedTasks,
		}).open();
	}

	private getStatusText(run: SyncRunSnapshot): string {
		const getText = (text: string) => `${t(`sync.runKind.${run.runKind}`)} · ${text}`;
		switch (run.stage) {
			case 'queued':
			case 'pre_connecting':
				return getText(t('sync.preConnecting'));
			case 'walking_remote': {
				const { totalItems, completedItems } = run.remoteWalkSummary ?? {};
				return getText(`${t('sync.walkingRemote')} (${completedItems}/${totalItems})`);
			}
			case 'awaiting_confirmation':
				return getText(t('sync.awaitingConfirmation'));
			case 'executing': {
				const { totalTasks, completedTasks } = run.progressSummary;
				const percent = Math.round((completedTasks / totalTasks || 1) * 10000) / 100;
				return getText(t('sync.progress', { percent }));
			}
			case 'completed':
				return run.resultSummary?.failedTasks
					? getText(
							t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							}),
						)
					: getText(t('sync.complete'));
			case 'completed_noop':
				return getText(t(run.mode === 'manual' ? 'sync.alreadyUpToDate' : 'sync.upToDate'));
			case 'cancelled':
				return getText(t('sync.cancelled'));
			case 'failed':
				return run.resultSummary?.failedTasks
					? getText(
							t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							}),
						)
					: getText(t('sync.failedStatus'));
		}
	}

	private getNoticeText(
		run: SyncRunSnapshot,
		previousRun: SyncRunSnapshot | null,
	): string | null {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		if (!isNewStage) return null;
		const ifManual = (text: string) => (run.mode === 'manual' ? text : null);

		switch (run.stage) {
			case 'pre_connecting':
				return ifManual(t('sync.preConnecting'));
			case 'walking_remote':
				return ifManual(t('sync.walkingRemote'));
			case 'executing':
				return ifManual(t('sync.syncingFiles'));
			case 'completed':
				return ifManual(
					run.resultSummary?.failedTasks
						? t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							})
						: t('sync.complete'),
				);
			case 'completed_noop':
				return ifManual(t('sync.alreadyUpToDate'));
			case 'cancelled':
				return ifManual(t('sync.cancelled'));
			case 'failed':
				return ifManual(
					run.resultSummary?.failedTasks
						? t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							})
						: t('sync.failedWithError', {
								error: run.errorSummary?.message ?? t('sync.failedStatus'),
							}),
				);
			default:
				return null;
		}
	}

	private getNewWarning(
		run: SyncRunSnapshot,
		previousRun: SyncRunSnapshot | null,
	): SyncRunWarning | null {
		const currentWarnings = run.planSummary?.warnings ?? [];
		const previousWarnings =
			previousRun?.runId === run.runId ? (previousRun.planSummary?.warnings ?? []) : [];

		for (const warning of currentWarnings) {
			if (!previousWarnings.some((item) => item.code === warning.code)) return warning;
		}
		return null;
	}

	private applyProgressModal(run: SyncRunSnapshot, previousRun: SyncRunSnapshot | null) {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		if (isNewStage && run.mode === 'manual' && !this.progressModal)
			this.createProgressModal().open();
		this.progressModal?.update(run);
	}

	showProgressModal() {
		if (this.previousRun === null || TERMINAL_STAGES.includes(this.previousRun.stage)) {
			new Notice(t('sync.notSyncing'));
			return;
		}
		if (this.progressModal) this.progressModal.open();
		else this.createProgressModal().open();
	}

	createProgressModal() {
		this.progressModal = new SyncProgressModal(this.plugin, () => (this.progressModal = null));
		return this.progressModal;
	}

	private ensureProgressModal(): { modal: SyncProgressModal; autoOpened: boolean } {
		if (this.progressModal) return { modal: this.progressModal, autoOpened: false };
		const modal = this.createProgressModal();
		modal.open();
		return { modal, autoOpened: true };
	}

	public confirmManualTasks(tasks: BaseTask[]): Promise<{
		confirmed: boolean;
		selectedTasks: BaseTask[];
	}> {
		const { modal, autoOpened } = this.ensureProgressModal();
		return new Promise((resolve) => {
			const finish = (confirmed: boolean) => {
				const selectedTasks = confirmed ? modal.getSelectedTasks() : [];
				if (confirmed && autoOpened) this.progressModal?.close();
				resolve({ confirmed, selectedTasks });
			};

			modal.showTaskConfirmation(tasks, {
				onConfirm: () => finish(true),
				onCancel: () => finish(false),
			});
		});
	}
}
