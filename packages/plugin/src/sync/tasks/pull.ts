import { arrayBufferToText } from '@repo/shared';
import type { OptionsWithRemoteFileStat } from '../decision/interface';
import isMergeablePath from '../utils/is-mergeable-path';
import { BaseTask } from './interface';

export default class PullTask extends BaseTask<OptionsWithRemoteFileStat> {
	readonly name = 'download';

	async exec() {
		let remoteContent: ArrayBuffer | undefined;
		let localUid: string;

		// 2 MiB
		if (this.remote.size >= 2 ** 21) {
			const stream = await this.remoteFs.readStream(this.key);
			localUid = await this.localFs.writeStream(this.key, stream);
		} else {
			remoteContent = await this.remoteFs.read(this.key);
			localUid = await this.localFs.write(this.key, remoteContent);
		}

		await this.record.upsertRecords({
			baseText:
				isMergeablePath(this.key) && remoteContent
					? arrayBufferToText(remoteContent)
					: undefined,
			key: this.key,
			record: { isDir: false, local: localUid, remote: this.remote.uid },
		});
	}
}
