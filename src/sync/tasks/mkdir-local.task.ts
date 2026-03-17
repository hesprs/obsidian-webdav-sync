import logger from '~/utils/logger';
import { mkdirsVault } from '~/utils/mkdirs-vault';
import { BaseTask, toTaskError } from './task.interface';

export default class MkdirLocalTask extends BaseTask {
	async exec() {
		try {
			await mkdirsVault(this.vault, this.localPath);
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create local directory ${this.localPath}`);
			logger.debug(e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
