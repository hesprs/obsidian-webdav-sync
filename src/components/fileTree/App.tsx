import { setIcon, setTooltip } from 'obsidian';
import { For } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { BaseTask } from '~/sync/tasks/task.interface';
import { getTaskColor, getTaskIcon, getTaskName } from '~/utils/get-task-info';
import FileTreeSelectionController from './selection';
import createFileTreeData from './tree-data';

export type FileTreeAppProps = {
	tasks: Array<BaseTask>;
	onSelectionChange?: () => void;
	controllerRef?: (controller: FileTreeSelectionController) => void;
};

export default function App(props: FileTreeAppProps) {
	const data = createFileTreeData(props.tasks);
	const controller = new FileTreeSelectionController(data);
	const [selectedById, setSelectedById] = createStore<Record<string, boolean>>(
		Object.fromEntries(data.taskNodeIds.map((taskNodeId) => [taskNodeId, true])),
	);

	props.controllerRef?.(controller);

	return (
		<div class="webdav-sync-file-tree">
			<For each={data.orderedNodeIds}>
				{(nodeId) => {
					const node = data.nodes[nodeId];
					const task = node.task;
					const icon = task
						? {
								color: getTaskColor(task.name),
								icon: getTaskIcon(task.name),
							}
						: { color: 'var(--text-normal)', icon: 'folder-open' };
					const rowClass = task && !selectedById[nodeId] ? 'is-unselected' : '';
					return (
						<div
							class={`webdav-sync-file-tree__row ${rowClass}`.trim()}
							style={{ 'padding-left': `${node.depth * 14}px` }}
						>
							<div
								class="webdav-sync-file-tree__main"
								onClick={() => {
									const changed = controller.toggle(
										nodeId,
										!selectedById[nodeId],
									);
									for (const changedNodeId of changed)
										setSelectedById(
											changedNodeId,
											controller.isSelected(changedNodeId),
										);

									props.onSelectionChange?.();
								}}
							>
								{task ? (
									<input type="checkbox" checked={selectedById[nodeId]} />
								) : (
									<div class="webdav-sync-file-tree__checkbox-spacer" />
								)}
								<div
									class="webdav-sync-task__icon"
									ref={(element) => {
										setIcon(element, icon.icon);
										element.style.color = icon.color;
										if (!task) return;
										setTooltip(element, getTaskName(task.name), { delay: 100 });
									}}
								/>
								<div class="webdav-sync-file-tree__label">
									{node.compressedLabel}
								</div>
							</div>
						</div>
					);
				}}
			</For>
		</div>
	);
}
