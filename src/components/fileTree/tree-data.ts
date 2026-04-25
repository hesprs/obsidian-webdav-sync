import type { BaseTask } from '~/sync/tasks/task.interface';
import type { FileTreeData, FileTreeNode } from './types';

interface MutableNode extends Omit<
	FileTreeNode,
	| 'selectableDescendantTaskIds'
	| 'ancestorTaskIds'
	| 'ancestorCreateFolderTaskIds'
	| 'ancestorDeleteFolderTaskIds'
	| 'compressedLabel'
> {
	selectableDescendantTaskIds: string[];
	ancestorTaskIds: string[];
	ancestorCreateFolderTaskIds: string[];
	ancestorDeleteFolderTaskIds: string[];
	compressedLabel: string;
}

interface VisibleEndpoint {
	nodeId: string;
	depth: number;
	labelSegments: string[];
}

function getPathSegments(path: string): string[] {
	return path.split('/').filter(Boolean);
}

function isFolderTask(task: BaseTask): boolean {
	if (task.name === 'createLocalDir' || task.name === 'createRemoteDir') return true;
	if (task.name === 'removeLocal' || task.name === 'removeLocalRecursively') {
		return task.local?.isDir === true;
	}
	if (task.name === 'removeRemote' || task.name === 'removeRemoteRecursively') {
		return task.remote?.isDir === true;
	}
	return false;
}

function isCreateFolderTask(task: BaseTask): boolean {
	return task.name === 'createLocalDir' || task.name === 'createRemoteDir';
}

function isDeleteFolderTask(task: BaseTask): boolean {
	if (task.name === 'removeLocal' || task.name === 'removeLocalRecursively') {
		return task.local?.isDir === true;
	}
	if (task.name === 'removeRemote' || task.name === 'removeRemoteRecursively') {
		return task.remote?.isDir === true;
	}
	return false;
}

function createNode(input: {
	id: string;
	name: string;
	path: string;
	depth: number;
	parentId?: string;
	task?: BaseTask;
}): MutableNode {
	const task = input.task;
	return {
		id: input.id,
		name: input.name,
		path: input.path,
		depth: input.depth,
		parentId: input.parentId,
		childIds: [],
		task,
		compressedLabel: input.name,
		isStructural: task === undefined,
		isTaskSelected: task !== undefined,
		isFolderTask: task ? isFolderTask(task) : false,
		isCreateFolderTask: task ? isCreateFolderTask(task) : false,
		isDeleteFolderTask: task ? isDeleteFolderTask(task) : false,
		selectableDescendantTaskIds: [],
		ancestorTaskIds: [],
		ancestorCreateFolderTaskIds: [],
		ancestorDeleteFolderTaskIds: [],
	};
}

function applyTaskToNode(node: MutableNode, task: BaseTask) {
	node.task = task;
	node.isStructural = false;
	node.isTaskSelected = true;
	node.isFolderTask = isFolderTask(task);
	node.isCreateFolderTask = isCreateFolderTask(task);
	node.isDeleteFolderTask = isDeleteFolderTask(task);
}

function sortNodeChildren(nodes: Record<string, MutableNode>, nodeId: string) {
	nodes[nodeId].childIds.sort((leftId, rightId) => {
		const left = nodes[leftId];
		const right = nodes[rightId];
		if (left.isStructural !== right.isStructural) return left.isStructural ? -1 : 1;
		if (left.isFolderTask !== right.isFolderTask) return left.isFolderTask ? -1 : 1;
		return left.name.localeCompare(right.name);
	});
}

function resolveVisibleEndpoint(
	nodes: Record<string, MutableNode>,
	startNode: MutableNode,
): VisibleEndpoint {
	const labelSegments = [startNode.name];
	let current = startNode;
	while (current.task === undefined && current.childIds.length === 1) {
		const child = nodes[current.childIds[0]];
		labelSegments.push(child.name);
		current = child;
	}
	return { nodeId: current.id, depth: startNode.depth, labelSegments };
}

function getCompressedLabel(nodes: Record<string, MutableNode>, node: MutableNode): string {
	return resolveVisibleEndpoint(nodes, node).labelSegments.join('/');
}

function getVisibleChildren(
	nodes: Record<string, MutableNode>,
	node: MutableNode,
): VisibleEndpoint[] {
	const visibleChildren: VisibleEndpoint[] = [];
	for (const childId of node.childIds) {
		visibleChildren.push(resolveVisibleEndpoint(nodes, nodes[childId]));
	}
	return visibleChildren;
}

function traverseVisible(
	nodes: Record<string, MutableNode>,
	nodeId: string,
	orderedNodeIds: string[],
	visibleEndpoint?: VisibleEndpoint,
) {
	if (visibleEndpoint) {
		const node = nodes[nodeId];
		node.depth = visibleEndpoint.depth;
		node.compressedLabel = visibleEndpoint.labelSegments.join('/');
	}
	orderedNodeIds.push(nodeId);
	for (const child of getVisibleChildren(nodes, nodes[nodeId])) {
		traverseVisible(nodes, child.nodeId, orderedNodeIds, child);
	}
}

function collectSelectableDescendantTaskIds(
	nodes: Record<string, MutableNode>,
	nodeId: string,
): string[] {
	const node = nodes[nodeId];
	const descendantIds: string[] = [];
	for (const childId of node.childIds) {
		const child = nodes[childId];
		if (child.task !== undefined) descendantIds.push(child.id);
		descendantIds.push(...collectSelectableDescendantTaskIds(nodes, childId));
	}
	node.selectableDescendantTaskIds = descendantIds;
	return descendantIds;
}

function annotateAncestors(
	nodes: Record<string, MutableNode>,
	nodeId: string,
	ancestorTaskIds: string[],
	ancestorCreateFolderTaskIds: string[],
	ancestorDeleteFolderTaskIds: string[],
) {
	const node = nodes[nodeId];
	node.ancestorTaskIds = ancestorTaskIds;
	node.ancestorCreateFolderTaskIds = ancestorCreateFolderTaskIds;
	node.ancestorDeleteFolderTaskIds = ancestorDeleteFolderTaskIds;

	for (const childId of node.childIds) {
		const child = nodes[childId];
		const nextTaskIds = child.task ? [...ancestorTaskIds, child.id] : ancestorTaskIds;
		const nextCreateIds = child.isCreateFolderTask
			? [...ancestorCreateFolderTaskIds, child.id]
			: ancestorCreateFolderTaskIds;
		const nextDeleteIds = child.isDeleteFolderTask
			? [...ancestorDeleteFolderTaskIds, child.id]
			: ancestorDeleteFolderTaskIds;
		annotateAncestors(nodes, childId, nextTaskIds, nextCreateIds, nextDeleteIds);
	}
}

export function createFileTreeData(tasks: BaseTask[]): FileTreeData {
	const nodes: Record<string, MutableNode> = {
		__root__: createNode({ id: '__root__', name: '', path: '', depth: -1 }),
	};
	const taskNodeIds: string[] = [];
	const taskNodeIdSet = new Set<string>();

	for (const task of tasks) {
		const segments = getPathSegments(task.localPath);
		let parentId = '__root__';
		let currentPath = '';
		for (const [index, segment] of segments.entries()) {
			currentPath = currentPath ? `${currentPath}/${segment}` : segment;
			const nodeId = currentPath;
			const isLeaf = index === segments.length - 1;
			const existing = nodes[nodeId];
			if (!existing) {
				nodes[nodeId] = createNode({
					id: nodeId,
					name: segment,
					path: currentPath,
					depth: index,
					parentId,
					task: isLeaf ? task : undefined,
				});
				nodes[parentId].childIds.push(nodeId);
			} else if (isLeaf) {
				applyTaskToNode(existing, task);
			}
			parentId = nodeId;
		}
		const leafNodeId = task.localPath;
		if (!taskNodeIdSet.has(leafNodeId)) {
			taskNodeIdSet.add(leafNodeId);
			taskNodeIds.push(leafNodeId);
		}
	}

	for (const nodeId of Object.keys(nodes)) {
		sortNodeChildren(nodes, nodeId);
	}

	for (const nodeId of Object.keys(nodes)) {
		if (nodeId === '__root__') continue;
		nodes[nodeId].compressedLabel = getCompressedLabel(nodes, nodes[nodeId]);
	}

	collectSelectableDescendantTaskIds(nodes, '__root__');
	annotateAncestors(nodes, '__root__', [], [], []);

	const orderedNodeIds: string[] = [];
	for (const childId of getVisibleChildren(nodes, nodes.__root__)) {
		traverseVisible(nodes, childId.nodeId, orderedNodeIds, childId);
	}

	const finalNodes = Object.fromEntries(
		Object.entries(nodes).filter(([nodeId]) => nodeId !== '__root__'),
	) as Record<string, FileTreeNode>;

	return {
		orderedNodeIds,
		nodes: finalNodes,
		taskNodeIds,
	};
}
