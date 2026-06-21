import type { OptionsWithRemoteFolderStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class MkdirLocalTask extends BaseTask<OptionsWithRemoteFolderStat> {
	readonly name = 'createLocalDir';

	async exec() {
		await this.localFs.mkdir(this.key);
		await this.record.upsertRecords({
			key: this.key,
			record: { isDir: true },
		});
	}
}
