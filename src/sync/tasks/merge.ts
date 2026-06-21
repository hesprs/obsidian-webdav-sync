import { toRecordStat } from '~/storage';
import { arrayBufferEquals, arrayBufferToText, textToArrayBuffer } from '~/utils/binary';
import type { OptionsWithBothFileStatsAndSettings } from '../decision/interface';
import { resolveByIntelligentMerge } from '../utils/merge';
import mergeDigIn from '../utils/merge-dig-in';
import { BaseTask } from './interface';

export default class MergeTask extends BaseTask<OptionsWithBothFileStatsAndSettings> {
	readonly name = 'merge';

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
			await this.record.upsertRecords({
				baseText: await arrayBufferToText(localBuffer),
				key: this.key,
				record: toRecordStat(this.local, this.remote),
			});
			return;
		}

		const [localText, remoteText, baseTextRaw] = await Promise.all([
			arrayBufferToText(localBuffer),
			arrayBufferToText(remoteBuffer),
			this.record.getBaseText(this.key),
		]);
		const baseText = baseTextRaw ?? remoteText;

		let mergedText: string;
		const mergeResult = resolveByIntelligentMerge({
			baseContentText: baseText,
			localContentText: localText,
			remoteContentText: remoteText,
		});

		if (mergeResult.isIdentical) {
			await this.record.upsertRecords({
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

		const mergedBuffer = await textToArrayBuffer(mergedText);
		const [remoteUid, localUid] = await Promise.all([
			mergedText !== remoteText
				? this.remoteFs.write(this.key, mergedBuffer)
				: Promise.resolve(this.remote.uid),
			mergedText !== localText
				? this.localFs.write(this.key, mergedBuffer)
				: Promise.resolve(this.local.uid),
		]);

		await this.record.upsertRecords({
			baseText: mergedText,
			key: this.key,
			record: { isDir: false, local: localUid, remote: remoteUid },
		});
	}
}
