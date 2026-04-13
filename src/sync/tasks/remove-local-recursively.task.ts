import logger from '~/utils/logger';
import { trashFile } from '~/utils/trash-file-accordingly';
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
		} catch (e) {
			logger.error(`Failed to remove local directory ${this.remotePath} recursively`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
