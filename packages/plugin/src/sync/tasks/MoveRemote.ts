import type { OptionsWithLocalStatAndOldKey } from '../decision/interface';
import { BaseTask } from './interface';

export default class MoveRemote extends BaseTask<OptionsWithLocalStatAndOldKey> {
	async exec() {
		const { key, oldKey } = this.options;
		await this.remoteFs.move(oldKey, key);
		await this.record.moveRecord({ key, oldKey });
	}
}
