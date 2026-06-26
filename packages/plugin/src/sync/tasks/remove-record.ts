import { BaseTask } from './interface';

export default class RemoveRecordTask extends BaseTask {
	readonly name = 'removeRecord';

	async exec() {
		await this.record.removeRecords(this.key);
	}
}
