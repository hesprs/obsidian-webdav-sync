import t from '~/i18n';
import { type BaseTask } from '~/sync/tasks/task.interface';

export default function getTaskName(task: BaseTask) {
	if (task.name) return t(`sync.fileOp.${task.name}`);
	return t('sync.fileOp.sync');
}
