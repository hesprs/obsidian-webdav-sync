import type { MkdirLocalTaskOptions } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-vault-item';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & MkdirLocalTaskOptions) {
		super(options);
	}
	readonly name = 'createLocalDir';

	async exec() {
		try {
			const segments = this.localPath.split('/').filter((segment) => segment !== '');
			let currentPath = '';
			for (const segment of segments) {
				currentPath = currentPath ? `${currentPath}/${segment}` : segment;
				try {
					await this.vault.adapter.mkdir(currentPath);
				} catch {
					// Ignore existing-dir and parent creation races.
				}
			}
			const local = statVaultItem(this.vault, this.localPath);
			const remote = this.options.remote?.stat;
			if (!local || !local.isDir || !remote)
				throw new Error(
					`failed to read local directory stat after creation: ${this.localPath}`,
				);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				remote,
				local,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create local directory ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
