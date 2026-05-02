import type { BaseTask } from '~/sync/tasks/task.interface';

export type FileTreeNode = {
	id: string;
	name: string;
	path: string;
	depth: number;
	parentId?: string;
	childIds: Array<string>;
	task?: BaseTask;
	compressedLabel: string;
	isStructural: boolean;
	isTaskSelected: boolean;
	isFolderTask: boolean;
	isCreateFolderTask: boolean;
	isDeleteFolderTask: boolean;
	selectableDescendantTaskIds: Array<string>;
	ancestorTaskIds: Array<string>;
	ancestorCreateFolderTaskIds: Array<string>;
	ancestorDeleteFolderTaskIds: Array<string>;
};

export type FileTreeData = {
	orderedNodeIds: Array<string>;
	nodes: Record<string, FileTreeNode>;
	taskNodeIds: Array<string>;
};

export type FileTreeSelectionSnapshot = {
	selectedTasks: Array<BaseTask>;
	unselectedTasks: Array<BaseTask>;
};
