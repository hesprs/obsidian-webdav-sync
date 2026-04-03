import type { PushTaskOptions } from '~/sync/decision/sync-decision.interface';
import { toArrayBuffer } from '~/platform/binary';
import logger from '~/utils/logger';
import { statWebDAVItem } from '~/utils/stat-webdav-item';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PushTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & PushTaskOptions) {
		super(options);
	}

	private async toText(content: ArrayBuffer) {
		return await new Blob([new Uint8Array(content)]).text();
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

			// no race condition since we've just uploaded it
			const baseText = await this.toText(arrayBuffer);
			const remoteStat = await statWebDAVItem(this.webdav, this.remotePath);
			if (!remoteStat || remoteStat.isDir)
				throw new Error(`failed to read remote file stat after push: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				localStat,
				remoteStat,
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
