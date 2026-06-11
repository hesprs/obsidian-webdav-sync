import type { RecordStat, RecordStatsMap } from '~/types';
import { isNil } from '~/utils/fns';
import type IndexedDbSyncStateStore from './sync-record.store';
import IndexedDbBaseTextStore from './base-text.store';

export default class SyncRecord {
	constructor(
		private readonly namespace: string,
		private readonly stateStore: IndexedDbSyncStateStore,
		private readonly textStore: IndexedDbBaseTextStore,
	) {}

	async removeRecords(path: string): Promise<void> {
		await Promise.all([
			this.stateStore.removeEntry(this.namespace, path),
			this.textStore.removeEntry(this.namespace, path),
		]);
	}

	async removeRecordSubtree(path: string): Promise<void> {
		await Promise.all([
			this.stateStore.removeSubDir(this.namespace, path),
			this.textStore.removeSubDir(this.namespace, path),
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
		await Promise.all([
			this.stateStore.set(this.namespace, key, record),
			(async () => {
				if (!isNil(baseText)) await this.textStore.set(this.namespace, key, baseText);
			})(),
		]);
	}

	async getBaseText(path: string): Promise<string | undefined> {
		return await this.textStore.get(this.namespace, path);
	}

	async setBaseText(path: string, baseText: string): Promise<void> {
		await this.textStore.set(this.namespace, path, baseText);
	}

	async getRecords(): Promise<RecordStatsMap> {
		return await this.stateStore.getAll(this.namespace);
	}

	async drop() {
		await this.stateStore.removeNamespace(this.namespace);
		await this.textStore.removeNamespace(this.namespace);
	}
}
