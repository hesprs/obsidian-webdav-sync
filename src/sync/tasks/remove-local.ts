import type { OptionsWithLocalStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class RemoveLocalTask extends BaseTask<OptionsWithLocalStat> {
	readonly name = 'removeLocal';

	async exec() {
		await this.localFs.delete(this.key);
		await this.record.removeRecords(this.key);
	}
}
