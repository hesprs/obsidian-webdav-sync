import { normalizeRemoteDir } from '~/platform/path/remote-path';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteRecursivelyTask extends BaseTask {
	async exec() {
		try {
			await this.webdav.deleteFile(normalizeRemoteDir(this.remotePath));
			await this.syncRecord.removeRemoteRecordSubtree(this.remotePath);
			return { success: true, skipRecord: true } as const;
		} catch (e) {
			logger.error(`Failed to remove remote directory ${this.remotePath} recursively`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
