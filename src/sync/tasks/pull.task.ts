import { toArrayBuffer, type BinaryLike } from '~/platform/binary';
import { vaultDirname } from '~/platform/path/vault-path';
import logger from '~/utils/logger';
import { mkdirsVault } from '~/utils/mkdirs-vault';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export default class PullTask extends BaseTask {
	constructor(
		readonly options: BaseTaskOptions & {
			remoteSize: number;
		},
	) {
		super(options);
	}

	get remoteSize() {
		return this.options.remoteSize;
	}

	async exec() {
		const fileExists = this.vault.getFileByPath(this.localPath);
		try {
			const file = (await this.webdav.getFileContents(this.remotePath, {
				format: 'binary',
				details: false,
			})) as BinaryLike;
			const arrayBuffer = await toArrayBuffer(file);
			if (arrayBuffer.byteLength !== this.remoteSize) {
				throw new Error('Remote Size Not Match!');
			}
			if (fileExists) {
				await this.vault.modifyBinary(fileExists, arrayBuffer);
			} else {
				await mkdirsVault(this.vault, vaultDirname(this.localPath));
				await this.vault.createBinary(this.localPath, arrayBuffer);
			}
			return { success: true } as const;
		} catch (e) {
			logger.error(this, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
