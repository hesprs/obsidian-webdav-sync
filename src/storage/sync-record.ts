import type { Store } from 'uni-kv';
import type { RecordStat, RecordStatsMap } from '~/types';
import { isSub } from '~/utils/path';
import type { StorageDatabase } from './database';
import {
	BASE_TEXT_STORE_NAME,
	SYNC_STATE_STORE_NAME,
	clearStorageNamespace,
	parseKey,
} from './database';

export default class SyncRecord {
	private readonly getSyncRecordStorePromise: Promise<Store<RecordStat>>;
	private readonly getBaseTextStorePromise: Promise<Store<string>>;

	constructor(
		private readonly namespace: string,
		private readonly db: StorageDatabase,
	) {
		this.getSyncRecordStorePromise = Promise.resolve(this.db.getStore(SYNC_STATE_STORE_NAME));
		this.getBaseTextStorePromise = Promise.resolve(this.db.getStore(BASE_TEXT_STORE_NAME));
	}

	async removeRecords(path: string): Promise<void> {
		const [stateStore, baseTextStore] = await Promise.all([
			this.getSyncRecordStorePromise,
			this.getBaseTextStorePromise,
		]);
		await Promise.all([
			stateStore.delete(this.getKey(path)),
			baseTextStore.delete(this.getKey(path)),
		]);
	}

	async removeRecordSubtree(path: string): Promise<void> {
		const [stateStore, baseTextStore] = await Promise.all([
			this.getSyncRecordStorePromise,
			this.getBaseTextStorePromise,
		]);
		await Promise.all([
			this.removeSubtree(stateStore, path),
			this.removeSubtree(baseTextStore, path),
		]);
	}

	async upsertRecords({
		key,
		record,
		baseText,
	}: {
		key: string;
		record: RecordStat;
		baseText?: string;
	}): Promise<void> {
		const [stateStore, baseTextStore] = await Promise.all([
			this.getSyncRecordStorePromise,
			this.getBaseTextStorePromise,
		]);
		await Promise.all([
			stateStore.set(this.getKey(key), record),
			baseText === undefined
				? Promise.resolve()
				: baseTextStore.set(this.getKey(key), baseText),
		]);
	}

	async getBaseText(path: string): Promise<string | undefined> {
		const store = await this.getBaseTextStorePromise;
		return await store.get(this.getKey(path));
	}

	async setBaseText(path: string, baseText: string): Promise<void> {
		const store = await this.getBaseTextStorePromise;
		await store.set(this.getKey(path), baseText);
	}

	async getRecords(): Promise<RecordStatsMap> {
		const store = await this.getSyncRecordStorePromise;
		const result: RecordStatsMap = new Map();
		const records = await store.batch(
			(await store.keys())
				.filter((key) => parseKey(key).namespace === this.namespace)
				.map((key) => ({ key, type: 'get' })),
		);
		for (const { key, value } of records)
			if (value !== undefined) result.set(parseKey(key).path, value);
		return result;
	}

	async drop() {
		await clearStorageNamespace(this.namespace, this.db);
	}

	private getKey(path: string) {
		return `${this.namespace}:${path}`;
	}

	private async removeSubtree<T>(store: Store<T>, path: string) {
		const keys = (await store.keys()).filter((key) => {
			const parsed = parseKey(key);
			return parsed.namespace === this.namespace && isSub(path, parsed.path, true);
		});
		if (keys.length === 0) return;
		await store.batch(keys.map((key) => ({ key, type: 'delete' })));
	}
}
