import type { Stat } from '~/fs-new';
import type { OptionsWithBothFileStats } from '~/sync/decision/sync-decision.interface';
import t from '~/i18n';
import { arrayBufferEquals, arrayBufferToText, textToArrayBuffer } from '~/platform/binary';
import { useSettings } from '~/settings';
import {
	decryptRemoteFileContent,
	encryptContentForRemoteFile,
	resolveRemoteExecutionPath,
} from '~/utils/encryption';
import logger from '~/utils/logger';
import mergeDigIn from '~/utils/merge-dig-in';
import { resolveByIntelligentMerge } from '../utils/merge';
import { BaseTask, toTaskError } from './task.interface';

export default class MergeTask extends BaseTask<OptionsWithBothFileStats> {
	readonly name = 'merge';

	async exec() {
		try {
			let localBuffer: ArrayBuffer;
			try {
				localBuffer = await this.vault.read(this.key);
			} catch {
				// Ignore if local not found (which indicates that it has been deleted or renamed, common in case of fast local change)
				logger.warn(`Failed to get local content at path \`${this.key}\``);
				return { success: true } as const;
			}

			const settings = await useSettings();
			const executionRemotePath = await resolveRemoteExecutionPath(this.key);

			const downloadedRemoteBuffer = await this.webdav.read(executionRemotePath);
			const remoteBuffer = settings.encryption.enabled
				? await decryptRemoteFileContent(this.key, downloadedRemoteBuffer, this.remote.size)
				: downloadedRemoteBuffer;

			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.syncRecord.upsertRecords({
					baseText: await arrayBufferToText(localBuffer),
					key: this.key,
					local: this.local,
					remote: this.remote,
				});
				return { success: true } as const;
			}

			const localText = await arrayBufferToText(localBuffer);
			const remoteText = await arrayBufferToText(remoteBuffer);
			const baseText = (await this.syncRecord.getBaseText(this.key)) ?? localText;
			let mergedText: string;
			const mergeResult = resolveByIntelligentMerge({
				baseContentText: baseText,
				localContentText: localText,
				remoteContentText: remoteText,
			});

			if (mergeResult.isIdentical) {
				await this.syncRecord.upsertRecords({
					baseText: localText,
					key: this.key,
					local: this.local,
					remote: this.remote,
				});
				return { success: true } as const;
			}

			if (!mergeResult.success) {
				const mergeDigInResult = mergeDigIn(localText, baseText, remoteText, {
					stringSeparator: '\n',
					useGitStyle: settings.useGitStyle,
				});
				mergedText = mergeDigInResult.result.join('\n');
			} else mergedText = mergeResult.mergedText as string;

			let newRemote: Stat | undefined;
			let newLocal: Stat | undefined;
			const mergedBuffer = new TextEncoder().encode(mergedText).buffer;
			if (mergedText !== remoteText) {
				const putResult = await this.webdav.write(
					executionRemotePath,
					settings.encryption.enabled
						? await encryptContentForRemoteFile(this.key, mergedBuffer)
						: await textToArrayBuffer(mergedText),
				);
				if (!putResult) throw new Error(t('sync.error.failedToUploadMerged'));
				const fetchedRemoteStat = await statWebDAVItem(
					executionRemotePath,
					this.remotePath,
				);
				if (!fetchedRemoteStat || fetchedRemoteStat.isDir)
					throw new Error(
						`failed to read remote file \`${this.key}\` after intelligent merge.`,
					);
				newRemote = fetchedRemoteStat;
			}
			if (localText !== mergedText) {
				await this.vault.write(this.key, await textToArrayBuffer(mergedText));
				const fetchedLocalStat = await this.vault.stat(this.key);
				if (!fetchedLocalStat || fetchedLocalStat.isDir)
					throw new Error(
						`failed to read local file \`${this.key}\` after intelligent merge.`,
					);
				newLocal = fetchedLocalStat;
			}

			await this.syncRecord.upsertRecords({
				baseText: mergedText,
				key: this.localPath,
				local: newLocal ?? this.local,
				remote: newRemote ?? this.remote,
			});
			return { success: true } as const;
		} catch (error) {
			logger.error(
				`Failed to resolve conflict for ${this.localPath} by smart merging`,
				error,
			);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
