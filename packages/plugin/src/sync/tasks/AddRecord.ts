import { toRecordStat } from '@/storage';
import type { OptionsWithBothStats } from '../decision/interface';
import { BaseTask } from './interface';

export default class AddRecord extends BaseTask<OptionsWithBothStats> {
	async exec() {
		await this.record.upsertRecord({
			key: this.key,
			record: toRecordStat(this.local, this.remote),
		});
	}
}
