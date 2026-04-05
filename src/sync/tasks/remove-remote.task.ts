import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteTask extends BaseTask {
	readonly name = 'removeRemote';

	async exec() {
		try {
			await this.webdav.deleteFile(this.remotePath);
			await this.syncRecord.removeRecords(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove remote file ${this.remotePath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
