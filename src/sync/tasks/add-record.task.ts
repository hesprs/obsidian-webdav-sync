import logger from '~/utils/logger';
import type { AddRecordTaskOptions } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError, type BaseTaskOptions } from './task.interface';

export default class AddRecordTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & AddRecordTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			const local = this.options.local?.stat;
			const remote = this.options.remote;
			if (!local || !remote)
				throw new Error(`Missing snapshot for add record: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
