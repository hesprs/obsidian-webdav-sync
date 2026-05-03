import { resolveRemoteExecutionPath } from '~/utils/encryption';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteRecursivelyTask extends BaseTask {
	readonly name = 'removeRemoteRecursively';

	async exec() {
		try {
			await this.webdav.deleteFile(await resolveRemoteExecutionPath(this.remotePath));
			await this.syncRecord.removeRecordSubtree(this.localPath);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove remote directory ${this.remotePath} recursively`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
