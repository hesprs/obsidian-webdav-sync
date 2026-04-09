import type { OptionsWithLocalStat } from '~/sync/decision/sync-decision.interface';
import { arrayBufferToText } from '~/platform/binary';
import { getLocalContent } from '~/utils/get-content';
import logger from '~/utils/logger';
import { statWebDAVItem } from '~/utils/stat-item';
import { isMergeablePath } from '../utils/is-mergeable-path';
import { BaseTask, toTaskError } from './task.interface';

export default class PushTask extends BaseTask<OptionsWithLocalStat> {
	readonly name = 'upload';

	async exec() {
		try {
			let localContent: ArrayBuffer;
			try {
				localContent = await getLocalContent(this.vault, this.localPath);
			} catch {
				// ignore if local not found (which indicates that it has been deleted or renamed, common in case of a fast local change)
				logger.warn(`Failed to get local content at path \`${this.localPath}\``);
				return { success: true } as const;
			}

			const res = await this.webdav.putFileContents(this.remotePath, localContent, {
				overwrite: true,
			});
			if (!res) throw new Error('Upload failed');

			const remote = await statWebDAVItem(this.webdav, this.remotePath);
			if (!remote || remote.isDir)
				throw new Error(`failed to read remote file stat after push: ${this.localPath}`);

			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local: this.local,
				remote,
				baseText: isMergeablePath(this.localPath)
					? await arrayBufferToText(localContent)
					: undefined,
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
