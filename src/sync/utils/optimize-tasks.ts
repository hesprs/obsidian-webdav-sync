import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import { BaseTask } from '../tasks/task.interface';
import { mergeMkdirTasks } from './merge-mkdir-tasks';
import { mergeRemoveTasks } from './merge-remove-tasks';

function sortTasksByPathDepth<T extends BaseTask>(tasks: T[], getPath: (task: T) => string): T[] {
	return [...tasks].sort((a, b) => {
		const pathA = getPath(a);
		const pathB = getPath(b);
		if (pathA.length !== pathB.length) {
			return pathA.length - pathB.length;
		}
		return pathA.localeCompare(pathB);
	});
}

export function optimizeTasks(tasks: BaseTask[]): BaseTask[][] {
	const uniqueTasks = Array.from(new Set(tasks));
	const mkdirLocalTasks: MkdirLocalTask[] = [];
	const mkdirRemoteTasks: MkdirRemoteTask[] = [];
	const removeLocalTasks: RemoveLocalTask[] = [];
	const removeRemoteTasks: RemoveRemoteTask[] = [];
	const otherTasks: BaseTask[] = [];

	for (const task of uniqueTasks) {
		if (task instanceof MkdirLocalTask) mkdirLocalTasks.push(task);
		else if (task instanceof MkdirRemoteTask) mkdirRemoteTasks.push(task);
		else if (task instanceof RemoveLocalTask) removeLocalTasks.push(task);
		else if (task instanceof RemoveRemoteTask) removeRemoteTasks.push(task);
		else otherTasks.push(task);
	}

	return [
		...sortTasksByPathDepth(mkdirLocalTasks, (task) => task.localPath).map((task) => [task]),
		...mergeMkdirTasks(mkdirRemoteTasks).map((task) => [task]),
		[
			...otherTasks,
			...mergeRemoveTasks(removeRemoteTasks, 'remote'),
			...mergeRemoveTasks(removeLocalTasks, 'local'),
		],
	];
}
