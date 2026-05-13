import type { App } from 'obsidian';
import { Modal, Setting } from 'obsidian';
import type { FileTreeSelectionController } from '~/components/fileTree';
import type RemoveLocalTask from '~/sync/tasks/remove-local.task';
import { mount as mountFileTree } from '~/components/fileTree';
import t from '~/i18n';

export default class DeleteConfirmModal extends Modal {
	private confirmed = false;
	private renderTree?: () => void;
	private selectionController?: FileTreeSelectionController;
	private resolver:
		| ((value: {
				tasksToDelete: Array<RemoveLocalTask>;
				tasksToReupload: Array<RemoveLocalTask>;
		  }) => void)
		| undefined;

	constructor(
		app: App,
		private readonly tasks: Array<RemoveLocalTask>,
	) {
		super(app);
	}

	onOpen() {
		this.setTitle(t('deleteConfirm.title'));

		const { contentEl } = this;
		contentEl.empty();

		const instruction = contentEl.createEl('p', {
			cls: 'delete-confirm-instruction',
		});
		instruction.className = 'whitespace-pre-line';
		instruction.setText(t('deleteConfirm.instruction'));

		const treeContainer = contentEl.createDiv({
			cls: 'webdav-sync-delete-confirm-tree mb-3',
		});
		this.renderTree = mountFileTree(treeContainer, {
			controllerRef: (controller) => {
				this.selectionController = controller;
			},
			tasks: this.tasks,
		});

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText(t('deleteConfirm.deleteAndReupload'))
					.setCta()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					});
			})
			.addButton((button) => {
				button.setButtonText(t('deleteConfirm.skipForNow')).onClick(() => {
					this.confirmed = false;
					this.close();
				});
			});
	}

	openAndWait(): Promise<{
		tasksToDelete: Array<RemoveLocalTask>;
		tasksToReupload: Array<RemoveLocalTask>;
	}> {
		return new Promise((resolve) => {
			this.confirmed = false;
			this.resolver = resolve;
			this.open();
		});
	}

	onClose() {
		const selectionSnapshot = this.selectionController?.getSnapshot();
		this.selectionController = undefined;
		this.renderTree?.();
		this.renderTree = undefined;
		this.contentEl.empty();

		const resolver = this.resolver;
		this.resolver = undefined;
		if (!resolver) return;

		if (!this.confirmed) {
			resolver({
				tasksToDelete: [],
				tasksToReupload: [],
			});
			return;
		}

		resolver({
			tasksToDelete: (selectionSnapshot?.selectedTasks ?? []) as Array<RemoveLocalTask>,
			tasksToReupload: (selectionSnapshot?.unselectedTasks ?? []) as Array<RemoveLocalTask>,
		});
	}
}
