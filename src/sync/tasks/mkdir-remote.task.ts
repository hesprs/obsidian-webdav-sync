import type { OptionsWithLocalFolderStat } from '~/sync/decision/sync-decision.interface';
import { resolveRemoteExecutionPath } from '~/utils/encryption';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirRemoteTask extends BaseTask<OptionsWithLocalFolderStat> {
	readonly name = 'createRemoteDir';

	async exec() {
		try {
			const executionRemotePath = await resolveRemoteExecutionPath(this.remotePath);
			await this.webdav.createDirectory(executionRemotePath);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local: this.local,
				remote: { isDir: true, path: this.remotePath },
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create remote directory: ${this.remotePath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
