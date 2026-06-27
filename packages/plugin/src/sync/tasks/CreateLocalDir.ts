import type { OptionsWithRemoteFolderStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class CreateLocalDir extends BaseTask<OptionsWithRemoteFolderStat> {
	async exec() {
		await this.localFs.mkdir(this.key);
		await this.record.upsertRecords({
			key: this.key,
			record: { isDir: true },
		});
	}
}
