import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteTask extends BaseTask {
	async exec() {
		try {
			await this.webdav.deleteFile(this.remotePath);
			await this.syncRecord.removeRemoteRecordPath(this.remotePath);
			return { success: true, skipRecord: true } as const;
		} catch (e) {
			logger.error(`Failed to remove remote file ${this.remotePath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
