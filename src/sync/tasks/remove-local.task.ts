import type { OptionsWithLocalStat } from '~/sync/decision/sync-decision.interface';
import { trashFile } from '~/fs/vault';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask<OptionsWithLocalStat> {
	readonly name = 'removeLocal';

	async exec() {
		try {
			const exists = await this.vault.adapter.exists(this.localPath);
			if (!exists) return { success: true } as const;

			await trashFile(this.vault, this.localPath);
			await this.syncRecord.removeRecords(this.localPath);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove local file: ${this.localPath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
