import type { OptionsWithLocalFolderStat } from '../decision/interface';
import { BaseTask } from './interface';

export default class CreateRemoteDir extends BaseTask<OptionsWithLocalFolderStat> {
	async exec() {
		await this.remoteFs.mkdir(this.key);
		await this.record.upsertRecord({
			key: this.key,
			record: { isDir: true },
		});
	}
}
