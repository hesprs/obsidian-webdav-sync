import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask {
	readonly name = 'removeLocal';

	async exec() {
		try {
			const file = this.vault.getAbstractFileByPath(this.localPath);
			if (!file) return { success: true } as const;

			await this.vault.trash(file, false);
			await this.syncRecord.removeRecords(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove local file: ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
