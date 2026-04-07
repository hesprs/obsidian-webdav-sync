import { Notice, Platform } from 'obsidian';
import FailedTasksModal from '~/components/FailedTasksModal';
import {
	onSyncRun,
	SyncPlanningSubStage,
	type SyncRunSnapshot,
	type SyncRunStage,
	type SyncRunWarning,
} from '~/events';
import i18n from '~/i18n';
import { formatRelativeTime } from '~/utils/format-relative-time';
import type WebDAVSyncPlugin from '..';

const TERMINAL_STAGES: SyncRunStage[] = ['completed', 'completed_noop', 'cancelled', 'failed'];
const MOBILE_SYNC_NOTICE_HIDE_DELAY = 2000;

export default class ObservabilityService {
	private previousRun: SyncRunSnapshot | null = null;
	private shownFailureModalRunIds = new Set<string>();
	private subscriptions = [
		onSyncRun().subscribe((run) => {
			if (!run) return;
			this.apply(run);
			this.previousRun = run;
		}),
	];
	private syncStatusBar: HTMLElement;
	private lastSyncTime: number | null = null;
	private updateInterval: number | null = null;
	private baseStatusText: string = '';
	private mobileSyncNotice: Notice | null = null;
	private mobileSyncNoticeHideTimeout: number | null = null;

	constructor(private plugin: WebDAVSyncPlugin) {
		this.syncStatusBar = plugin.addStatusBarItem();
	}

	unload() {
		this.subscriptions.forEach((subscription) => subscription.unsubscribe());
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
		if (this.lastSyncTime === null) {
			return;
		}

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
			new Notice(i18n.t(warning.messageKey), 5000);
			return;
		}

		if (this.shouldUseMobileSyncNotice()) {
			return;
		}

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

	private applyProgressModal(run: SyncRunSnapshot, previousRun: SyncRunSnapshot | null) {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		if (
			isNewStage &&
			run.mode === 'manual' &&
			(run.stage === 'planning' || run.stage === 'executing')
		) {
			this.plugin.progressService.showProgressModal();
			return;
		}

		if (run.mode === 'auto' && TERMINAL_STAGES.includes(run.stage)) {
			this.plugin.progressService.closeProgressModal();
		}
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
			syncType: i18n.t(`sync.runKind.${run.runKind}`),
			failedCount: run.resultSummary.failedTasks,
		}).open();
	}

	private getStatusText(run: SyncRunSnapshot): string {
		const syncType = i18n.t(`sync.runKind.${run.runKind}`);
		switch (run.stage) {
			case 'queued':
			case 'planning':
				return this.getPlanningStatusText(syncType, run);
			case 'awaiting_confirmation':
				return `${syncType} · ${i18n.t('sync.awaitingConfirmation')}`;
			case 'executing': {
				const { totalTasks, completedTasks } = run.progressSummary;
				if (totalTasks === 0) return `${syncType} · ${i18n.t('sync.start')}`;
				const percent = Math.round((completedTasks / totalTasks) * 10000) / 100;
				return `${syncType} · ${i18n.t('sync.progress', { percent })}`;
			}
			case 'completed':
				return run.resultSummary?.failedTasks
					? `${syncType} · ${i18n.t('sync.completeWithFailed', {
							failedCount: run.resultSummary.failedTasks,
						})}`
					: `${syncType} · ${i18n.t('sync.complete')}`;
			case 'completed_noop':
				return `${syncType} · ${i18n.t(run.mode === 'manual' ? 'sync.alreadyUpToDate' : 'sync.upToDate')}`;
			case 'cancelled':
				return `${syncType} · ${i18n.t('sync.cancelled')}`;
			case 'failed':
				return run.resultSummary?.failedTasks
					? `${syncType} · ${i18n.t('sync.completeWithFailed', {
							failedCount: run.resultSummary.failedTasks,
						})}`
					: `${syncType} · ${i18n.t('sync.failedStatus')}`;
		}
	}

	private getPlanningStatusText(syncType: string, run: SyncRunSnapshot): string {
		const planningProgress = run.planningProgress;
		if (!planningProgress) return `${syncType} · ${i18n.t('sync.preparing')}`;
		const { totalWorkUnits, completedWorkUnits, subStage } = planningProgress;
		const stageText = i18n.t(`sync.planningStage.${subStage}`);
		if (totalWorkUnits <= 0) return `${syncType} · ${stageText}`;
		if (subStage === SyncPlanningSubStage.deciding) {
			const percent = Math.round((completedWorkUnits / totalWorkUnits) * 10000) / 100;
			return `${syncType} · ${stageText} ${percent}%`;
		} else return `${syncType} · ${stageText} (${completedWorkUnits}/${totalWorkUnits})`;
	}

	private getNoticeText(
		run: SyncRunSnapshot,
		previousRun: SyncRunSnapshot | null,
	): string | null {
		const isNewStage = previousRun?.runId !== run.runId || previousRun.stage !== run.stage;
		if (!isNewStage) return null;

		switch (run.stage) {
			case 'planning':
				return run.mode === 'manual' ? i18n.t('sync.preparing') : null;
			case 'executing':
				return run.mode === 'manual' ? i18n.t('sync.start') : null;
			case 'completed':
				return run.mode === 'manual'
					? run.resultSummary?.failedTasks
						? i18n.t('sync.completeWithFailed', {
								failedCount: run.resultSummary.failedTasks,
							})
						: i18n.t('sync.complete')
					: null;
			case 'completed_noop':
				return run.mode === 'manual' ? i18n.t('sync.noChangesToSync') : null;
			case 'cancelled':
				return run.mode === 'manual' ? i18n.t('sync.cancelled') : null;
			case 'failed':
				if (run.resultSummary?.failedTasks) {
					return i18n.t('sync.completeWithFailed', {
						failedCount: run.resultSummary.failedTasks,
					});
				}
				return i18n.t('sync.failedWithError', {
					error: run.errorSummary?.message ?? i18n.t('sync.failedStatus'),
				});
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
			if (!previousWarnings.some((item) => item.code === warning.code)) {
				return warning;
			}
		}

		return null;
	}
}
