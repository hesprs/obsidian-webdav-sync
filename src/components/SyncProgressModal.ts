import { Modal, Setting } from 'obsidian';
import WebDAVSyncPlugin from '~';
import type { BaseTask } from '~/sync/tasks/task.interface';
import { mount as mountFileTree, type FileTreeSelectionController } from '~/components/fileTree';
import { syncCancel } from '~/events';
import t from '~/i18n';

interface ManualConfirmationSession {
	onConfirm: () => void;
	onCancel: () => void;
}

type ActionMode = 'progress' | 'confirmation' | 'terminal';

export default class SyncProgressModal extends Modal {
	private progressBar!: HTMLDivElement;
	private progressText!: HTMLDivElement;
	private progressStats!: HTMLDivElement;
	private currentFile!: HTMLDivElement;
	private confirmationDescription!: HTMLParagraphElement;
	private confirmationContainer!: HTMLDivElement;
	private controls: HTMLElement | undefined;
	private syncCancelled = false;
	private cancelSubscription: () => void;
	private actionMode: ActionMode = 'progress';
	private renderTree?: () => void;
	private selectionController?: FileTreeSelectionController;
	private confirmationSession?: ManualConfirmationSession;

	constructor(
		private plugin: WebDAVSyncPlugin,
		private closeCallback?: () => void,
	) {
		super(plugin.app);
		this.cancelSubscription = syncCancel.subscribe(() => {
			this.syncCancelled = true;
			this.update();
		});
	}

	public update(): void {
		if (!this.progressBar || !this.progressText || !this.progressStats || !this.currentFile)
			return;

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

		const percentText = `${percent}%`;
		this.progressBar.style.width = percentText;
		this.progressText.setText(percentText);
		this.actionMode = this.resolveActionMode(currentRun?.stage);
		this.renderControls();

		this.progressStats.setText(
			t('sync.progressStats', {
				completed: completedUnits,
				total: totalUnits,
			}),
		);

		if (isPlanningStage)
			this.currentFile.setText(
				planningProgress
					? `${t(`sync.planningStage.${planningProgress.subStage}`)} ${planningProgress.currentItem}`
					: t('sync.preparing'),
			);
		else if (currentRun?.stage === 'awaiting_confirmation')
			this.currentFile.setText(t('sync.awaitingConfirmation'));
		else if (currentRun?.stage === 'executing' && progress.completed.length === 0)
			this.currentFile.setText(t('sync.start'));
		else if (this.plugin.progressService.syncEnd) {
			if (currentRun?.stage === 'cancelled' || this.syncCancelled)
				this.currentFile.setText(t('sync.cancelled'));
			else if (currentRun?.stage === 'failed')
				this.currentFile.setText(t('sync.failedStatus'));
			else if (currentRun?.stage === 'completed_noop')
				this.currentFile.setText(t('sync.alreadyUpToDate'));
			else this.currentFile.setText(t('sync.complete'));
		} else if (progress.completed.length > 0) {
			const lastFile = progress.completed.at(-1);
			if (lastFile) this.currentFile.setText(`${lastFile.taskName} ${lastFile.path}`);
		}
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
			cls: 'text-3.25 text-[var(--text-muted)] truncate overflow-hidden whitespace-nowrap',
		});

		const progressStats = progressTextContainer.createDiv({
			cls: 'text-3.25 text-[var(--text-muted)] ml-auto',
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

		this.progressBar = progressBar;
		this.progressText = progressText;
		this.progressStats = progressStats;
		this.currentFile = currentFile;

		this.confirmationDescription = container.createEl('p', {
			cls: 'pre-line hidden mt-2 mb-0',
			text: t('sync.manualConfirmation'),
		});

		this.confirmationContainer = container.createDiv({
			cls: 'webdav-sync-confirmation-container hidden',
		});

		this.renderControls();
		this.update();
	}

	showTaskConfirmation(tasks: BaseTask[], session: ManualConfirmationSession): void {
		this.confirmationSession = session;
		this.unmountTaskConfirmation();
		this.confirmationDescription.removeClass('hidden');
		this.confirmationContainer.removeClass('hidden');
		this.renderTree = mountFileTree(this.confirmationContainer, {
			tasks,
			controllerRef: (controller) => {
				this.selectionController = controller;
			},
		});
		this.actionMode = 'confirmation';
		this.renderControls();
	}

	clearTaskConfirmation(): void {
		this.confirmationSession = undefined;
		this.unmountTaskConfirmation();
		this.actionMode = this.resolveActionMode(this.plugin.progressService.currentRun?.stage);
		this.renderControls();
	}

	getSelectedTasks(): BaseTask[] {
		return this.selectionController?.getSnapshot().selectedTasks ?? [];
	}

	getUnselectedTasks(): BaseTask[] {
		return this.selectionController?.getSnapshot().unselectedTasks ?? [];
	}

	private resolveActionMode(stage?: string): ActionMode {
		if (this.confirmationSession) return 'confirmation';
		if (stage && ['completed', 'completed_noop', 'cancelled', 'failed'].includes(stage)) {
			return 'terminal';
		}
		return 'progress';
	}

	private renderControls(): void {
		if (this.controls) this.controls.remove();
		const setting = new Setting(this.contentEl);
		this.controls = setting.settingEl;

		if (this.actionMode === 'confirmation') {
			setting
				.addButton((button) => {
					button
						.setButtonText(t('sync.confirmModal.confirm'))
						.setCta()
						.onClick(() => this.confirmationSession?.onConfirm());
				})
				.addButton((button) => {
					button
						.setButtonText(t('sync.confirmModal.cancel'))
						.onClick(() => this.confirmationSession?.onCancel());
				});
			return;
		}

		setting.addButton((button) => {
			button
				.setButtonText(
					this.actionMode === 'terminal' ? t('sync.closeButton') : t('sync.hideButton'),
				)
				.onClick(() => this.close());
		});

		if (this.actionMode === 'progress') {
			setting.addButton((button) => {
				button.setButtonText(t('sync.stopButton')).setWarning().onClick(syncCancel);
			});
		}
	}

	private unmountTaskConfirmation(): void {
		this.selectionController = undefined;
		this.renderTree?.();
		this.renderTree = undefined;
		if (this.confirmationContainer) {
			this.confirmationContainer.empty();
			this.confirmationContainer.addClass('hidden');
		}
		if (this.confirmationDescription) {
			this.confirmationDescription.addClass('hidden');
		}
	}

	onClose(): void {
		const pendingCancel = this.confirmationSession?.onCancel;
		this.confirmationSession = undefined;
		this.unmountTaskConfirmation();
		this.cancelSubscription();
		const { contentEl } = this;
		contentEl.empty();
		pendingCancel?.();
		if (this.closeCallback) this.closeCallback();
	}
}
