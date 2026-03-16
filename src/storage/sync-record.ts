import { normalizeRemoteWalkPath } from '~/fs/utils/normalize-remote-walk-path';
import {
	createEmptyRemoteRecord,
	createEmptySyncState,
	type LocalRecordModel,
	type RemoteRecordModel,
	type SyncRecordModel,
	type SyncStateModel,
} from '~/model/sync-record.model';
import { syncRecordKV, syncStateKV } from './kv';

export class SyncRecord {
	constructor(
		private namespace: string,
		private remoteBaseDir: string,
	) {}

	private toLocalRecord(record: SyncRecordModel): LocalRecordModel {
		return {
			local: record.local,
			base: record.base,
		};
	}

	private normalizeLocalRecords(
		localRecords: Map<string, LocalRecordModel> | Record<string, LocalRecordModel> | undefined,
	): Map<string, LocalRecordModel> {
		if (localRecords instanceof Map) return localRecords;
		if (!localRecords || typeof localRecords !== 'object') return new Map();
		return new Map(Object.entries(localRecords));
	}

	private normalizeRemoteRecord(
		remoteRecord: Partial<RemoteRecordModel> | undefined,
	): RemoteRecordModel {
		const queue = Array.isArray(remoteRecord?.queue) ? remoteRecord.queue : [];
		const nodes =
			remoteRecord?.nodes && typeof remoteRecord.nodes === 'object' ? remoteRecord.nodes : {};

		return {
			queue,
			nodes,
			isComplete: remoteRecord?.isComplete ?? queue.length === 0,
			lastNormalSyncAt: remoteRecord?.lastNormalSyncAt,
			source: remoteRecord?.source,
		};
	}

	private normalizeState(state: Partial<SyncStateModel> | undefined): SyncStateModel {
		if (!state) return createEmptySyncState();

		return {
			version: 1,
			remoteRecord: this.normalizeRemoteRecord(state.remoteRecord),
			localRecords: this.normalizeLocalRecords(state.localRecords),
		};
	}

	private async migrateLegacyLocalRecords(): Promise<Map<string, LocalRecordModel>> {
		const legacyRecords = await syncRecordKV.get(this.namespace);
		if (!legacyRecords) return new Map();

		const localRecords = new Map<string, LocalRecordModel>();
		for (const [path, record] of legacyRecords) {
			localRecords.set(path, this.toLocalRecord(record));
		}

		await syncRecordKV.unset(this.namespace);
		return localRecords;
	}

	private buildRemoteStatMap(
		remoteRecord: RemoteRecordModel,
	): Map<string, SyncRecordModel['remote']> {
		const remoteStats = new Map<string, SyncRecordModel['remote']>();

		for (const stats of Object.values(remoteRecord.nodes)) {
			for (const stat of stats) {
				const normalizedPath = normalizeRemoteWalkPath(stat.path, this.remoteBaseDir);
				if (!normalizedPath) continue;
				remoteStats.set(normalizedPath, {
					...stat,
					path: normalizedPath,
				});
			}
		}

		return remoteStats;
	}

	private async loadState(): Promise<SyncStateModel> {
		const existingState = await syncStateKV.get(this.namespace);
		if (existingState) return this.normalizeState(existingState);

		const migratedState = createEmptySyncState();
		migratedState.localRecords = await this.migrateLegacyLocalRecords();
		await syncStateKV.set(this.namespace, migratedState);
		return migratedState;
	}

	private async saveState(state: SyncStateModel): Promise<void> {
		await syncStateKV.set(this.namespace, this.normalizeState(state));
	}

	async getState(): Promise<SyncStateModel> {
		return await this.loadState();
	}

	async setState(state: SyncStateModel): Promise<void> {
		await this.saveState(state);
	}

	async getRemoteRecord(): Promise<RemoteRecordModel> {
		const state = await this.loadState();
		return state.remoteRecord;
	}

	async setRemoteRecord(remoteRecord: RemoteRecordModel): Promise<void> {
		const state = await this.loadState();
		state.remoteRecord = this.normalizeRemoteRecord(remoteRecord);
		await this.saveState(state);
	}

	async clearRemoteRecord(): Promise<void> {
		const state = await this.loadState();
		state.remoteRecord = createEmptyRemoteRecord();
		await this.saveState(state);
	}

	async clearLocalRecords(): Promise<void> {
		const state = await this.loadState();
		state.localRecords = new Map();
		await this.saveState(state);
	}

	async updateFileRecord(path: string, record: SyncRecordModel): Promise<void> {
		const state = await this.loadState();
		state.localRecords.set(path, this.toLocalRecord(record));
		await this.saveState(state);
	}

	async deleteFileRecord(path: string): Promise<void> {
		const state = await this.loadState();
		if (!state.localRecords.has(path)) return;
		state.localRecords.delete(path);
		await this.saveState(state);
	}

	async getRecords(): Promise<Map<string, SyncRecordModel>> {
		const state = await this.loadState();
		const remoteStats = this.buildRemoteStatMap(state.remoteRecord);
		const records = new Map<string, SyncRecordModel>();

		for (const [path, record] of state.localRecords) {
			const remote = remoteStats.get(path);
			if (!remote) continue;

			records.set(path, {
				local: record.local,
				remote,
				base: record.base,
			});
		}

		return records;
	}

	async setRecords(records: Map<string, SyncRecordModel>) {
		const state = await this.loadState();
		state.localRecords = new Map(
			Array.from(records.entries()).map(([path, record]) => [
				path,
				this.toLocalRecord(record),
			]),
		);
		await this.saveState(state);
	}

	async getRecord(path: string): Promise<SyncRecordModel | undefined> {
		const records = await this.getRecords();
		return records.get(path);
	}

	async drop() {
		await Promise.all([syncStateKV.unset(this.namespace), syncRecordKV.unset(this.namespace)]);
	}

	async exists(path: string): Promise<boolean> {
		const state = await this.loadState();
		return state.localRecords.has(path);
	}

	async batchUpdate(updates: [string, SyncRecordModel][]): Promise<void> {
		if (updates.length === 0) return;
		const state = await this.loadState();

		for (const [path, record] of updates) {
			state.localRecords.set(path, this.toLocalRecord(record));
		}

		await this.saveState(state);
	}
}
