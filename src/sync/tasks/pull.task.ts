import type { PullTaskOptions } from '~/sync/decision/sync-decision.interface';
import { toArrayBuffer, type BinaryLike } from '~/platform/binary';
import { vaultDirname } from '~/platform/path/vault-path';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-vault-item';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PullTask extends BaseTask {
	constructor(readonly options: BaseTaskOptions & PullTaskOptions) {
		super(options);
	}

	get remoteSize() {
		const remoteStat = this.options.remote?.stat;
		return remoteStat && !remoteStat.isDir ? remoteStat.size : 0;
	}

	async exec() {
		try {
			const remoteStat = this.options.remote?.stat;
			if (!remoteStat || remoteStat.isDir) {
				throw new Error('missing remote file snapshot for pull: ' + this.remotePath);
			}
			const remoteContent = this.options.remote?.content as BinaryLike | undefined;
			if (!remoteContent) {
				throw new Error('missing remote content snapshot for pull: ' + this.remotePath);
			}

			const arrayBuffer = await toArrayBuffer(remoteContent);
			if (arrayBuffer.byteLength !== this.remoteSize)
				throw new Error('Remote Size Not Match!');

			const localDir = vaultDirname(this.localPath);
			if (localDir !== '.' && localDir !== '') {
				const segments = localDir.split('/').filter((segment) => segment !== '');
				let currentPath = '';
				for (const segment of segments) {
					currentPath = currentPath ? `${currentPath}/${segment}` : segment;
					try {
						await this.vault.adapter.mkdir(currentPath);
					} catch {
						// Ignore existing-dir and parent creation races.
					}
				}
			}

			await this.vault.adapter.writeBinary(this.localPath, arrayBuffer);

			// no race condition since we've just written it
			const syncedStat = await statVaultItem(this.vault, this.localPath);
			if (!syncedStat || syncedStat.isDir)
				throw new Error('failed to read local file stat after pull: ' + this.localPath);
			await this.syncRecord.upsertSyncedFileFromLocalSnapshot({
				localPath: this.localPath,
				syncedStat,
			});

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to pull file ${this.remotePath} from remote`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
