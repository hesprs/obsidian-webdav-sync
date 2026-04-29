import type { RecordStatModel, RecordStatsMap } from '~/types';
import { isNil } from '~/utils/fns';
import { BaseStore, parseKey, SYNC_STATE_STORE_NAME } from './store.interface';

export class IndexedDbSyncStateStore extends BaseStore {
	constructor() {
		super(SYNC_STATE_STORE_NAME);
	}

	async get(namespace: string, path: string): Promise<RecordStatModel | undefined> {
		return await this.run('read record', async () => {
			return (
				(await this.store.getItem<RecordStatModel>(this.getKey(namespace, path))) ??
				undefined
			);
		});
	}

	async getAll(_namespace: string): Promise<RecordStatsMap> {
		return await this.run('read all records', async () => {
			const result: RecordStatsMap = new Map();
			const keys = (await this.store.keys()).filter(
				(key) => parseKey(key).namespace === _namespace,
			);
			(await this.store.getItems<RecordStatModel>(keys))
				.filter(({ value }) => !isNil(value))
				.map(({ key, value }) => result.set(parseKey(key).path, value as RecordStatModel));
			return result;
		});
	}

	async set(namespace: string, path: string, stats: RecordStatModel): Promise<void> {
		await this.run('write local record', async () => {
			await this.store.setItem(this.getKey(namespace, path), stats);
		});
	}
}
