import { arrayBufferToText } from '~/platform/binary';
import { getRemoteContent } from '~/utils/get-content';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-item';
import type { OptionsWithRemoteStat } from '../decision/sync-decision.interface';
import { isMergeablePath } from '../utils/is-mergeable-path';
import { BaseTask, toTaskError } from './task.interface';

export default class PullTask extends BaseTask<OptionsWithRemoteStat> {
	readonly name = 'download';

	async exec() {
		try {
			const remoteContent = await getRemoteContent(this.webdav, this.remotePath);
			await this.vault.adapter.writeBinary(this.localPath, remoteContent);

			// no race condition since we've just written it
			const local = statVaultItem(this.vault, this.localPath);
			if (!local || local.isDir)
				throw new Error(`failed to read local file stat after pull: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote: this.remote,
				baseText: isMergeablePath(this.localPath)
					? await arrayBufferToText(remoteContent)
					: undefined,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
