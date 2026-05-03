import type { OptionsWithRemoteStat } from '~/sync/decision/sync-decision.interface';
import { resolveRemoteExecutionPath } from '~/utils/encryption';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class RemoveRemoteTask extends BaseTask<OptionsWithRemoteStat> {
	readonly name = 'removeRemote';

	async exec() {
		try {
			await this.webdav.deleteFile(await resolveRemoteExecutionPath(this.remotePath));
			await this.syncRecord.removeRecords(this.localPath);
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to remove remote file ${this.remotePath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
