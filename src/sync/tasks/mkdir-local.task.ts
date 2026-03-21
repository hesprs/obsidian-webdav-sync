import type { MkdirLocalTaskOptions } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & MkdirLocalTaskOptions) {
		super(options);
	}

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

			await this.syncRecord.upsertSyncedDirectoryFromRemoteSnapshot({
				localPath: this.localPath,
				remotePath: this.remotePath,
				remoteStat: this.options.remote?.stat,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create local directory ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
