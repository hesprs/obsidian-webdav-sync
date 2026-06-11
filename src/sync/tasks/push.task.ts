import type { OptionsWithLocalFileStat } from '~/sync/decision/sync-decision.interface';
import { arrayBufferToText } from '~/platform/binary';
import logger from '~/utils/logger';
import isMergeablePath from '../utils/is-mergeable-path';
import { BaseTask, toTaskError } from './task.interface';

export default class PushTask extends BaseTask<OptionsWithLocalFileStat> {
	readonly name = 'upload';

	async exec() {
		try {
			let localContent: ArrayBuffer;
			try {
				localContent = await this.vault.read(this.key);
			} catch {
				// Ignore if local not found (which indicates that it has been deleted or renamed, common in case of a fast local change)
				logger.warn(`Failed to get local content at path \`${this.key}\``);
				return { success: true } as const;
			}
			const remoteUid = await this.webdav.write(this.key, localContent);

			await this.syncRecord.upsertRecords({
				baseText: isMergeablePath(this.key)
					? await arrayBufferToText(localContent)
					: undefined,
				key: this.key,
				record: { isDir: false, local: this.local.uid, remote: remoteUid },
			});

			return { success: true } as const;
		} catch (error) {
			logger.error(`Failed to push local file \`${this.key}\` to remote`, error);
			return { error: toTaskError(error, this), success: false };
		}
	}
}
