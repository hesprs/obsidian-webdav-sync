import type WebDAVSyncPlugin from '~';
import { Modal, Setting } from 'obsidian';
import type { FileTreeSelectionController } from '~/components/fileTree';
import type { SyncRunSnapshot, SyncRunStage, SyncFailedTaskInfo } from '~/events';
import type { BaseTask } from '~/sync/tasks/task.interface';
import { mount as mountFileTree } from '~/components/fileTree';
import renderFailedTasks from '~/components/render-failed-tasks';
import { syncCancel } from '~/events';
import t from '~/i18n';
import { TERMINAL_STAGES } from '~/services/observability.service';
import { getTaskName } from '~/utils/get-task-info';

type ManualConfirmationSession = {
	onConfirm: () => void;
	onCancel: () => void;
};

type SyncStage = 'none' | 'walking' | 'confirmation' | 'syncing' | 'terminal';

export default class SyncProgressModal extends Modal {
	private progressBar!: HTMLDivElement;
	private progressText!: HTMLDivElement;
	private progressStats!: HTMLDivElement;
	private currentFile!: HTMLDivElement;
	private confirmationDescription!: HTMLParagraphElement;
	private failedTasksDescription!: HTMLParagraphElement;
	private detailContainer!: HTMLDivElement;
	private controls: HTMLElement | undefined;
	private stage: SyncStage = 'none';
	private lastStage: SyncStage = 'none';
	private renderTree?: () => void;
	private selectionController?: FileTreeSelectionController;
	private confirmationSession?: ManualConfirmationSession;

	constructor(
		plugin: WebDAVSyncPlugin,
		private readonly closeCallback?: () => void,
	) {
		super(plugin.app);
	}

	private getUnits(run: SyncRunSnapshot): {
		completed: number;
		total: number;
		percentage?: number;
	} {
		const stage = run.stage;
		if (stage === 'walking_remote')
			return {
				completed: run.remoteWalkSummary?.completedItems || 0,
				total: run.remoteWalkSummary?.totalItems || 1,
			};
		if (stage === 'executing' || stage === 'completed')
			return {
				completed: run.progressSummary.completedTasks,
				total: run.progressSummary.totalTasks,
			};
		if (stage === 'completed_noop') return { completed: 0, percentage: 100, total: 0 };
		return { completed: 0, total: 1 };
	}

	private updateStage(currentRun: SyncRunSnapshot): void {
		this.stage = this.resolveStage(currentRun.stage);
		if (this.stage === this.lastStage) return;
		this.renderControls();
		if (this.lastStage === 'confirmation') this.clearTaskConfirmation();
		this.lastStage = this.stage;
	}

	private resolveStage(stage?: SyncRunStage): SyncStage {
		if (stage && TERMINAL_STAGES.includes(stage)) return 'terminal';
		if (stage === 'awaiting_confirmation') return 'confirmation';
		if (stage === 'executing') return 'syncing';
		if (stage === 'walking_remote' || stage === 'pre_connecting') return 'walking';
		return 'none';
	}

	public update(run: SyncRunSnapshot): void {
		if (!this.progressBar || !this.progressText || !this.progressStats || !this.currentFile)
			return;
		const stage = run.stage;

		const { completed, total, percentage } = this.getUnits(run);
		this.updateStage(run);

		const percent = percentage ?? (Math.round((completed / total) * 100) || 0);
		const percentText = `${percent}%`;
		this.progressBar.style.width = percentText;
		this.progressText.setText(percentText);
		this.progressStats.setText(t('sync.progressStats', { completed, total }));

		if (stage === 'pre_connecting') this.currentFile.setText(t('sync.preConnecting'));
		else if (stage === 'walking_remote')
			this.currentFile.setText(
				`${t('sync.walkingRemote')} ${run.remoteWalkSummary?.currentItem}`,
			);
		else if (stage === 'awaiting_confirmation')
			this.currentFile.setText(t('sync.awaitingConfirmation'));
		else if (stage === 'executing' && run.progressSummary.completed.length === 0)
			this.currentFile.setText(t('sync.syncingFiles'));
		else if (stage === 'cancelled') this.currentFile.setText(t('sync.cancelled'));
		else if (stage === 'failed') this.currentFile.setText(t('sync.failedStatus'));
		else if (stage === 'completed_noop') this.currentFile.setText(t('sync.alreadyUpToDate'));
		else if (stage === 'executing' && run.progressSummary.completed.length > 0) {
			const lastFile = run.progressSummary.completed.at(-1);
			if (lastFile)
				this.currentFile.setText(`${getTaskName(lastFile.taskName)} ${lastFile.path}`);
		} else this.currentFile.setText(t('sync.complete'));
	}

	onOpen() {
		const { contentEl } = this;
		this.setTitle(t('sync.progressTitle'));
		contentEl.empty();

		const container = contentEl.createDiv({
			cls: 'flex flex-col gap-4 max-h-[75vh] pt-3 pb-3',
		});

		const progressSection = container.createDiv({
			cls: 'flex flex-col gap-2',
		});

		const progressTextContainer = progressSection.createDiv({
			cls: 'flex flex-row',
		});

		const currentFile = progressTextContainer.createDiv({
			cls: 'text-3 text-[var(--text-muted)] truncate whitespace-nowrap',
		});

		const progressStats = progressTextContainer.createDiv({
			cls: 'text-3 text-[var(--text-muted)] ml-auto whitespace-nowrap ml-2',
		});

		const progressBarContainer = progressSection.createDiv({
			cls: 'relative h-5 bg-[var(--background-secondary)] rounded overflow-hidden',
		});

		const progressBar = progressBarContainer.createDiv({
			cls: 'absolute h-full bg-[var(--interactive-accent)] w-0 transition-width',
		});

		const progressText = progressBarContainer.createDiv({
			cls: 'absolute w-full text-center text-3 leading-5 text-[var(--text-on-accent)]',
		});

		this.progressBar = progressBar;
		this.progressText = progressText;
		this.progressStats = progressStats;
		this.currentFile = currentFile;

		this.confirmationDescription = container.createEl('p', {
			cls: 'whitespace-pre-line hidden mt-2 mb-0',
			text: t('sync.manualConfirmation'),
		});

		this.failedTasksDescription = container.createEl('p', {
			cls: 'whitespace-pre-line hidden mt-2 mb-0',
			text: t('sync.failedDescription'),
		});

		this.detailContainer = container.createDiv({
			cls: 'webdav-sync-confirmation-container hidden',
		});
	}

	getSelectedTasks(): Array<BaseTask> {
		return this.selectionController?.getSnapshot().selectedTasks ?? [];
	}

	getUnselectedTasks(): Array<BaseTask> {
		return this.selectionController?.getSnapshot().unselectedTasks ?? [];
	}

	private renderControls(): void {
		if (this.controls) this.controls.remove();
		const setting = new Setting(this.contentEl);
		this.controls = setting.settingEl;

		if (this.stage === 'confirmation') {
			setting
				.addButton((button) => {
					button
						.setButtonText(t('sync.confirmModal.confirm'))
						.setCta()
						.onClick(this.confirm);
				})
				.addButton((button) => {
					button
						.setButtonText(t('sync.confirmModal.cancel'))
						.onClick(this.cancelConfirmation);
				});
			return;
		}

		setting.addButton((button) => {
			button
				.setButtonText(
					this.stage === 'terminal' ? t('sync.closeButton') : t('sync.hideButton'),
				)
				.onClick(() => this.close());
		});

		if (this.stage === 'syncing' || this.stage === 'walking')
			setting.addButton((button) => {
				button.setButtonText(t('sync.stopButton')).setWarning().onClick(syncCancel);
			});
	}

	showTaskConfirmation(tasks: Array<BaseTask>, session: ManualConfirmationSession): void {
		this.confirmationSession = session;
		this.confirmationDescription.removeClass('hidden');
		this.detailContainer.removeClass('hidden');
		this.renderTree = mountFileTree(this.detailContainer, {
			controllerRef: (controller) => (this.selectionController = controller),
			tasks,
		});
	}

	private clearTaskConfirmation(): void {
		this.selectionController = undefined;
		this.renderTree?.();
		this.renderTree = undefined;
		if (this.detailContainer) {
			this.detailContainer.empty();
			this.detailContainer.addClass('hidden');
		}
		if (this.confirmationDescription) this.confirmationDescription.addClass('hidden');
	}

	public setFailedTasks(failedTasks: Array<SyncFailedTaskInfo>): void {
		this.failedTasksDescription.removeClass('hidden');
		renderFailedTasks(this.detailContainer, failedTasks);
	}

	private readonly cancelConfirmation = (): void => {
		const pendingCancel = this.confirmationSession?.onCancel;
		this.confirmationSession = undefined;
		pendingCancel?.();
	};

	private readonly confirm = (): void => {
		const pendingConfirm = this.confirmationSession?.onConfirm;
		this.confirmationSession = undefined;
		pendingConfirm?.();
	};

	onClose(): void {
		this.cancelConfirmation();
		this.clearTaskConfirmation();
		this.contentEl.empty();
		if (this.closeCallback) this.closeCallback();
	}
}
