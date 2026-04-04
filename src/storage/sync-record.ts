import type { RecordStatsMap, StatModel } from '~/types';
import type { IndexedDbBaseTextStore } from './base-text.store';
import { type IndexedDbSyncStateStore } from './sync-record.store';

export class SyncRecord {
	constructor(
		private namespace: string,
		private stateStore: IndexedDbSyncStateStore,
		private textStore: IndexedDbBaseTextStore,
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
		local,
		remote,
		baseText,
	}: {
		key: string;
		local: StatModel;
		remote: StatModel;
		baseText?: string;
	}): Promise<void> {
		await Promise.all([
			this.stateStore.set(this.namespace, key, { local, remote }),
			(async () => {
				if (baseText) await this.textStore.set(this.namespace, key, baseText);
			})(),
		]);
	}

	async getBaseText(path: string): Promise<string | undefined> {
		return await this.textStore.get(this.namespace, path);
	}

	async getRecords(): Promise<RecordStatsMap> {
		return await this.stateStore.getAll(this.namespace);
	}

	async drop() {
		await this.stateStore.removeNamespace(this.namespace);
		await this.textStore.removeNamespace(this.namespace);
	}
}
