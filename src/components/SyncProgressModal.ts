import { ButtonComponent, Modal, setIcon, Setting } from 'obsidian';
import { Subscription } from 'rxjs';
import CleanRecordTask from '~/sync/tasks/clean-record.task';
import FilenameErrorTask from '~/sync/tasks/filename-error.task';
import MkdirsRemoteTask from '~/sync/tasks/mkdirs-remote.task';
import RemoveRemoteRecursivelyTask from '~/sync/tasks/remove-remote-recursively.task';
import getTaskName from '~/utils/get-task-name';
import WebDAVSyncPlugin from '..';
import {
	emitCancelSync,
	onCancelSync,
	onSyncUpdateMtimeProgress,
	SyncPlanningSubStage,
} from '../events';
import i18n from '../i18n';
import MergeTask from '../sync/tasks/merge.task';
import MkdirLocalTask from '../sync/tasks/mkdir-local.task';
import MkdirRemoteTask from '../sync/tasks/mkdir-remote.task';
import PullTask from '../sync/tasks/pull.task';
import PushTask from '../sync/tasks/push.task';
import RemoveLocalTask from '../sync/tasks/remove-local.task';
import RemoveRemoteTask from '../sync/tasks/remove-remote.task';
import { formatSyncRunType } from '../utils/format-sync-run-type';

export default class SyncProgressModal extends Modal {
	private progressBar!: HTMLDivElement;
	private progressText!: HTMLDivElement;
	private progressStats!: HTMLDivElement;
	private currentStage!: HTMLDivElement;
	private currentFile!: HTMLDivElement;
	private filesList!: HTMLDivElement;
	private syncCancelled = false;
	private cancelSubscription: Subscription;
	private updateMtimeSubscription: Subscription;
	private stopButtonComponent!: ButtonComponent;
	private hideButtonComponent!: ButtonComponent;

	private syncStateProgressBar!: HTMLDivElement;
	private syncStateProgressText!: HTMLDivElement;
	private syncStateProgressStats!: HTMLDivElement;
	private syncStateCurrentOperation!: HTMLDivElement;

	constructor(
		private plugin: WebDAVSyncPlugin,
		private closeCallback?: () => void,
	) {
		super(plugin.app);
		this.cancelSubscription = onCancelSync().subscribe(() => {
			this.syncCancelled = true;
			this.update();
		});
		this.updateMtimeSubscription = onSyncUpdateMtimeProgress().subscribe((progress) => {
			this.updateSyncStateProgress(progress.total, progress.completed);
		});
	}

	public update(): void {
		if (
			!this.progressBar ||
			!this.progressText ||
			!this.progressStats ||
			!this.currentStage ||
			!this.currentFile ||
			!this.filesList
		) {
			return;
		}

		const progress = this.plugin.progressService.syncProgress;
		const planningProgress = this.plugin.progressService.planningProgress;
		const currentRun = this.plugin.progressService.currentRun;
		const isPlanningStage = currentRun?.stage === 'planning' || currentRun?.stage === 'queued';
		const completedUnits = isPlanningStage
			? (planningProgress?.completedWorkUnits ?? 0)
			: progress.completedTasks;
		const totalUnits = isPlanningStage
			? (planningProgress?.totalWorkUnits ?? 0)
			: progress.totalTasks;

		const percent = Math.round((completedUnits / totalUnits) * 100) || 0;
		const syncType = currentRun ? formatSyncRunType(currentRun) : null;

		this.progressBar.style.width = `${percent}%`;
		this.progressText.setText(
			i18n.t('sync.percentComplete', {
				percent,
			}),
		);

		this.progressStats.setText(
			i18n.t('sync.progressStats', {
				completed: completedUnits,
				total: totalUnits,
			}),
		);

		this.currentStage.setText(
			isPlanningStage && planningProgress
				? `${syncType ?? i18n.t('sync.progressTitle')} · ${this.getPlanningStageText(planningProgress.subStage)}`
				: (syncType ?? i18n.t('sync.progressTitle')),
		);

		if (isPlanningStage) {
			this.currentFile.setText(
				planningProgress?.currentItem
					? i18n.t('sync.currentFile', {
							path: planningProgress.currentItem,
						})
					: i18n.t('sync.preparing'),
			);
		} else if (currentRun?.stage === 'awaiting_confirmation') {
			this.currentFile.setText(i18n.t('sync.awaitingConfirmation'));
		} else if (currentRun?.stage === 'executing' && progress.completed.length === 0) {
			this.currentFile.setText(i18n.t('sync.start'));
		} else if (this.plugin.progressService.syncEnd) {
			if (currentRun?.stage === 'cancelled' || this.syncCancelled) {
				this.stopButtonComponent.buttonEl.addClass('hidden');
				this.hideButtonComponent.setButtonText(i18n.t('sync.closeButton'));
				this.currentFile.setText(i18n.t('sync.cancelled'));
			} else if (currentRun?.stage === 'failed') {
				this.stopButtonComponent.buttonEl.addClass('hidden');
				this.hideButtonComponent.setButtonText(i18n.t('sync.closeButton'));
				this.currentFile.setText(i18n.t('sync.failedStatus'));
			} else if (currentRun?.stage === 'completed_noop') {
				this.stopButtonComponent.buttonEl.addClass('hidden');
				this.hideButtonComponent.setButtonText(i18n.t('sync.closeButton'));
				this.currentFile.setText(i18n.t('sync.alreadyUpToDate'));
			} else {
				this.stopButtonComponent.buttonEl.addClass('hidden');
				this.hideButtonComponent.setButtonText(i18n.t('sync.closeButton'));
				this.currentFile.setText(i18n.t('sync.complete'));
			}
		} else if (progress.completed.length > 0) {
			const lastFile = progress.completed.at(-1);
			if (lastFile) {
				this.currentFile.setText(
					i18n.t('sync.currentFile', {
						path: lastFile.localPath,
					}),
				);
			}
		}

		this.filesList.empty();

		const recentFiles = progress.completed.slice().reverse();

		recentFiles.forEach((file) => {
			const item = this.filesList.createDiv({
				cls: 'flex items-center p-1 rounded text-2.5 gap-2 hover:bg-[var(--background-secondary)]',
			});

			const icon = item.createSpan({ cls: 'text-[var(--text-muted)]' });

			if (file instanceof CleanRecordTask) setIcon(icon, 'archive-x');
			else if (file instanceof MergeTask) setIcon(icon, 'git-merge');
			else if (file instanceof FilenameErrorTask) setIcon(icon, 'refresh-cw-off');
			else if (
				file instanceof MkdirLocalTask ||
				file instanceof MkdirRemoteTask ||
				file instanceof MkdirsRemoteTask
			)
				setIcon(icon, 'folder-plus');
			else if (file instanceof PullTask) setIcon(icon, 'arrow-down-narrow-wide');
			else if (file instanceof PushTask) setIcon(icon, 'arrow-up-narrow-wide');
			else if (
				file instanceof RemoveLocalTask ||
				file instanceof RemoveRemoteTask ||
				file instanceof RemoveRemoteRecursivelyTask
			)
				setIcon(icon, 'trash');
			else setIcon(icon, 'arrow-left-right');

			const typeLabel = item.createSpan({
				cls: 'flex-none w-17 md:w-24 text-[var(--text-normal)] font-500',
			});

			typeLabel.setText(getTaskName(file));

			const filePath = item.createSpan({
				cls: 'flex-1 break-all',
			});
			filePath.setText(
				i18n.t('sync.filePath', {
					path: file.localPath,
				}),
			);
		});
	}

	private getPlanningStageText(stage: SyncPlanningSubStage): string {
		return i18n.t(`sync.planningStage.${stage}`);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const container = contentEl.createDiv({
			cls: 'flex flex-col gap-4 min-h-[40vh] max-h-[75vh]',
		});

		const header = container.createDiv({
			cls: 'border-b border-[var(--background-modifier-border)]',
		});

		const title = header.createEl('h2', {
			cls: 'm-0',
		});
		title.setText(i18n.t('sync.progressTitle'));

		const statusSection = container.createDiv({
			cls: 'flex flex-col gap-1',
		});

		const currentStage = statusSection.createDiv();
		currentStage.setText(i18n.t('sync.progressTitle'));

		const currentFile = statusSection.createDiv({
			cls: 'text-3 text-[var(--text-muted)] truncate overflow-hidden whitespace-nowrap',
		});

		const progressSection = container.createDiv({
			cls: 'flex flex-col gap-2',
		});

		const progressStats = progressSection.createDiv({
			cls: 'text-3.25',
		});

		const progressBarContainer = progressSection.createDiv({
			cls: 'relative h-5 bg-[var(--background-secondary)] rounded overflow-hidden',
		});

		const progressBar = progressBarContainer.createDiv({
			cls: 'absolute h-full bg-[var(--interactive-accent)] w-0 transition-width',
		});

		const progressText = progressBarContainer.createDiv({
			cls: 'absolute w-full text-center text-3 leading-5 text-[var(--text-on-accent)] mix-blend-difference',
		});

		const syncStateProgressSection = container.createDiv({
			cls: 'flex flex-col gap-1',
		});
		this.syncStateCurrentOperation = syncStateProgressSection.createDiv();
		this.syncStateCurrentOperation.setText(i18n.t('sync.updatingSyncState'));
		this.syncStateCurrentOperation.hide();

		const syncStateProgressStats = syncStateProgressSection.createDiv({
			cls: 'text-3.25',
		});
		this.syncStateProgressStats = syncStateProgressStats;
		this.syncStateProgressStats.hide();

		const syncStateProgressBarContainer = syncStateProgressSection.createDiv({
			cls: 'relative h-5 bg-[var(--background-secondary)] rounded overflow-hidden',
		});
		syncStateProgressBarContainer.hide();

		this.syncStateProgressBar = syncStateProgressBarContainer.createDiv({
			cls: 'absolute h-full bg-[var(--interactive-accent)] w-0 transition-width',
		});
		this.syncStateProgressText = syncStateProgressBarContainer.createDiv({
			cls: 'absolute w-full text-center text-3 leading-5 text-[var(--text-on-accent)] mix-blend-difference',
		});

		const filesSection = container.createDiv({
			cls: 'flex flex-col flex-1 gap-2 mt-2 overflow-y-auto',
		});

		const filesHeader = filesSection.createDiv({
			cls: 'font-500 text-3.5 pb-1 border-b border-[var(--background-modifier-border)]',
		});
		filesHeader.setText(i18n.t('sync.completedFilesTitle'));

		const filesList = filesSection.createDiv({
			cls: 'flex-1 overflow-y-auto border border-[var(--background-modifier-border)] border-solid rounded p-1',
		});

		this.progressBar = progressBar;
		this.progressText = progressText;
		this.progressStats = progressStats;
		this.currentStage = currentStage;
		this.currentFile = currentFile;
		this.filesList = filesList;

		const footerButtons = container.createDiv({
			cls: 'border-t border-[var(--background-modifier-border)]',
		});

		new Setting(footerButtons)
			.addButton((button) => {
				button.setButtonText(i18n.t('sync.hideButton')).onClick(() => this.close());
				this.hideButtonComponent = button;
			})
			.addButton((button) => {
				button
					.setButtonText(i18n.t('sync.stopButton'))
					.setWarning()
					.onClick(() => {
						emitCancelSync();
					});
				this.stopButtonComponent = button;
			});

		this.update();
	}

	onClose(): void {
		this.cancelSubscription.unsubscribe();
		this.updateMtimeSubscription.unsubscribe();
		const { contentEl } = this;
		contentEl.empty();
		if (this.closeCallback) {
			this.closeCallback();
		}
	}

	private updateSyncStateProgress(total: number, completed: number): void {
		if (
			!this.syncStateProgressBar ||
			!this.syncStateProgressText ||
			!this.syncStateProgressStats
		) {
			return;
		}

		this.syncStateCurrentOperation.show();
		this.syncStateProgressStats.show();
		this.syncStateProgressBar.parentElement?.show();

		const percent = Math.round((completed / total) * 100) || 0;

		this.syncStateProgressBar.style.width = `${percent}%`;
		this.syncStateProgressText.setText(
			i18n.t('sync.percentComplete', {
				percent,
			}),
		);

		this.syncStateProgressStats.setText(
			i18n.t('sync.progressStats', {
				completed,
				total,
			}),
		);

		if (completed === total) {
			this.syncStateCurrentOperation.setText(i18n.t('sync.syncStateUpdated'));
		}
	}
}
