import { BaseTask } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	readonly name = 'cleanRecord';
	async exec() {
		await this.syncRecord.removeRecords(this.key);
		return { success: true } as const;
	}
}
