import logger from '~/utils/logger';
import type { OptionsWithLocalStat } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask<OptionsWithLocalStat> {
	readonly name = 'removeLocal';

	async exec() {
		try {
			await this.vault.delete(this.key);
			await this.syncRecord.removeRecords(this.key);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove local file: \`${this.key}\``, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
