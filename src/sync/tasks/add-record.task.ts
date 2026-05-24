import logger from '~/utils/logger';
import type { OptionsWithBothStats } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError } from './task.interface';

export default class AddRecordTask extends BaseTask<OptionsWithBothStats> {
	readonly name = 'addRecord';
	async exec() {
		try {
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local: this.local,
				remote: this.remote,
			});
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
