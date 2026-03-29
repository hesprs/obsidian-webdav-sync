import { BaseTask } from './task.interface';

export default class CleanRecordTask extends BaseTask {
	async exec() {
		await this.syncRecord.cleanOrphanedRecordPaths(this.localPath, this.remotePath);
		return { success: true } as const;
	}
}
