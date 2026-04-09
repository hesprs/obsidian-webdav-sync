import { chunk } from 'lodash-es';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import { BaseTask } from '../tasks/task.interface';
import { mergeRemoveTasks } from './merge-remove-tasks';
import { sortMkdirTasks } from './sort-mkdir-tasks';

export function optimizeTasks(tasks: BaseTask[], chunkSize: number): BaseTask[][] {
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

	const finalTasks = [
		[
			...mergeRemoveTasks(removeRemoteTasks, 'remote'),
			...mergeRemoveTasks(removeLocalTasks, 'local'),
		],
		...sortMkdirTasks(mkdirLocalTasks),
		...sortMkdirTasks(mkdirRemoteTasks),
		otherTasks,
	].filter((tasks) => tasks.length > 0);
	return chunkSize === 0 ? finalTasks : finalTasks.flatMap((tasks) => chunk(tasks, chunkSize));
}
