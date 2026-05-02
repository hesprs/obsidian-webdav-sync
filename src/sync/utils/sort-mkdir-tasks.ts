import type { BaseTask } from '../tasks/task.interface';

export default function sortMkdirTasks<T extends BaseTask>(tasks: Array<T>): Array<Array<T>> {
	const levels: Record<number, Array<T>> = {};
	for (const task of tasks) {
		const depth = task.localPath.split('/').length;
		if (!levels[depth]) levels[depth] = [];
		levels[depth].push(task);
	}
	return Object.values(levels);
}
