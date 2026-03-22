import { normalizeVaultPath } from '~/platform/path/vault-path';
import { isSub } from '~/utils/is-sub';
import RemoveLocalTask from '../tasks/remove-local.task';

export function mergeRemoveLocalTasks(tasks: RemoveLocalTask[]): RemoveLocalTask[] {
	if (tasks.length === 0) return [];

	const validTasks = tasks.filter((task) => normalizeVaultPath(task.localPath) !== '');
	if (validTasks.length === 0) return [];

	const sortedTasks = [...validTasks].sort((a, b) => {
		const pathA = normalizeVaultPath(a.localPath);
		const pathB = normalizeVaultPath(b.localPath);
		if (pathA.length !== pathB.length) {
			return pathA.length - pathB.length;
		}
		return pathA.localeCompare(pathB);
	});

	const result: RemoveLocalTask[] = [];
	const selectedPaths: string[] = [];

	for (const task of sortedTasks) {
		const path = normalizeVaultPath(task.localPath);

		const shouldSkip = selectedPaths.some((parentPath) => {
			if (path === parentPath) return true;
			return isSub(parentPath, path);
		});
		if (shouldSkip) continue;
		selectedPaths.push(path);
		result.push(task);
	}

	return result;
}
