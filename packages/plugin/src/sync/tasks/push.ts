import { arrayBufferToText } from '@repo/shared';
import type { OptionsWithLocalFileStat } from '../decision/interface';
import isMergeablePath from '../utils/is-mergeable-path';
import { BaseTask } from './interface';

export default class PushTask extends BaseTask<OptionsWithLocalFileStat> {
	readonly name = 'upload';

	async exec() {
		let localContent: ArrayBuffer;
		try {
			localContent = await this.localFs.read(this.key);
		} catch {
			// Ignore if local not found (which indicates that it has been deleted or renamed, common in case of a fast local change)
			return;
		}
		const remoteUid = await this.remoteFs.write(this.key, localContent);

		await this.record.upsertRecords({
			baseText: isMergeablePath(this.key) ? arrayBufferToText(localContent) : undefined,
			key: this.key,
			record: { isDir: false, local: this.local.uid, remote: remoteUid },
		});
	}
}
