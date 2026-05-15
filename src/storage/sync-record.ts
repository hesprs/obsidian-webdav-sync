import type { RecordStatsMap, StatModel } from '~/types';
import { isNil } from '~/utils/fns';
import type IndexedDbFileChunkStore from './file-chunk.store';
import type IndexedDbSyncStateStore from './sync-record.store';
import IndexedDbBaseTextStore from './base-text.store';

export default class SyncRecord {
	constructor(
		private readonly namespace: string,
		private readonly stateStore: IndexedDbSyncStateStore,
		private readonly textStore: IndexedDbBaseTextStore,
		private readonly fileStore: IndexedDbFileChunkStore,
	) {}

	async removeRecords(path: string): Promise<void> {
		await Promise.all([
			this.stateStore.removeEntry(this.namespace, path),
			this.textStore.removeEntry(this.namespace, path),
			this.fileStore.removeEntry(this.namespace, path),
		]);
	}

	async removeRecordSubtree(path: string): Promise<void> {
		await Promise.all([
			this.stateStore.removeSubDir(this.namespace, path),
			this.textStore.removeSubDir(this.namespace, path),
			this.fileStore.removeSubDir(this.namespace, path),
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
				if (!isNil(baseText)) await this.textStore.set(this.namespace, key, baseText);
			})(),
		]);
	}

	async getBaseText(path: string): Promise<string | undefined> {
		return await this.textStore.get(this.namespace, path);
	}

	async getFileChunkKeys(options: { path: string; size: number }) {
		return await this.fileStore.getFileChunkKeys({ namespace: this.namespace, ...options });
	}

	async setFileChunk(
		chunk: ArrayBuffer,
		options: {
			path: string;
			start: number;
			size: number;
			end: number;
		},
	) {
		await this.fileStore.setFileChunk(chunk, { namespace: this.namespace, ...options });
	}

	async getFileChunk(key: string) {
		return await this.fileStore.getFileChunk(key);
	}

	async removeFileChunk(key: string) {
		await this.fileStore.removeEntry(this.namespace, key);
	}

	async getRecords(): Promise<RecordStatsMap> {
		return await this.stateStore.getAll(this.namespace);
	}

	async drop() {
		await this.stateStore.removeNamespace(this.namespace);
		await this.textStore.removeNamespace(this.namespace);
	}
}
