import { BaseTask } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	readonly name = 'cleanRecord';
	async exec() {
		await this.syncRecord.removeRecords(this.localPath);
		return { success: true } as const;
	}
}
