import type { OptionsWithLocalFileStat } from '~/sync/decision/sync-decision.interface';
import { getContent } from '~/fs/vault';
import { statItem } from '~/fs/webdav';
import { arrayBufferToText } from '~/platform/binary';
import logger from '~/utils/logger';
import isMergeablePath from '../utils/is-mergeable-path';
import { BaseTask, toTaskError } from './task.interface';

export default class PushTask extends BaseTask<OptionsWithLocalFileStat> {
	readonly name = 'upload';

	async exec() {
		try {
			let localContent: ArrayBuffer;
			try {
				localContent = await getContent(this.vault, this.localPath);
			} catch {
				// Ignore if local not found (which indicates that it has been deleted or renamed, common in case of a fast local change)
				logger.warn(`Failed to get local content at path \`${this.localPath}\``);
				return { success: true } as const;
			}

			const res = await this.webdav.putFileContents(this.remotePath, localContent, {
				overwrite: true,
			});
			if (!res) throw new Error('Upload failed');

			const remote = await statItem(this.webdav, this.remotePath);
			if (!remote || remote.isDir)
				throw new Error(`failed to read remote file stat after push: ${this.localPath}`);

			await this.syncRecord.upsertRecords({
				baseText: isMergeablePath(this.localPath)
					? await arrayBufferToText(localContent)
					: undefined,
				key: this.localPath,
				local: this.local,
				remote,
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(
				`Failed to push local file ${this.localPath} to remote path ${this.remotePath}`,
				error,
			);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
