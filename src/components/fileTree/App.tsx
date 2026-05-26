import { setIcon, setTooltip } from 'obsidian';
import { For, createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import t from '~/i18n';
import type { BaseTask } from '~/sync/tasks/task.interface';
import { getTaskColor, getTaskIcon, getTaskName } from '~/utils/get-task-info';
import FileTreeSelectionController from './selection';
import createFileTreeData from './tree-data';

const STORAGE_KEY = 'webdav-sync:deselected-tasks';

function loadDeselected(): Set<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return new Set(JSON.parse(raw) as Array<string>);
	} catch { /* ignore */ }
	return new Set();
}

function saveDeselected(deselected: Set<string>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...deselected]));
	} catch { /* ignore */ }
}

export type FileTreeAppProps = {
	tasks: Array<BaseTask>;
	onSelectionChange?: () => void;
	controllerRef?: (controller: FileTreeSelectionController) => void;
};

export default function App(props: FileTreeAppProps) {
	const data = createFileTreeData(props.tasks);
	const controller = new FileTreeSelectionController(data);

	const prevDeselected = loadDeselected();
	const initialSelected: Record<string, boolean> = {};
	for (const taskNodeId of data.taskNodeIds) {
		const task = data.nodes[taskNodeId]?.task;
		const isDeselected = task ? prevDeselected.has(task.localPath) : false;
		initialSelected[taskNodeId] = !isDeselected;
		if (isDeselected) controller.toggle(taskNodeId, false);
	}
	const [selectedById, setSelectedById] = createStore<Record<string, boolean>>(initialSelected);

	const [collapsedById, setCollapsedById] = createStore<Record<string, boolean>>({});

	props.controllerRef?.(controller);

	const persistSelection = () => {
		const snapshot = controller.getSnapshot();
		const deselected = new Set(snapshot.unselectedTasks.map((t) => t.localPath));
		saveDeselected(deselected);
	};

	const applySelectionChanges = (changed: Set<string>) => {
		for (const changedNodeId of changed)
			setSelectedById(changedNodeId, controller.isSelected(changedNodeId));
		persistSelection();
		props.onSelectionChange?.();
	};

	const selectAll = () => {
		const changed = controller.selectAll();
		applySelectionChanges(changed);
	};

	const deselectAll = () => {
		const changed = controller.deselectAll();
		applySelectionChanges(changed);
	};

	const visibleNodeIds = createMemo(() => {
		const hidden = new Set<string>();
		for (const nodeId of data.orderedNodeIds) {
			let parentId: string | undefined = data.nodes[nodeId]?.parentId;
			while (parentId && parentId !== '__root__') {
				if (collapsedById[parentId]) {
					hidden.add(nodeId);
					break;
				}
				parentId = data.nodes[parentId]?.parentId;
			}
		}
		return data.orderedNodeIds.filter((id) => !hidden.has(id));
	});

	const toggleCollapse = (nodeId: string) => {
		setCollapsedById(nodeId, !collapsedById[nodeId]);
	};

	return (
		<div class="webdav-sync-file-tree">
			<div class="webdav-sync-file-tree__toolbar">
				<button class="webdav-sync-file-tree__btn" onClick={selectAll}>
					{t('sync.selectAll')}
				</button>
				<button class="webdav-sync-file-tree__btn" onClick={deselectAll}>
					{t('sync.deselectAll')}
				</button>
			</div>
			<For each={visibleNodeIds()}>
				{(nodeId) => {
					const node = data.nodes[nodeId];
					const task = node.task;
					const hasKids = (node.childIds?.length ?? 0) > 0;
					const isCollapsed = collapsedById[nodeId];
					const icon = task
						? { color: getTaskColor(task.name), icon: getTaskIcon(task.name) }
						: { color: 'var(--text-normal)', icon: isCollapsed ? 'folder' : 'folder-open' };
					const rowClass = task && !selectedById[nodeId] ? 'is-unselected' : '';
					return (
						<div
							class={`webdav-sync-file-tree__row ${rowClass}`.trim()}
							style={{ 'padding-left': `${node.depth * 14}px` }}
						>
							<div
								class="webdav-sync-file-tree__main"
								onClick={() => {
									if (task) {
										const changed = controller.toggle(nodeId, !selectedById[nodeId]);
										applySelectionChanges(changed);
									}
								}}
							>
								{task ? (
									<input type="checkbox" checked={selectedById[nodeId]} />
								) : hasKids ? (
									<div
										class={`webdav-sync-file-tree__chevron ${isCollapsed ? 'is-collapsed' : ''}`}
										onClick={(e) => {
											e.stopPropagation();
											toggleCollapse(nodeId);
										}}
									/>
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
								<div
									class="webdav-sync-file-tree__label"
									onClick={hasKids ? (e) => { e.stopPropagation(); toggleCollapse(nodeId); } : undefined}
									style={hasKids ? { cursor: 'pointer' } : undefined}
								>
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
