import { isSub } from '~/utils/path';
import type RemoveLocalTask from '../tasks/remove-local.task';
import type RemoveRemoteTask from '../tasks/remove-remote.task';
import type { BaseTask } from '../tasks/task.interface';
import RemoveLocalRecursivelyTask from '../tasks/remove-local-recursively.task';
import RemoveRemoteRecursivelyTask from '../tasks/remove-remote-recursively.task';

export default function mergeRemoveTasks<T extends 'remote' | 'local'>(
	tasks: T extends 'remote' ? Array<RemoveRemoteTask> : Array<RemoveLocalTask>,
	source: T,
): Array<BaseTask> {
	if (tasks.length === 0) return [];

	// 过滤掉空路径或无效任务
	const validTasks = tasks.filter((task) => task.key !== '/');

	if (validTasks.length === 0) return [];

	// 按路径长度排序，短的在前（父路径优先）
	// 如果长度相同，按字典序排序，保证结果稳定
	const sortedTasks = [...validTasks].sort((a, b) => {
		const pathA = a.key.split('/');
		const pathB = b.key.split('/');
		if (pathA.length !== pathB.length) return pathA.length - pathB.length;
		return a.key.localeCompare(b.key);
	});

	const result: Array<BaseTask> = [];
	const selectedPaths: Array<string> = [];

	for (const task of sortedTasks) {
		const path = task.key;

		// 检查当前路径是否是已选路径的子路径或重复路径
		const shouldSkip = selectedPaths.some((parentPath) => {
			if (path === parentPath) return true;
			return isSub(parentPath, path);
		});

		if (!shouldSkip) {
			const hasDescendants = sortedTasks.some((candidate) => {
				if (candidate === task) return false;
				return isSub(path, candidate.key);
			});

			selectedPaths.push(path);
			result.push(
				hasDescendants
					? source === 'remote'
						? new RemoveRemoteRecursivelyTask(task.options)
						: new RemoveLocalRecursivelyTask(task.options)
					: task,
			);
		}
	}

	return result;
}
