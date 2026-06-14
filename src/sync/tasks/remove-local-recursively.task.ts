import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalRecursivelyTask extends BaseTask {
	readonly name = 'removeLocalRecursively';

	async exec() {
		try {
			await this.vault.delete(this.key);
			await this.syncRecord.removeRecordSubtree(this.key);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove local directory \`${this.key}\` recursively`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
