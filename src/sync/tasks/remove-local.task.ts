import logger from '~/utils/logger';
import { trashFile } from '~/utils/trash-file-accordingly';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask {
	readonly name = 'removeLocal';

	async exec() {
		try {
			const exists = await this.vault.adapter.exists(this.localPath);
			if (!exists) return { success: true } as const;

			await trashFile(this.vault, this.localPath);
			await this.syncRecord.removeRecords(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove local file: ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
