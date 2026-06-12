import { arrayBufferToText } from '~/utils/binary';
import logger from '~/utils/logger';
import type { OptionsWithRemoteFileStat } from '../decision/sync-decision.interface';
import isMergeablePath from '../utils/is-mergeable-path';
import { BaseTask, toTaskError } from './task.interface';

export default class PullTask extends BaseTask<OptionsWithRemoteFileStat> {
	readonly name = 'download';

	async exec() {
		try {
			let remoteContent: ArrayBuffer | undefined;
			let localUid: string;

			// 2 MiB
			if (this.remote.size >= 2 ** 21) {
				logger.debug(`Pulling large file \`${this.key}\` in stream.`);
				const stream = await this.webdav.readStream(this.key, this.remote.size);
				localUid = await this.vault.writeStream(this.key, stream);
			} else {
				remoteContent = await this.webdav.read(this.key);
				localUid = await this.vault.write(this.key, remoteContent);
			}

			await this.syncRecord.upsertRecords({
				baseText:
					isMergeablePath(this.key) && remoteContent
						? await arrayBufferToText(remoteContent)
						: undefined,
				key: this.key,
				record: { isDir: false, local: localUid, remote: this.remote.uid },
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to pull file \`${this.key}\` from remote`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
