import type { BaseTask } from '~/sync/tasks/task.interface';

const RED_COLOR = 'var(--color-red)';
const BLUE_COLOR = 'var(--color-blue)';
const YELLOW_COLOR = 'var(--color-yellow)';

export function getTaskIcon(task: BaseTask): string {
	switch (task.name) {
		case 'createRemoteDir': {
			return 'folder-up';
		}
		case 'createLocalDir': {
			return 'folder-down';
		}
		case 'download': {
			return 'file-down';
		}
		case 'upload': {
			return 'file-up';
		}
		case 'merge': {
			return 'combine';
		}
		case 'removeLocal':
		case 'removeLocalRecursively': {
			return 'file-x';
		}
		case 'removeRemote':
		case 'removeRemoteRecursively': {
			return 'archive-x';
		}
		case 'filenameError': {
			return 'alert-triangle';
		}
		default: {
			return 'refresh-cw';
		}
	}
}

export function getTaskColor(task: BaseTask): string {
	switch (task.name) {
		case 'merge': {
			return YELLOW_COLOR;
		}
		case 'removeLocal':
		case 'removeLocalRecursively':
		case 'removeRemote':
		case 'removeRemoteRecursively': {
			return RED_COLOR;
		}
		case 'createRemoteDir':
		case 'createLocalDir':
		case 'download':
		case 'upload':
		case 'filenameError':
		default: {
			return BLUE_COLOR;
		}
	}
}
