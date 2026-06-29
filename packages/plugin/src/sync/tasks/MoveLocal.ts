import type { OptionsWithRemoteStatAndOldKey } from '../decision/interface';
import { BaseTask } from './interface';

export default class MoveLocal extends BaseTask<OptionsWithRemoteStatAndOldKey> {
	async exec() {
		const { key, oldKey } = this.options;
		await this.localFs.move(oldKey, key);
		await this.record.moveRecord({ key, oldKey });
	}
}
