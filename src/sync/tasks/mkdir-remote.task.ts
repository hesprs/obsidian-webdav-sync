import { statItem } from '~/fs/webdav';
import { type OptionsWithLocalFolderStat } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirRemoteTask extends BaseTask<OptionsWithLocalFolderStat> {
	readonly name = 'createRemoteDir';

	async exec() {
		try {
			await this.webdav.createDirectory(this.remotePath);
			const remote = await statItem(this.webdav, this.remotePath);

			if (!remote || !remote.isDir)
				throw new Error(
					`failed to read remote directory stat after creation: ${this.remotePath}`,
				);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local: this.local,
				remote,
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to create remote directory: ${this.remotePath}`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
