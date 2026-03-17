import { BaseTask } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	async exec() {
		return { success: true } as const;
	}
}
