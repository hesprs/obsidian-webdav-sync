import type { PushTaskOptions } from '~/sync/decision/sync-decision.interface';
import { arrayBufferToText, toArrayBuffer } from '~/platform/binary';
import logger from '~/utils/logger';
import { statWebDAVItem } from '~/utils/stat-item';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PushTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & PushTaskOptions) {
		super(options);
	}
	readonly name = 'upload';

	async exec() {
		try {
			const localContent = this.options.local?.content;
			if (!localContent) {
				throw new Error('missing local content snapshot for push: ' + this.localPath);
			}
			const arrayBuffer = await toArrayBuffer(localContent);

			const res = await this.webdav.putFileContents(this.remotePath, arrayBuffer, {
				overwrite: true,
			});
			if (!res) throw new Error('Upload failed');

			// no race condition since we've just uploaded it
			const baseText = await arrayBufferToText(arrayBuffer);
			const local = this.options.local?.stat;
			if (!local || local.isDir) {
				throw new Error('missing local file snapshot for push: ' + this.localPath);
			}
			const remote = await statWebDAVItem(this.webdav, this.remotePath);
			if (!remote || remote.isDir)
				throw new Error(`failed to read remote file stat after push: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote,
				baseText,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(
				`Failed to push local file ${this.localPath} to remote path ${this.remotePath}`,
				e,
			);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
