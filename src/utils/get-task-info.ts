import type { TaskNames } from '~/sync/tasks/task.interface';
import t from '~/i18n';

const RED_COLOR = 'var(--color-red)';
const BLUE_COLOR = 'var(--color-blue)';
const YELLOW_COLOR = 'var(--color-yellow)';

export function getTaskIcon(taskName: TaskNames): string {
	switch (taskName) {
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
		default: {
			return 'refresh-cw';
		}
	}
}

export function getTaskColor(taskName: TaskNames): string {
	switch (taskName) {
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
		default: {
			return BLUE_COLOR;
		}
	}
}

export function getTaskName(taskName: TaskNames) {
	if (taskName) return t(`sync.fileOp.${taskName}`);
	return t('sync.fileOp.sync');
}
