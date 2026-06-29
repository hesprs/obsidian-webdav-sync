import { arrayBufferEquals, arrayBufferToText, textToArrayBuffer } from '@repo/shared';
import { toRecordStat } from '@/storage';
import type { OptionsWithBothFileStatsAndSettings } from '../decision/interface';
import { resolveByIntelligentMerge } from '../utils/merge';
import mergeDigIn from '../utils/merge-dig-in';
import { BaseTask } from './interface';

export default class Merge extends BaseTask<OptionsWithBothFileStatsAndSettings> {
	async exec() {
		let localBuffer, remoteBuffer: ArrayBuffer;

		try {
			[localBuffer, remoteBuffer] = await Promise.all([
				this.localFs.read(this.key),
				this.remoteFs.read(this.key),
			]);
		} catch {
			// Ignore if local not found (which indicates that it has been deleted or renamed, common in case of fast local change)
			return;
		}

		if (arrayBufferEquals(localBuffer, remoteBuffer)) {
			await this.record.upsertRecord({
				baseText: arrayBufferToText(localBuffer),
				key: this.key,
				record: toRecordStat(this.local, this.remote),
			});
			return;
		}

		const localText = arrayBufferToText(localBuffer);
		const remoteText = arrayBufferToText(remoteBuffer);
		const baseTextRaw = await this.record.getBaseText(this.key);
		const baseText = baseTextRaw ?? remoteText;

		let mergedText: string;
		const mergeResult = resolveByIntelligentMerge({
			baseContentText: baseText,
			localContentText: localText,
			remoteContentText: remoteText,
		});

		if (mergeResult.isIdentical) {
			await this.record.upsertRecord({
				baseText: localText,
				key: this.key,
				record: toRecordStat(this.local, this.remote),
			});
			return;
		}

		const { useGitStyle } = this.options.settings;
		if (!mergeResult.success) {
			const mergeDigInResult = mergeDigIn(localText, baseText, remoteText, {
				stringSeparator: '\n',
				useGitStyle,
			});
			mergedText = mergeDigInResult.result.join('\n');
		} else mergedText = mergeResult.mergedText as string;

		const mergedBuffer = textToArrayBuffer(mergedText);
		const [remoteUid, localUid] = await Promise.all([
			mergedText !== remoteText
				? this.remoteFs.write(this.key, mergedBuffer)
				: Promise.resolve(this.remote.uid),
			mergedText !== localText
				? this.localFs.write(this.key, mergedBuffer)
				: Promise.resolve(this.local.uid),
		]);

		await this.record.upsertRecord({
			baseText: mergedText,
			key: this.key,
			record: { isDir: false, local: localUid, remote: remoteUid },
		});
	}
}
