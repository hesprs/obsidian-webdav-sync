import type { BaseTask } from '~/sync/tasks/task.interface';
import { default as t } from '~/i18n';

export default function getTaskName(task: BaseTask) {
	if (task.name) return t(`sync.fileOp.${task.name}`);
	return t('sync.fileOp.sync');
}
