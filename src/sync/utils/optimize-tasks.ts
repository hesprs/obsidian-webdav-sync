import type { ToggleNumericSettingsField } from '~/types';
import { chunk, zipMerge } from '~/utils/fns';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import { BaseTask } from '../tasks/task.interface';
import limitPushPullTasks from './limit-push-pull-tasks';
import { mergeRemoveTasks } from './merge-remove-tasks';
import { sortMkdirTasks } from './sort-mkdir-tasks';

export function optimizeTasks(
	tasks: BaseTask[],
	chunk: ToggleNumericSettingsField,
	throughput: ToggleNumericSettingsField,
): BaseTask[][] {
	const uniqueTasks = Array.from(new Set(tasks));
	const mkdirLocalTasks: MkdirLocalTask[] = [];
	const mkdirRemoteTasks: MkdirRemoteTask[] = [];
	const removeLocalTasks: RemoveLocalTask[] = [];
	const removeRemoteTasks: RemoveRemoteTask[] = [];
	const pushPullTasks: (PushTask | PullTask)[] = [];
	const otherTasks: BaseTask[] = [];

	for (const task of uniqueTasks) {
		if (task instanceof MkdirLocalTask) mkdirLocalTasks.push(task);
		else if (task instanceof MkdirRemoteTask) mkdirRemoteTasks.push(task);
		else if (task instanceof RemoveLocalTask) removeLocalTasks.push(task);
		else if (task instanceof RemoveRemoteTask) removeRemoteTasks.push(task);
		else if (task instanceof PushTask || task instanceof PullTask) pushPullTasks.push(task);
		else otherTasks.push(task);
	}

	return [
		...chunkOrNot(
			[
				...mergeRemoveTasks(removeRemoteTasks, 'remote'),
				...mergeRemoveTasks(removeLocalTasks, 'local'),
				...otherTasks,
			],
			chunk,
		),
		...zipMerge<BaseTask>(
			sortMkdirTasks(mkdirLocalTasks),
			sortMkdirTasks(mkdirRemoteTasks),
		).flatMap((tasks) => chunkOrNot(tasks, chunk)),
		...limitPushPullTasks(pushPullTasks, chunk, throughput),
	].filter((tasks) => tasks.length > 0);
}

function chunkOrNot<A>(arr: Array<A>, chunkOption: ToggleNumericSettingsField): A[][] {
	return chunkOption.enabled ? chunk(arr, chunkOption.value) : [arr];
}
