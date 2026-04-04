import type { BaseTask } from '~/sync/tasks/task.interface';
import i18n from '~/i18n';

export default function getTaskName(task: BaseTask) {
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
		case 'PullTask':
			return i18n.t('sync.fileOp.download');
		case 'PushTask':
			return i18n.t('sync.fileOp.upload');
		case 'RemoveLocalTask':
			return i18n.t('sync.fileOp.removeLocal');
		case 'RemoveLocalRecursivelyTask':
			return i18n.t('sync.fileOp.removeLocalRecursively');
		case 'RemoveRemoteTask':
			return i18n.t('sync.fileOp.removeRemote');
		case 'RemoveRemoteRecursivelyTask':
			return i18n.t('sync.fileOp.removeRemoteRecursively');
		default:
			return i18n.t('sync.fileOp.sync');
	}
}
