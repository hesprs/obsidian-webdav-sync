import logger from '~/utils/logger';
import type { OptionsWithRemoteStat } from '../decision/sync-decision.interface';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteTask extends BaseTask<OptionsWithRemoteStat> {
	readonly name = 'removeRemote';

	async exec() {
		try {
			await this.webdav.delete(this.key);
			await this.syncRecord.removeRecords(this.key);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove remote file \`${this.key}\``, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
