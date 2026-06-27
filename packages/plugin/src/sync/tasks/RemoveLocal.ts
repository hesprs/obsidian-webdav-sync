import type { OptionsWithLocalStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class RemoveLocal extends BaseTask<OptionsWithLocalStat> {
	async exec() {
		await this.localFs.delete(this.key);
		await this.record.removeRecords(this.key);
	}
}
