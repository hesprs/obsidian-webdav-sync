import type { BaseTask } from '../tasks/task.interface';

export function sortMkdirTasks<T extends BaseTask>(tasks: T[]): T[][] {
	const levels: Record<number, T[]> = {};
	for (const task of tasks) {
		const depth = task.localPath.split('/').length;
		if (!levels[depth]) levels[depth] = [];
		levels[depth].push(task);
	}
	return Object.values(levels);
}
