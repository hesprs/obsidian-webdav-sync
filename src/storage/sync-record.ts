import type { StatModel } from '~/types';
import { type SyncStateModel } from '~/types';
import {
	createSyncState,
	type IndexedDbBaseTextStore,
	type IndexedDbSyncStateStore,
} from './store';

export class SyncRecord {
	constructor(
		private namespace: string,
		private stateStore: IndexedDbSyncStateStore,
		private textStore: IndexedDbBaseTextStore,
	) {}

	private upsertSyncedFileInState(
		state: SyncStateModel,
		params: {
			key: string;
			localStat: StatModel;
			remoteStat: StatModel;
		},
	): void {
		const { key, localStat, remoteStat } = params;
		this.upsertLocalRecordInState(state, key, localStat);
		this.upsertRemoteRecordInState(state, key, remoteStat);
	}

	async loadState(): Promise<SyncStateModel> {
		const [remote, local] = await Promise.all([
			this.stateStore.getRemote(this.namespace),
			this.stateStore.getLocal(this.namespace),
		]);

		return createSyncState(remote, local);
	}

	private async saveState(state: SyncStateModel): Promise<void> {
		await Promise.all([
			this.stateStore.setRemote(this.namespace, state.remoteRecords),
			this.stateStore.setLocal(this.namespace, state.localRecords),
		]);
	}

	private async mutateState(
		mutator: (state: SyncStateModel) => void | Promise<void>,
	): Promise<void> {
		const state = await this.loadState();
		await mutator(state);
		await this.saveState(state);
	}

	private upsertLocalRecordInState(state: SyncStateModel, path: string, record: StatModel): void {
		state.localRecords.set(path, record);
	}

	private upsertRemoteRecordInState(
		state: SyncStateModel,
		path: string,
		record: StatModel,
	): void {
		state.remoteRecords.set(path, record);
	}

	async removeRecords(path: string): Promise<void> {
		await Promise.all([
			this.mutateState((state) => {
				state.localRecords.delete(path);
				state.remoteRecords.delete(path);
			}),
			this.removeBaseText(path),
		]);
	}

	async removeRecordSubtree(path: string): Promise<void> {
		const keys = await this.textStore.getKeys();
		const toDelete = keys
			.filter((key) => {
				const { namespace, path } = this.textStore.parseKey(key);
				return namespace === this.namespace && path.startsWith(path);
			})
			.map((key) => this.removeBaseText(key));
		await Promise.all([
			this.mutateState((state) => {
				const normalizedDir = `${path}/`;

				for (const key of Array.from(state.localRecords.keys())) {
					if (key.startsWith(normalizedDir)) state.localRecords.delete(key);
				}

				for (const key of Array.from(state.remoteRecords.keys())) {
					if (key.startsWith(normalizedDir)) state.remoteRecords.delete(key);
				}
			}),
			...toDelete,
		]);
	}

	async upsertRecords(params: {
		key: string;
		localStat: StatModel;
		remoteStat: StatModel;
		baseText?: string;
	}): Promise<void> {
		await Promise.all([
			this.mutateState((state) => {
				this.upsertSyncedFileInState(state, params);
			}),
			params.baseText ? this.upsertBaseText(params.key, params.baseText) : () => {},
		]);
	}

	async getBaseText(path: string): Promise<string | undefined> {
		return await this.textStore.get(this.namespace, path);
	}

	private async upsertBaseText(path: string, baseText: string): Promise<void> {
		await this.textStore.set(this.namespace, path, baseText);
	}

	private async removeBaseText(path: string): Promise<void> {
		await this.textStore.remove(this.namespace, path);
	}

	async drop() {
		await this.stateStore.delete(this.namespace);
		await this.textStore.delete(this.namespace);
	}
}
