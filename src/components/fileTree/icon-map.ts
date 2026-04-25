import type { BaseTask } from '~/sync/tasks/task.interface';

const RED_COLOR = 'var(--color-red)';
const BLUE_COLOR = 'var(--color-blue)';
const YELLOW_COLOR = 'var(--color-yellow)';

export function getTaskIcon(task: BaseTask): { icon: string; color: string } {
	switch (task.name) {
		case 'createRemoteDir':
			return { icon: 'folder-up', color: BLUE_COLOR };
		case 'createLocalDir':
			return { icon: 'folder-down', color: BLUE_COLOR };
		case 'download':
			return { icon: 'file-down', color: BLUE_COLOR };
		case 'upload':
			return { icon: 'file-up', color: BLUE_COLOR };
		case 'merge':
			return { icon: 'combine', color: YELLOW_COLOR };
		case 'removeLocal':
		case 'removeLocalRecursively':
			return { icon: 'file-x', color: RED_COLOR };
		case 'removeRemote':
		case 'removeRemoteRecursively':
			return { icon: 'archive-x', color: RED_COLOR };
		case 'filenameError':
			return { icon: 'alert-triangle', color: BLUE_COLOR };
		default:
			return { icon: 'refresh-cw', color: BLUE_COLOR };
	}
}
