import type { OptionsWithRemoteFolderStat } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-item';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask<OptionsWithRemoteFolderStat> {
	readonly name = 'createLocalDir';

	async exec() {
		try {
			await this.vault.adapter.mkdir(this.localPath);
			const local = statVaultItem(this.vault, this.localPath);
			if (!local || !local.isDir)
				throw new Error(
					`failed to read local directory stat after creation: ${this.localPath}`,
				);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				remote: this.remote,
				local,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create local directory ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
