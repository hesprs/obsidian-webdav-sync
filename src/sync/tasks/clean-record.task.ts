import logger from '~/utils/logger';
import { BaseTask, toTaskError } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	async exec() {
		try {
			return { success: true } as const;
		} catch (e) {
			logger.error(this, e);
			return {
				success: false,
				error: toTaskError(e, this),
			};
		}
	}
}
