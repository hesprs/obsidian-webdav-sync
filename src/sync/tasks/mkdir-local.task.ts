import { statItem } from '~/fs/vault';
import { type OptionsWithRemoteFolderStat } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask<OptionsWithRemoteFolderStat> {
	readonly name = 'createLocalDir';

	async exec() {
		try {
			await this.vault.adapter.mkdir(this.localPath);
			const local = await statItem(this.vault, this.localPath);
			if (!local || !local.isDir)
				throw new Error(
					`failed to read local directory stat after creation: ${this.localPath}`,
				);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote: this.remote,
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create local directory ${this.localPath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
