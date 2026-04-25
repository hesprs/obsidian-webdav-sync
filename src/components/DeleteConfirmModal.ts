import { App, Modal, Setting } from 'obsidian';
import { mount as mountFileTree, type FileTreeSelectionController } from '~/components/fileTree';
import t from '~/i18n';
import RemoveLocalTask from '~/sync/tasks/remove-local.task';

export default class DeleteConfirmModal extends Modal {
	private confirmed: boolean = false;
	private renderTree?: () => void;
	private selectionController?: FileTreeSelectionController;
	private resolver:
		| ((value: {
				tasksToDelete: RemoveLocalTask[];
				tasksToReupload: RemoveLocalTask[];
		  }) => void)
		| null = null;

	constructor(
		app: App,
		private tasks: RemoveLocalTask[],
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
			cls: 'max-h-50vh overflow-y-auto webdav-sync-delete-confirm-tree mb-3',
		});
		this.renderTree = mountFileTree(treeContainer, {
			tasks: this.tasks,
			controllerRef: (controller) => {
				this.selectionController = controller;
			},
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
		tasksToDelete: RemoveLocalTask[];
		tasksToReupload: RemoveLocalTask[];
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
		this.resolver = null;
		if (!resolver) return;

		if (!this.confirmed) {
			resolver({
				tasksToDelete: [],
				tasksToReupload: [],
			});
			return;
		}

		resolver({
			tasksToDelete: (selectionSnapshot?.selectedTasks ?? []) as RemoveLocalTask[],
			tasksToReupload: (selectionSnapshot?.unselectedTasks ?? []) as RemoveLocalTask[],
		});
	}
}
