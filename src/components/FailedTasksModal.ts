import { Modal, Setting, type App } from 'obsidian';
import t from '~/i18n';

type FailedTaskInfo = {
	taskName: string;
	localPath: string;
	errorMessage: string;
};

type FailedTasksContext = {
	syncType: string;
	failedCount: number;
};

export default class FailedTasksModal extends Modal {
	constructor(
		app: App,
		private readonly failedTasks: Array<FailedTaskInfo>,
		private readonly context?: FailedTasksContext,
	) {
		super(app);
	}

	onOpen() {
		this.setTitle(t('failedTasks.title'));

		const { contentEl } = this;
		contentEl.empty();

		const instruction = contentEl.createEl('p', {
			cls: 'failed-tasks-instruction',
		});
		instruction.setText(t('failedTasks.instruction'));

		if (this.context) {
			const contextEl = contentEl.createEl('p', {
				cls: 'failed-tasks-instruction',
			});
			contextEl.setText(
				t('failedTasks.context', {
					failedCount: this.context.failedCount,
					syncType: this.context.syncType,
				}),
			);
		}

		const tableContainer = contentEl.createDiv({
			cls: 'max-h-50vh overflow-y-auto',
		});
		const table = tableContainer.createEl('table', {
			cls: 'task-list-table',
		});

		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: t('failedTasks.taskName') });
		headerRow.createEl('th', { text: t('failedTasks.localPath') });
		headerRow.createEl('th', { text: t('failedTasks.errorMessage') });

		const tbody = table.createEl('tbody');
		this.failedTasks.forEach((task) => {
			const row = tbody.createEl('tr');
			row.createEl('td', { text: task.taskName });
			row.createEl('td', { text: task.localPath });
			row.createEl('td', { text: task.errorMessage });
		});

		const settingDiv = contentEl.createDiv();
		settingDiv.className = 'mt-4';
		new Setting(settingDiv).addButton((button) => {
			button
				.setButtonText(t('failedTasks.close'))
				.setCta()
				.onClick(() => this.close());
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
