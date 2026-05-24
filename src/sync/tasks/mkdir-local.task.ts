import type { OptionsWithRemoteFolderStat } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask<OptionsWithRemoteFolderStat> {
	readonly name = 'createLocalDir';

	async exec() {
		try {
			await this.vault.adapter.mkdir(this.localPath);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local: { isDir: true, path: this.localPath },
				remote: this.remote,
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create local directory ${this.localPath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
