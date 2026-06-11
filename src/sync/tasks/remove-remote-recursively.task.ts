import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteRecursivelyTask extends BaseTask {
	readonly name = 'removeRemoteRecursively';

	async exec() {
		try {
			await this.webdav.delete(this.key);
			await this.syncRecord.removeRecordSubtree(this.key);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove remote directory \`${this.key}\` recursively`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
