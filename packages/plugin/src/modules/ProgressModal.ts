import type { Ref } from 'synthkernel';
import { App, Modal, Setting } from 'obsidian';
import { computed } from 'synthkernel';
import type { FileTreeSelectionController } from '@/components/fileTree';
import type { BaseTask, RemoveLocalTask } from '@/sync';
import type { Progress } from '@/types';
import { mount as mountFileTree } from '@/components/fileTree';
import renderFailedTasks from '@/components/render-failed-tasks';
import type { Dispatch, On } from './EventBus';
import type { Translate } from './I18n';
import type { SyncStage } from './Observability';
import type { FailedTaskInfo, TaskInfo } from './Sync';
import { roundPercent } from './Observability';

export type DeleteConfirmReturn = {
	delete: Array<RemoveLocalTask>;
	reupload: Array<RemoveLocalTask>;
};

export default class ProgressModal extends Modal {
	private readonly modalCleanupCallbacks: Array<() => void> = [];
	private readonly moduleCleanupCallbacks: Array<() => void> = [];
	private readonly t: Translate;
	private opening = false;
	private readonly dispatch: Dispatch;
	private description?: HTMLParagraphElement;
	private detailContainer?: HTMLDivElement;
	private controls?: HTMLElement;

	constructor(
		private readonly ctx: {
			app: App;
			translate: Translate;
			on: On;
			dispatch: Dispatch;
			syncStage: Ref<SyncStage>;
			walkProgress: Ref<Progress>;
			executionProgress: Ref<Progress<TaskInfo>>;
		},
	) {
		super(ctx.app);
		this.t = ctx.translate;
		this.dispatch = ctx.dispatch;
		const failedTasks: Array<FailedTaskInfo> = [];
		this.moduleCleanupCallbacks.push(
			ctx.on('syncStarted', ({ trigger }) => {
				if (trigger === 'manual') this.open();
				this.renderHideStop();
			}),
			ctx.on('executionStarted', () => {
				failedTasks.length = 0;
				this.renderHideStop();
			}),
			ctx.on('taskFailed', (task) => failedTasks.push(task)),
			ctx.on('syncTerminate', () => {
				this.renderDone();
				if (failedTasks.length === 0) return;
				if (!this.opening) {
					this.open();
					this.renderDone();
				}
				this.description?.setText(this.t('failedTasksDescription'));
				renderFailedTasks(this.detailContainer as HTMLDivElement, failedTasks);
				this.showDetails();
			}),
			ctx.on('requestConfirmDelete', (tasks) => {
				if (!this.opening) this.open();
				let controller: FileTreeSelectionController;
				const unmount = mountFileTree(this.detailContainer as HTMLDivElement, {
					controllerRef: (ctlr) => (controller = ctlr),
					tasks,
				});
				this.description?.setText(this.t('confirmDeleteDescription'));
				this.showDetails();
				this.renderConfirmCancel(() => {
					const { selectedTasks, unselectedTasks } = controller.getSnapshot();
					this.hideDetails();
					unmount();
					this.dispatch('deleteConfirmed', {
						delete: selectedTasks as Array<RemoveLocalTask>,
						reupload: unselectedTasks as Array<RemoveLocalTask>,
					});
				});
			}),
			ctx.on('requestConfirmTasks', (tasks) => {
				if (!this.opening) this.open();
				let controller: FileTreeSelectionController;
				const unmount = mountFileTree(this.detailContainer as HTMLDivElement, {
					controllerRef: (ctlr) => (controller = ctlr),
					tasks,
				});
				this.description?.setText(this.t('confirmTasksDescription'));
				this.showDetails();
				this.renderConfirmCancel(() => {
					const { selectedTasks } = controller.getSnapshot();
					this.hideDetails();
					unmount();
					this.dispatch('tasksConfirmed', selectedTasks);
				});
			}),
		);
	}

	declare readonly events: {
		tasksConfirmed: Array<BaseTask>;
		deleteConfirmed: DeleteConfirmReturn;
	};

	declare readonly i18n: {
		syncProgress: string;
		completed: string;
		addRecord: string;
		removeRecord: string;
		createLocalDir: string;
		createRemoteDir: string;
		download: string;
		merge: string;
		removeLocal: string;
		removeRemote: string;
		upload: string;
		failedTasksDescription: string;
		confirmDeleteDescription: string;
		confirmTasksDescription: string;
		hide: string;
		confirm: string;
		done: string;
	};

	private readonly renderHideStop = () => {
		if (!this.opening) return;
		this.controls?.remove();
		const setting = new Setting(this.contentEl);
		this.controls = setting.settingEl;
		setting
			.addButton((button) => button.setButtonText(this.t('hide')).onClick(() => this.close()))
			.addButton((button) => {
				button
					.setButtonText(this.t('stopSync'))
					.setDestructive()
					.onClick(() => this.dispatch('syncCanceled'));
			});
	};
	private readonly renderConfirmCancel = (confirmCallback: () => void) => {
		if (!this.opening) return;
		this.controls?.remove();
		const setting = new Setting(this.contentEl);
		this.controls = setting.settingEl;
		setting
			.addButton((button) =>
				button.setButtonText(this.t('confirm')).setCta().onClick(confirmCallback),
			)
			.addButton((button) => {
				button
					.setButtonText(this.t('stopSync'))
					.setDestructive()
					.onClick(() => this.dispatch('syncCanceled'));
			});
	};
	private readonly renderDone = () => {
		if (!this.opening) return;
		this.controls?.remove();
		const setting = new Setting(this.contentEl);
		this.controls = setting.settingEl;
		setting.addButton((button) =>
			button
				.setButtonText(this.t('done'))
				.setCta()
				.onClick(() => this.close()),
		);
	};

	private readonly showDetails = () => {
		this.description?.removeClass('hidden');
		this.detailContainer?.removeClass('hidden');
	};
	private readonly hideDetails = () => {
		this.description?.addClass('hidden');
		this.detailContainer?.addClass('hidden');
	};

	onOpen() {
		const { contentEl } = this;
		this.setTitle(this.t('syncProgress'));
		contentEl.empty();

		const progress = computed<{
			completed?: number;
			total?: number;
			percent?: number;
			current?: string;
		}>(
			() => {
				const stage = this.ctx.syncStage();
				if (stage === 'walkingRemote') {
					const { completed, current, total } = this.ctx.walkProgress();
					return {
						completed,
						current: current
							? `${this.t('walkingRemote')} ${current}`
							: this.t('walkingRemote'),
						percent: roundPercent(completed, total),
						total,
					};
				} else if (stage === 'executing') {
					const { completed, current, total } = this.ctx.executionProgress();
					return {
						completed,
						current: current ? `${this.t(current.name)} ${current.key}` : undefined,
						percent: roundPercent(completed, total),
						total,
					};
				} else if (stage === 'awaitingConfirmation')
					return {
						completed: 0,
						current: this.t('awaitingConfirmation'),
						percent: 0,
						total: 1,
					};
				else if (stage === 'none') return {};
				else if (stage === 'cancelled') return { current: this.t('cancelled') };
				else if (stage === 'completed') return { current: this.t('completed') };
				else if (stage === 'completedNoop')
					return {
						completed: 0,
						current: this.t('completedNoop'),
						percent: 100,
						total: 0,
					};
				else return { current: this.t('failed') };
			},
			{ deps: [this.ctx.walkProgress, this.ctx.syncStage, this.ctx.executionProgress] },
		);

		const container = contentEl.createDiv({
			cls: 'flex flex-col gap-4 max-h-[75vh] pt-3 pb-3',
		});
		const progressSection = container.createDiv({
			cls: 'flex flex-col gap-2',
		});
		const progressTextContainer = progressSection.createDiv({
			cls: 'flex flex-row',
		});
		const currentItem = progressTextContainer.createDiv({
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
		this.description = container.createEl('p', {
			cls: 'whitespace-pre-line hidden mt-2 mb-0',
		});
		this.detailContainer = container.createDiv({
			cls: 'webdav-sync-detail-container hidden',
		});

		this.modalCleanupCallbacks.push(
			progress.subscribe(
				({ completed, current, percent, total }) => {
					if (completed !== undefined && total !== undefined)
						progressStats.setText(`${completed}/${total} ${this.t('completed')}`);
					if (current !== undefined) currentItem.setText(current);
					if (percent !== undefined) progressBar.style.width = `${percent}%`;
				},
				{ immediate: true },
			),
			() => progress.dispose(),
		);
		this.opening = true;
	}

	private readonly cleanup = (callbacks: Array<() => void>) => {
		while (callbacks.length) callbacks.shift()?.();
	};

	root = {
		hideProgress: this.close.bind(this),
		showProgress: this.open.bind(this),
	};

	onClose() {
		this.opening = false;
		this.description = undefined;
		this.detailContainer = undefined;
		this.controls = undefined;
		this.cleanup(this.modalCleanupCallbacks);
	}

	dispose() {
		this.onClose();
		this.cleanup(this.moduleCleanupCallbacks);
	}
}
