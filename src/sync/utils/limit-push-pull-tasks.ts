import type { ToggleNumericSettingsField } from '~/types';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';

type ArrayOfTasks = Array<PushTask | PullTask>;

export default function limitPushPullTasks(
	tasks: ArrayOfTasks,
	chunk: ToggleNumericSettingsField,
	throughput: ToggleNumericSettingsField,
): Array<ArrayOfTasks> {
	if (tasks.length === 0 || (!chunk.enabled && !throughput.enabled)) return [tasks];
	// first-fit decreasing bin packing
	const sortedTasks = tasks
		.map((task) => {
			let size = 0;
			if (task instanceof PullTask) size = task.options.remote.size;
			else size = task.options.local.size;
			return { size, task };
		})
		.sort((a, b) => b.size - a.size);
	const firstTask = getAndDeleteAt(sortedTasks, 0);
	const res: Array<ArrayOfTasks> = [[firstTask.task]];
	let throughputCounter = firstTask.size;
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

function getLast<T>(arr: Array<T>): T {
	return arr[arr.length - 1];
}

function getAndDeleteAt<T>(arr: Array<T>, index: number): T {
	return arr.splice(index, 1)[0];
}
