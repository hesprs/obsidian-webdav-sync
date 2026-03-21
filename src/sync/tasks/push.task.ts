import type { PushTaskOptions } from '~/sync/decision/sync-decision.interface';
import { toArrayBuffer } from '~/platform/binary';
import logger from '~/utils/logger';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PushTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & PushTaskOptions) {
		super(options);
	}

	async exec() {
		try {
			const localStat = this.options.local?.stat;
			if (!localStat || localStat.isDir) {
				throw new Error('missing local file snapshot for push: ' + this.localPath);
			}

			const localContent = this.options.local?.content;
			if (!localContent) {
				throw new Error('missing local content snapshot for push: ' + this.localPath);
			}
			const arrayBuffer = await toArrayBuffer(localContent);

			const res = await this.webdav.putFileContents(this.remotePath, arrayBuffer, {
				overwrite: true,
			});
			if (!res) throw new Error('Upload failed');

			await this.syncRecord.upsertSyncedFileFromLocalSnapshot({
				localPath: this.localPath,
				remotePath: this.remotePath,
				localStat,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to push file ${this.localPath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
