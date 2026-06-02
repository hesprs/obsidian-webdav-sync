import { setIcon, setTooltip } from 'obsidian';
import type { SyncFailedTaskInfo } from '~/events';
import { getTaskIcon, getTaskName } from '~/utils/get-task-info';

function renderFailedTaskRow(itemEl: HTMLDivElement, task: SyncFailedTaskInfo) {
	const row = itemEl.createDiv();
	const taskName = getTaskName(task.name);

	const main = row.createDiv({ cls: 'break-words flex items-center gap-2' });
	const icon = main.createSpan({ cls: 'webdav-sync-task__icon color-[var(--color-red)]' });
	setIcon(icon, getTaskIcon(task.name));
	setTooltip(icon, taskName);

	main.createSpan({ cls: 'font-semibold', text: taskName });
	main.createSpan({ cls: 'text-[var(--text-muted)] truncate', text: task.localPath });

	row.createDiv({ cls: 'text-[var(--text-muted)] break-words mt-1', text: task.errorMessage });
}

export default function renderFailedTasks(
	detailContainer: HTMLDivElement,
	failedTasks: Array<SyncFailedTaskInfo>,
): void {
	detailContainer.empty();
	const tasksContainer = detailContainer.createDiv({ cls: 'w-100% flex flex-col gap-3 p-1.5' });
	detailContainer.removeClass('hidden');
	failedTasks.forEach((task) => renderFailedTaskRow(tasksContainer, task));
}
