import type { BaseTask } from '~/sync/tasks/task.interface';
import i18n from '~/i18n';

export default function getTaskName(task: BaseTask) {
	if (task.name) return i18n.t(`sync.fileOp.${task.name}`);
	return i18n.t('sync.fileOp.sync');
}
