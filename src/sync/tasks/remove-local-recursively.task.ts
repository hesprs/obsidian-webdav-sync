import { trashFile } from '~/fs/vault';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalRecursivelyTask extends BaseTask {
	readonly name = 'removeLocalRecursively';

	async exec() {
		try {
			const exists = await this.vault.adapter.exists(this.localPath);
			if (!exists) return { success: true } as const;

			await trashFile(this.vault, this.localPath);
			await this.syncRecord.removeRecordSubtree(this.localPath);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove local directory ${this.remotePath} recursively`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
