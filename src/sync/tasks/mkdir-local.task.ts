import type { OptionsWithRemoteFolderStat } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask<OptionsWithRemoteFolderStat> {
	readonly name = 'createLocalDir';

	async exec() {
		try {
			await this.vault.mkdir(this.key);
			await this.syncRecord.upsertRecords({
				key: this.key,
				record: { isDir: true },
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create local directory \`${this.key}\``, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
