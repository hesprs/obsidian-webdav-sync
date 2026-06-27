import { BaseTask } from './interface';

export default class RemoveRecord extends BaseTask {
	async exec() {
		await this.record.removeRecords(this.key);
	}
}
