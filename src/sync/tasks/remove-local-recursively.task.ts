import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalRecursivelyTask extends BaseTask {
	readonly name = 'removeLocalRecursively';

	async exec() {
		try {
			const file = this.vault.getAbstractFileByPath(this.localPath);
			if (!file) return { success: true } as const;

			await this.vault.trash(file, false);
			await this.syncRecord.removeRecordSubtree(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove local directory ${this.remotePath} recursively`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
