import type { MkdirRemoteTaskOptions } from '~/sync/decision/sync-decision.interface';
import logger from '~/utils/logger';
import { statWebDAVItem } from '~/utils/stat-webdav-item';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class MkdirRemoteTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & MkdirRemoteTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			await this.webdav.createDirectory(this.remotePath, {
				recursive: true,
			});

			const remote = await statWebDAVItem(this.webdav, this.remotePath);
			const local = this.options.local?.stat;
			if (!remote || !remote.isDir || !local)
				throw new Error(
					`failed to read remote directory stat after creation: ${this.remotePath}`,
				);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create remote directory: ${this.remotePath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
