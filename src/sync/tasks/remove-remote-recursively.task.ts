import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteRecursivelyTask extends BaseTask {
	async exec() {
		try {
			await this.webdav.deleteFile(this.remotePath);
			await this.syncRecord.removeRecordSubtree(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove remote directory ${this.remotePath} recursively`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
