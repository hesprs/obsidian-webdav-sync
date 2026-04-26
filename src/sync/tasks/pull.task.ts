import { statItem } from '~/fs/vault';
import { getContent } from '~/fs/webdav';
import { arrayBufferToText, toArrayBuffer, type BinaryLike } from '~/platform/binary';
import { useSettings } from '~/settings';
import logger from '~/utils/logger';
import type { OptionsWithRemoteFileStat } from '../decision/sync-decision.interface';
import { isMergeablePath } from '../utils/is-mergeable-path';
import { getStdChunkSize, splitChunks } from '../utils/split-chunks';
import { BaseTask, toTaskError } from './task.interface';

export default class PullTask extends BaseTask<OptionsWithRemoteFileStat> {
	readonly name = 'download';

	async exec() {
		try {
			const maxThroughput = (await useSettings()).maxThroughputConcurrency;
			const chunkSize = getStdChunkSize(maxThroughput, 4);
			const cache =
				this.remote.size <= chunkSize
					? []
					: await this.syncRecord.getFileChunkKeys(this.remote);
			const split = splitChunks(this.remote.size, maxThroughput, 4, cache, chunkSize);
			let remoteContent: ArrayBuffer | undefined;

			if (split) {
				logger.debug(`Pulling large file \`${this.remotePath}\` in chunks.`);
				for (const group of split) {
					await Promise.all(
						group.map(async ({ start, end }) => {
							const buffer = await toArrayBuffer(
								(await this.webdav.getFileContents(this.remotePath, {
									headers: { Range: `bytes=${start}-${end}` },
								})) as BinaryLike,
							);
							await this.syncRecord.setFileChunk(buffer, {
								start,
								end,
								...this.remote,
							});
						}),
					);
				}
				const keys = (await this.syncRecord.getFileChunkKeys(this.remote))
					.sort((a, b) => a.start - b.start)
					.map(({ key }) => key);
				for (const key of keys) {
					const buffer = await this.syncRecord.getFileChunk(key);
					if (!buffer) throw new Error(`File chunk not found: ${key}`);
					await this.vault.adapter.appendBinary(this.localPath, buffer, {
						ctime: this.remote.mtime - 1000, // #1
					});
				}
				await this.syncRecord.removeFileChunk(this.remotePath);
			} else {
				remoteContent = await getContent(this.webdav, this.remotePath);
				await this.vault.adapter.writeBinary(this.localPath, remoteContent, {
					ctime: this.remote.mtime - 1000, // #1
				});
			}

			// no race condition since we've just written it
			const local = await statItem(this.vault, this.localPath);
			if (!local || local.isDir)
				throw new Error(`failed to read local file stat after pull: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote: this.remote,
				baseText:
					isMergeablePath(this.localPath) && remoteContent
						? await arrayBufferToText(remoteContent)
						: undefined,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}

/* #1 Solves incompatibility between this plugin and obsidian-paste-image-rename

When "Handle all attachments" is enabled, paste-image-rename checks every file write (except .md) in vault and tries to rename them.

During syncing, when files are downloaded, Paste-image-rename tries to rename all of them, causing severe rename chaos. If real-time sync is enabled, the file rename will in return trigger an auto sync, which will cause server chaos as well.

When ctime is more than 1 seconds ago, paste-image-rename will not rename the file: https://github.com/reorx/obsidian-paste-image-rename/blob/3801513c406a86ad90c94a1bd7c95c6b837e063d/src/main.ts#L81

So the only solution is to re-generate a ctime at local file creation. Which is set to server modification time - 1s.
*/
