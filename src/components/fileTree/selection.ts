import type { BaseTask } from '~/sync/tasks/task.interface';
import type { FileTreeData, FileTreeSelectionSnapshot } from './types';

export default class FileTreeSelectionController {
	private readonly selectedTaskIds = new Set<string>();

	constructor(private readonly data: FileTreeData) {
		for (const taskNodeId of data.taskNodeIds) this.selectedTaskIds.add(taskNodeId);
	}

	isSelected(nodeId: string): boolean {
		return this.selectedTaskIds.has(nodeId);
	}

	toggle(nodeId: string, nextSelected: boolean): Set<string> {
		const changed = new Set<string>();
		const node = this.data.nodes[nodeId];
		if (!node?.task) return changed;

		this.setSelected(nodeId, nextSelected, changed);

		// Cascade to descendants: folder tasks propagate selection both ways
		if (node.isCreateFolderTask || node.isDeleteFolderTask)
			for (const descendantId of node.selectableDescendantTaskIds)
				this.setSelected(descendantId, nextSelected, changed);

		// Cascade to ancestors
		if (nextSelected)
			for (const ancestorId of node.ancestorCreateFolderTaskIds)
				this.setSelected(ancestorId, true, changed);
		else
			for (const ancestorId of node.ancestorDeleteFolderTaskIds)
				this.setSelected(ancestorId, false, changed);

		return changed;
	}

	getSnapshot(): FileTreeSelectionSnapshot {
		const selectedTasks: Array<BaseTask> = [];
		const unselectedTasks: Array<BaseTask> = [];
		for (const taskNodeId of this.data.taskNodeIds) {
			const task = this.data.nodes[taskNodeId]?.task;
			if (!task) continue;
			if (this.selectedTaskIds.has(taskNodeId)) selectedTasks.push(task);
			else unselectedTasks.push(task);
		}
		return { selectedTasks, unselectedTasks };
	}

	selectAll(): Set<string> {
		const changed = new Set<string>();
		for (const taskNodeId of this.data.taskNodeIds)
			this.setSelected(taskNodeId, true, changed);
		return changed;
	}

	deselectAll(): Set<string> {
		const changed = new Set<string>();
		for (const taskNodeId of this.data.taskNodeIds)
			this.setSelected(taskNodeId, false, changed);
		return changed;
	}

	private setSelected(nodeId: string, nextSelected: boolean, changed: Set<string>) {
		const has = this.selectedTaskIds.has(nodeId);
		if (has === nextSelected) return;
		if (nextSelected) this.selectedTaskIds.add(nodeId);
		else this.selectedTaskIds.delete(nodeId);
		changed.add(nodeId);
	}
}
