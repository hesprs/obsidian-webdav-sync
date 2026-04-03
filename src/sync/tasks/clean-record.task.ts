import { BaseTask } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	async exec() {
		await this.syncRecord.removeRecords(this.localPath);
		return { success: true } as const;
	}
}
