import type { OptionsWithBothFileStats } from '~/sync/decision/sync-decision.interface';
import { arrayBufferEquals, arrayBufferToText, textToArrayBuffer } from '~/platform/binary';
import { useSettings } from '~/settings';
import { toRecordStat } from '~/storage';
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
			const remoteBuffer = await this.webdav.read(this.key);

			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.syncRecord.upsertRecords({
					baseText: await arrayBufferToText(localBuffer),
					key: this.key,
					record: toRecordStat(this.local, this.remote),
				});
				return { success: true } as const;
			}

			const localText = await arrayBufferToText(localBuffer);
			const remoteText = await arrayBufferToText(remoteBuffer);
			const baseText = (await this.syncRecord.getBaseText(this.key)) ?? remoteText;
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
					record: toRecordStat(this.local, this.remote),
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

			let remoteUid: string | undefined;
			let localUid: string | undefined;
			const mergedBuffer = await textToArrayBuffer(mergedText);
			if (mergedText !== remoteText)
				remoteUid = await this.webdav.write(this.key, mergedBuffer);

			if (localText !== mergedText) localUid = await this.vault.write(this.key, mergedBuffer);

			await this.syncRecord.upsertRecords({
				baseText: mergedText,
				key: this.key,
				record: {
					isDir: false,
					local: localUid ?? this.local.uid,
					remote: remoteUid ?? this.remote.uid,
				},
			});
			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to resolve conflict for \`${this.key}\` by smart merging`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
