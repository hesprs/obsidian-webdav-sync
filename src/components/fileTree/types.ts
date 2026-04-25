import type { BaseTask } from '~/sync/tasks/task.interface';

export interface FileTreeNode {
	id: string;
	name: string;
	path: string;
	depth: number;
	parentId?: string;
	childIds: string[];
	task?: BaseTask;
	compressedLabel: string;
	isStructural: boolean;
	isTaskSelected: boolean;
	isFolderTask: boolean;
	isCreateFolderTask: boolean;
	isDeleteFolderTask: boolean;
	selectableDescendantTaskIds: string[];
	ancestorTaskIds: string[];
	ancestorCreateFolderTaskIds: string[];
	ancestorDeleteFolderTaskIds: string[];
}

export interface FileTreeData {
	orderedNodeIds: string[];
	nodes: Record<string, FileTreeNode>;
	taskNodeIds: string[];
}

export interface FileTreeSelectionSnapshot {
	selectedTasks: BaseTask[];
	unselectedTasks: BaseTask[];
}
