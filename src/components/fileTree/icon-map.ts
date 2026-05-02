import type { BaseTask } from '~/sync/tasks/task.interface';

const RED_COLOR = 'var(--color-red)';
const BLUE_COLOR = 'var(--color-blue)';
const YELLOW_COLOR = 'var(--color-yellow)';

export default function getTaskIcon(task: BaseTask): { icon: string; color: string } {
	switch (task.name) {
		case 'createRemoteDir': {
			return { color: BLUE_COLOR, icon: 'folder-up' };
		}
		case 'createLocalDir': {
			return { color: BLUE_COLOR, icon: 'folder-down' };
		}
		case 'download': {
			return { color: BLUE_COLOR, icon: 'file-down' };
		}
		case 'upload': {
			return { color: BLUE_COLOR, icon: 'file-up' };
		}
		case 'merge': {
			return { color: YELLOW_COLOR, icon: 'combine' };
		}
		case 'removeLocal':
		case 'removeLocalRecursively': {
			return { color: RED_COLOR, icon: 'file-x' };
		}
		case 'removeRemote':
		case 'removeRemoteRecursively': {
			return { color: RED_COLOR, icon: 'archive-x' };
		}
		case 'filenameError': {
			return { color: BLUE_COLOR, icon: 'alert-triangle' };
		}
		default: {
			return { color: BLUE_COLOR, icon: 'refresh-cw' };
		}
	}
}
