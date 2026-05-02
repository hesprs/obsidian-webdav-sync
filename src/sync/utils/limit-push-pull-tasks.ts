import type { ToggleNumericSettingsField } from '~/types';
import type PushTask from '../tasks/push.task';
import PullTask from '../tasks/pull.task';
import { getAndDeleteAt, getLast } from './array-utils';

type ArrayOfTasks = Array<PushTask | PullTask>;

export default function limitPushPullTasks(
	tasks: ArrayOfTasks,
	chunk: ToggleNumericSettingsField,
	throughput: ToggleNumericSettingsField,
): Array<ArrayOfTasks> {
	if (tasks.length === 0 || (!chunk.enabled && !throughput.enabled)) return [tasks];
	// First-fit decreasing bin packing
	const sortedTasks = tasks
		.map((task) => {
			const size = task instanceof PullTask ? task.remote.size : task.local.size;
			return { size, task };
		})
		.sort((a, b) => b.size - a.size);
	const initialTask = getAndDeleteAt(sortedTasks, 0);
	const res: Array<ArrayOfTasks> = [[initialTask.task]];
	let throughputCounter = initialTask.size;
	while (sortedTasks.length !== 0) {
		const lastArray = getLast(res);
		let nextTask: { size: number; task: PushTask | PullTask } | undefined;
		if (!throughput.enabled && lastArray.length < chunk.value)
			nextTask = getAndDeleteAt(sortedTasks, 0);
		else
			for (const [index, task] of sortedTasks.entries()) {
				if (throughputCounter + task.size > throughput.value) continue;
				if ((chunk.enabled && lastArray.length < chunk.value) || !chunk.enabled)
					nextTask = getAndDeleteAt(sortedTasks, index);
				break;
			}
		if (!nextTask) {
			const firstTask = getAndDeleteAt(sortedTasks, 0);
			res.push([firstTask.task]);
			throughputCounter = firstTask.size;
		} else {
			lastArray.push(nextTask.task);
			throughputCounter += nextTask.size;
		}
	}
	return res;
}
