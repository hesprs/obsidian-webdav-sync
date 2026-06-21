import { toRecordStat } from '~/storage';
import type { OptionsWithBothStats } from '../decision/interface';
import { BaseTask } from './interface';

export default class AddRecordTask extends BaseTask<OptionsWithBothStats> {
	readonly name = 'addRecord';
	async exec() {
		await this.record.upsertRecords({
			key: this.key,
			record: toRecordStat(this.local, this.remote),
		});
	}
}
