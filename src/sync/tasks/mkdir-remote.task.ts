import logger from '~/utils/logger';
import type { OptionsWithLocalFolderStat } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirRemoteTask extends BaseTask<OptionsWithLocalFolderStat> {
	readonly name = 'createRemoteDir';

	async exec() {
		try {
			await this.webdav.mkdir(this.key);
			await this.syncRecord.upsertRecords({
				key: this.key,
				record: { isDir: true },
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create remote directory: \`${this.key}\``, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
