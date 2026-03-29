import logger from '~/utils/logger';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask {
	constructor(public readonly options: BaseTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			const file = this.vault.getAbstractFileByPath(this.localPath);
			if (!file) return { success: true } as const;

			await this.vault.trash(file, false);
			await this.syncRecord.removeLocalRecordPath(this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to remove local file: ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
