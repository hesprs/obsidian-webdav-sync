import type { OptionsWithLocalFolderStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class MkdirRemoteTask extends BaseTask<OptionsWithLocalFolderStat> {
	readonly name = 'createRemoteDir';

	async exec() {
		await this.remoteFs.mkdir(this.key);
		await this.record.upsertRecords({
			key: this.key,
			record: { isDir: true },
		});
	}
}
