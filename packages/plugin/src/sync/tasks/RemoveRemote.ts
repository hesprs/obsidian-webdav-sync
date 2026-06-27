import type { OptionsWithRemoteStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class RemoveRemote extends BaseTask<OptionsWithRemoteStat> {
	async exec() {
		await this.remoteFs.delete(this.key);
		await this.record.removeRecords(this.key);
	}
}
