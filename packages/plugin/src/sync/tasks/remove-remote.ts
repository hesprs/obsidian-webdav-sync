import type { OptionsWithRemoteStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class RemoveRemoteTask extends BaseTask<OptionsWithRemoteStat> {
	readonly name = 'removeRemote';

	async exec() {
		await this.remoteFs.delete(this.key);
		await this.record.removeRecords(this.key);
	}
}
