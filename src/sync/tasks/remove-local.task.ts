import type { RemoveLocalTaskOptions } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class RemoveLocalTask extends BaseTask {
	constructor(public readonly options: BaseTaskOptions & RemoveLocalTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			const localSnapshot = this.options.local;
			const localStat = localSnapshot?.stat;
			const localFile = localSnapshot?.abstractFile;

			if (!localStat || !localFile) {
				throw new Error('missing local snapshot for remove: ' + this.localPath);
			}

			await this.vault.trash(localFile, false);

			if (localStat.isDir || this.options.recursive) {
				await this.syncRecord.removeLocalRecordSubtree(this.localPath);
			} else {
				await this.syncRecord.removeLocalRecordPath(this.localPath);
			}

			return { success: true, skipRecord: true } as const;
		} catch (e) {
			logger.error(`Failed to remove local file: ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
