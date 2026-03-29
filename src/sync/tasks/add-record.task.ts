import logger from '~/utils/logger';
import type { AddRecordTaskOptions } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError, type BaseTaskOptions } from './task.interface';

export default class AddRecordTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & AddRecordTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			const localStat = this.options.local?.stat;
			const remoteStat = this.options.remote;
			if (!localStat || !remoteStat)
				throw new Error(`Missing local file snapshot for push: ${this.localPath}`);
			await this.syncRecord.upsertSyncedFileFromSnapshots({
				localPath: this.localPath,
				remotePath: this.remotePath,
				localStat,
				remoteStat,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
