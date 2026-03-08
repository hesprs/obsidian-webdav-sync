import i18n from '~/i18n';
import type { BaseTask } from '~/sync/tasks/task.interface';

export default function getTaskName(task: BaseTask) {
	if (task.constructor.name === 'SkippedTask') {
		const reason = (task.options as { reason?: string }).reason;
		const reasonText = reason
			? i18n.t(`sync.skipReason.${reason}` as any)
			: i18n.t('sync.fileOp.noop');
		return `${i18n.t('sync.fileOp.skip')}: ${reasonText}`;
	}

	switch (task.constructor.name) {
		case 'CleanRecordTask':
			return i18n.t('sync.fileOp.cleanRecord');
		case 'ConflictResolveTask':
			return i18n.t('sync.fileOp.merge');
		case 'FilenameErrorTask':
			return i18n.t('sync.fileOp.filenameError');
		case 'MkdirLocalTask':
			return i18n.t('sync.fileOp.createLocalDir');
		case 'MkdirRemoteTask':
			return i18n.t('sync.fileOp.createRemoteDir');
		case 'MkdirsRemoteTask':
			return i18n.t('sync.fileOp.createRemoteDirs');
		case 'NoopTask':
			return i18n.t('sync.fileOp.noop');
		case 'PullTask':
			return i18n.t('sync.fileOp.download');
		case 'PushTask':
			return i18n.t('sync.fileOp.upload');
		case 'RemoveLocalTask':
			return i18n.t('sync.fileOp.removeLocal');
		case 'RemoveRemoteTask':
			return i18n.t('sync.fileOp.removeRemote');
		case 'RemoveRemoteRecursivelyTask':
			return i18n.t('sync.fileOp.removeRemoteRecursively');
		default:
			return i18n.t('sync.fileOp.sync');
	}
}
