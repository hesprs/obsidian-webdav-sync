import type { OptionsWithBothFileStats } from '~/sync/decision/sync-decision.interface';
import type { StatModel } from '~/types';
import t from '~/i18n';
import { arrayBufferEquals, arrayBufferToText } from '~/platform/binary';
import { useSettings } from '~/settings';
import { getLocalContent, getRemoteContent } from '~/utils/get-content';
import logger from '~/utils/logger';
import { mergeDigIn } from '~/utils/merge-dig-in';
import { statVaultItem, statWebDAVItem } from '~/utils/stat-item';
import { resolveByIntelligentMerge } from '../utils/merge';
import { BaseTask, toTaskError } from './task.interface';

export default class MergeTask extends BaseTask<OptionsWithBothFileStats> {
	readonly name = 'merge';

	async exec() {
		try {
			let localBuffer: ArrayBuffer;
			try {
				localBuffer = await getLocalContent(this.vault, this.localPath);
			} catch {
				// ignore if local not found (which indicates that it has been deleted or renamed, common in case of a fast local change)
				logger.warn(`Failed to get local content at path \`${this.localPath}\``);
				return { success: true } as const;
			}

			const remoteBuffer = await getRemoteContent(this.webdav, this.remotePath);

			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.syncRecord.upsertRecords({
					baseText: await arrayBufferToText(localBuffer),
					local: this.local,
					remote: this.remote,
					key: this.localPath,
				});
				return { success: true } as const;
			}

			const localText = await arrayBufferToText(localBuffer);
			const remoteText = await arrayBufferToText(remoteBuffer);
			const baseText = (await this.syncRecord.getBaseText(this.localPath)) ?? localText;
			let mergedText: string;
			const mergeResult = resolveByIntelligentMerge({
				localContentText: localText,
				remoteContentText: remoteText,
				baseContentText: baseText,
			});

			if (mergeResult.isIdentical) {
				await this.syncRecord.upsertRecords({
					baseText: localText,
					local: this.local,
					remote: this.remote,
					key: this.localPath,
				});
				return { success: true } as const;
			}

			if (!mergeResult.success) {
				const mergeDigInResult = mergeDigIn(localText, baseText, remoteText, {
					stringSeparator: '\n',
					useGitStyle: (await useSettings()).useGitStyle,
				});
				mergedText = mergeDigInResult.result.join('\n');
			} else mergedText = mergeResult.mergedText as string;

			let newRemote: StatModel | undefined;
			let newLocal: StatModel | undefined;
			if (mergedText !== remoteText) {
				const putResult = await this.webdav.putFileContents(this.remotePath, mergedText, {
					overwrite: true,
				});
				if (!putResult) throw new Error(t('sync.error.failedToUploadMerged'));
				const fetchedRemoteStat = await statWebDAVItem(this.webdav, this.remotePath);
				if (!fetchedRemoteStat || fetchedRemoteStat.isDir)
					throw new Error(
						`failed to read remote file stat after intelligent merge: ${this.localPath}`,
					);
				newRemote = fetchedRemoteStat;
			}
			if (localText !== mergedText) {
				await this.vault.adapter.writeBinary(
					this.localPath,
					new TextEncoder().encode(mergedText).buffer,
					{ ctime: this.remote.mtime - 1000 },
				);
				const fetchedLocalStat = await statVaultItem(this.vault, this.localPath);
				if (!fetchedLocalStat || fetchedLocalStat.isDir)
					throw new Error(
						`failed to read local file stat after intelligent merge: ${this.localPath}`,
					);
				newLocal = fetchedLocalStat;
			}

			await this.syncRecord.upsertRecords({
				baseText: mergedText,
				local: newLocal ?? this.local,
				remote: newRemote ?? this.remote,
				key: this.localPath,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to resolve conflict for ${this.localPath} by smart merging`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
