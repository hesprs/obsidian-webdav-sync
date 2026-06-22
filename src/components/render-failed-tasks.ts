import { setIcon, setTooltip } from 'obsidian';
import type { FailedTaskInfo } from '~/modules/Sync';
import { getTaskIcon } from '~/sync';

function renderFailedTaskRow(
	itemEl: HTMLDivElement,
	{ name, key, error, prettyName }: FailedTaskInfo,
) {
	const row = itemEl.createDiv();

	const main = row.createDiv({ cls: 'break-words flex items-center gap-2' });
	const icon = main.createSpan({ cls: 'webdav-sync-task__icon color-[var(--color-red)]' });
	setIcon(icon, getTaskIcon(name));
	setTooltip(icon, prettyName);

	main.createSpan({ cls: 'font-semibold', text: prettyName });
	main.createSpan({ cls: 'text-[var(--text-muted)] truncate', text: key });

	row.createDiv({ cls: 'text-[var(--text-muted)] break-words mt-1', text: error });
}

export default function renderFailedTasks(
	detailContainer: HTMLDivElement,
	failedTasks: Array<FailedTaskInfo>,
): void {
	detailContainer.empty();
	const tasksContainer = detailContainer.createDiv({ cls: 'w-100% flex flex-col gap-3 p-1.5' });
	detailContainer.removeClass('hidden');
	failedTasks.forEach((task) => renderFailedTaskRow(tasksContainer, task));
}
