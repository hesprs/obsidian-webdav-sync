import type { PullTaskOptions } from '~/sync/decision/sync-decision.interface';
import { arrayBufferToText, toArrayBuffer } from '~/platform/binary';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-item';
import { isMergeablePath } from '../utils/is-mergeable-path';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PullTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & PullTaskOptions) {
		super(options);
	}

	get remoteSize() {
		const remoteStat = this.options.remote?.stat;
		return remoteStat && !remoteStat.isDir ? remoteStat.size : 0;
	}

	readonly name = 'download';

	async exec() {
		try {
			const remoteContent = this.options.remote?.content;
			if (!remoteContent) {
				throw new Error('missing remote content snapshot for pull: ' + this.remotePath);
			}

			const arrayBuffer = await toArrayBuffer(remoteContent);
			await this.vault.adapter.writeBinary(this.localPath, arrayBuffer);

			const remote = this.options.remote?.stat;
			if (!remote || remote.isDir) {
				throw new Error('missing remote file snapshot for pull: ' + this.remotePath);
			}

			// no race condition since we've just written it
			const local = statVaultItem(this.vault, this.localPath);
			if (!local || local.isDir)
				throw new Error(`failed to read local file stat after pull: ${this.localPath}`);
			await this.syncRecord.upsertRecords({
				key: this.localPath,
				local,
				remote,
				baseText: isMergeablePath(this.localPath)
					? await arrayBufferToText(arrayBuffer)
					: undefined,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
