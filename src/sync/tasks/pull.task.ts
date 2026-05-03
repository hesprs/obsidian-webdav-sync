import type { BinaryLike } from '~/platform/binary';
import {
	finalizeRangedDownloadTempPath,
	prepareRangedDownloadTempPath,
	removeVaultFileIfExists,
	statItem,
} from '~/fs/vault';
import { getContent } from '~/fs/webdav';
import { arrayBufferToText, toArrayBuffer } from '~/platform/binary';
import { useSettings } from '~/settings';
import {
	createRemoteFileContentRangedDecrypter,
	decryptRemoteFileContent,
	resolveRemoteExecutionPath,
} from '~/utils/encryption';
import logger from '~/utils/logger';
import type { OptionsWithRemoteFileStat } from '../decision/sync-decision.interface';
import isMergeablePath from '../utils/is-mergeable-path';
import { getStdChunkSize, splitChunks } from '../utils/split-chunks';
import { BaseTask, toTaskError } from './task.interface';

export default class PullTask extends BaseTask<OptionsWithRemoteFileStat> {
	readonly name = 'download';

	async exec() {
		try {
			const settings = await useSettings();
			const maxThroughput = settings.maxThroughputConcurrency;
			const encryptionEnabled = settings.encryption.enabled;
			const executionRemotePath = await resolveRemoteExecutionPath(this.remotePath);
			const chunkSize = getStdChunkSize(maxThroughput, 4);
			const cache =
				this.remote.size <= chunkSize
					? []
					: await this.syncRecord.getFileChunkKeys(this.remote);
			const split = splitChunks({
				cache,
				chunkSize,
				multiplex: 4,
				setting: maxThroughput,
				total: this.remote.size,
			});
			let remoteContent: ArrayBuffer | undefined;

			if (split) {
				logger.debug(`Pulling large file \`${this.remotePath}\` in chunks.`);
				const tempPath = await prepareRangedDownloadTempPath(this.vault, this.localPath);
				try {
					for (const group of split)
						await Promise.all(
							group.map(async ({ start, end }) => {
								const buffer = await toArrayBuffer(
									(await this.webdav.getFileContents(executionRemotePath, {
										headers: { Range: `bytes=${start}-${end}` },
									})) as BinaryLike,
								);
								await this.syncRecord.setFileChunk(buffer, {
									end,
									start,
									...this.remote,
								});
							}),
						);

					const decrypter = encryptionEnabled
						? await createRemoteFileContentRangedDecrypter(
								this.localPath,
								this.remote.size,
							)
						: undefined;
					const keys = (await this.syncRecord.getFileChunkKeys(this.remote))
						.sort((a, b) => a.start - b.start)
						.map(({ key }) => key);
					for (const key of keys) {
						const buffer = await this.syncRecord.getFileChunk(key);
						if (!buffer) throw new Error(`File chunk not found: ${key}`);
						const output = decrypter ? await decrypter.update(buffer) : buffer;
						await this.writeRangedOutput(tempPath, output);
					}

					if (decrypter) {
						const tail = await decrypter.finish();
						await this.writeRangedOutput(tempPath, tail);
					}

					await finalizeRangedDownloadTempPath(this.vault, tempPath, this.localPath);
					await this.syncRecord.removeFileChunk(this.remotePath);
				} catch (error) {
					await Promise.all([
						removeVaultFileIfExists(this.vault, tempPath),
						this.syncRecord.removeFileChunk(this.remotePath),
					]);
					throw error;
				}
			} else {
				const downloadedContent = await getContent(this.webdav, executionRemotePath);
				remoteContent = encryptionEnabled
					? await decryptRemoteFileContent(
							this.localPath,
							downloadedContent,
							this.remote.size,
						)
					: downloadedContent;
				await this.vault.adapter.writeBinary(this.localPath, remoteContent, {
					ctime: this.remote.mtime - 1000, // #1
				});
			}

			// No race condition since we've just written it
			const local = await statItem(this.vault, this.localPath);
			if (!local || local.isDir)
				throw new Error(`failed to read local file stat after pull: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				baseText:
					isMergeablePath(this.localPath) && remoteContent
						? await arrayBufferToText(remoteContent)
						: undefined,
				key: this.localPath,
				local,
				remote: this.remote,
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}

	private async writeRangedOutput(tempPath: string, buffer: ArrayBuffer) {
		if (buffer.byteLength === 0) return;
		await this.vault.adapter.appendBinary(tempPath, buffer, {
			ctime: this.remote.mtime - 1000,
		});
	}
}

/* #1 Solves incompatibility between this plugin and obsidian-paste-image-rename

When "Handle all attachments" is enabled, paste-image-rename checks every file write (except .md) in vault and tries to rename them.

During syncing, when files are downloaded, Paste-image-rename tries to rename all of them, causing severe rename chaos. If real-time sync is enabled, the file rename will in return trigger an auto sync, which will cause server chaos as well.

When ctime is more than 1 seconds ago, paste-image-rename will not rename the file: https://github.com/reorx/obsidian-paste-image-rename/blob/3801513c406a86ad90c94a1bd7c95c6b837e063d/src/main.ts#L81

So the only solution is to re-generate a ctime at local file creation. Which is set to server modification time - 1s.
*/
