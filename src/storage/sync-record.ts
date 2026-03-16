import type { StatModel } from '~/model/stat.model';
import { normalizeRemoteWalkPath } from '~/fs/utils/normalize-remote-walk-path';
import {
	createEmptyRemoteRecord,
	createEmptySyncState,
	type LocalRecordModel,
	type PersistedSyncStateModel,
	type RemoteRecordModel,
	type SyncStateModel,
} from '~/model/sync-record.model';
import {
	normalizeRemoteDir,
	normalizeRemotePath,
	remoteBasename,
	remoteDirname,
	remotePathToAbsolute,
} from '~/platform/path/remote-path';
import { normalizeVaultPath } from '~/platform/path/vault-path';
import { getPluginInstance, waitUntilPluginInstance } from '~/settings';

export class SyncRecord {
	constructor(
		private namespace: string,
		private remoteBaseDir: string,
	) {}

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

	private serializeState(state: SyncStateModel): PersistedSyncStateModel {
		const normalizedState = this.normalizeState(state);
		return {
			version: 1,
			remoteRecord: normalizedState.remoteRecord,
			localRecords: Object.fromEntries(normalizedState.localRecords.entries()),
		};
	}

	private normalizeState(
		state: Partial<SyncStateModel> | PersistedSyncStateModel | undefined,
	): SyncStateModel {
		if (!state) return createEmptySyncState();

		return {
			version: 1,
			remoteRecord: this.normalizeRemoteRecord(state.remoteRecord),
			localRecords: this.normalizeLocalRecords(state.localRecords),
		};
	}

	private async getSyncStates() {
		await waitUntilPluginInstance();
		const plugin = getPluginInstance();
		if (!plugin) throw new Error('Plugin instance is not ready');
		plugin.settings.syncStates ??= {};
		return {
			plugin,
			syncStates: plugin.settings.syncStates,
		};
	}

	private buildRemoteStatMap(remoteRecord: RemoteRecordModel): Map<string, StatModel> {
		const remoteStats = new Map<string, StatModel>();

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

	private buildRemoteStats(remoteRecord: RemoteRecordModel): StatModel[] {
		return Array.from(this.buildRemoteStatMap(remoteRecord).values());
	}

	private normalizeRemoteAbsolutePath(path: string): string {
		return remotePathToAbsolute(this.remoteBaseDir, path);
	}

	private normalizeRemoteNodeKey(path: string): string {
		return normalizeRemoteDir(this.normalizeRemoteAbsolutePath(path));
	}

	private normalizeRemoteStat(stat: StatModel): StatModel {
		const path = this.normalizeRemoteAbsolutePath(stat.path);
		return {
			...stat,
			path,
			basename: stat.basename || remoteBasename(path),
		};
	}

	private setRemoteRecordSource(
		remoteRecord: RemoteRecordModel,
		source: RemoteRecordModel['source'],
	) {
		remoteRecord.source = source;
	}

	private filterNodeChildren(remoteRecord: RemoteRecordModel, remotePath: string) {
		for (const [nodePath, stats] of Object.entries(remoteRecord.nodes)) {
			const nextStats = stats.filter((stat) => normalizeRemotePath(stat.path) !== remotePath);
			if (nextStats.length === stats.length) continue;
			remoteRecord.nodes[nodePath] = nextStats;
		}
	}

	private async loadState(): Promise<SyncStateModel> {
		const { syncStates } = await this.getSyncStates();
		const existingState = syncStates[this.namespace];
		if (existingState) return this.normalizeState(existingState);
		return createEmptySyncState();
	}

	private async saveState(state: SyncStateModel): Promise<void> {
		const { plugin, syncStates } = await this.getSyncStates();
		syncStates[this.namespace] = this.serializeState(state);
		await plugin.saveSettings();
	}

	async getState(): Promise<SyncStateModel> {
		return await this.loadState();
	}

	async setState(state: SyncStateModel): Promise<void> {
		await this.saveState(state);
	}

	async mutateState(mutator: (state: SyncStateModel) => void | Promise<void>): Promise<void> {
		const state = await this.loadState();
		await mutator(state);
		await this.saveState(state);
	}

	async getLocalRecords(): Promise<Map<string, LocalRecordModel>> {
		const state = await this.loadState();
		return new Map(state.localRecords);
	}

	async getRemoteRecord(): Promise<RemoteRecordModel> {
		const state = await this.loadState();
		return state.remoteRecord;
	}

	async getRemoteStats(): Promise<StatModel[]> {
		const state = await this.loadState();
		return this.buildRemoteStats(state.remoteRecord);
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

	upsertRemotePathInState(state: SyncStateModel, stat: StatModel): void {
		const normalizedStat = this.normalizeRemoteStat(stat);
		const remoteRecord = state.remoteRecord;
		const parentPath = this.normalizeRemoteNodeKey(remoteDirname(normalizedStat.path));
		const siblings = remoteRecord.nodes[parentPath] ?? [];
		const nextSiblings = siblings.filter(
			(item) => normalizeRemotePath(item.path) !== normalizeRemotePath(normalizedStat.path),
		);
		nextSiblings.push(normalizedStat);
		remoteRecord.nodes[parentPath] = nextSiblings;

		if (normalizedStat.isDir) {
			const dirKey = this.normalizeRemoteNodeKey(normalizedStat.path);
			remoteRecord.nodes[dirKey] ??= [];
		}

		this.setRemoteRecordSource(remoteRecord, 'task-updated');
	}

	removeRemotePathInState(state: SyncStateModel, remotePath: string): void {
		const normalizedRemotePath = normalizeRemotePath(
			this.normalizeRemoteAbsolutePath(remotePath),
		);
		this.filterNodeChildren(state.remoteRecord, normalizedRemotePath);
		delete state.remoteRecord.nodes[this.normalizeRemoteNodeKey(normalizedRemotePath)];
		state.remoteRecord.queue = state.remoteRecord.queue.filter(
			(path) => normalizeRemotePath(path) !== normalizedRemotePath,
		);
		this.setRemoteRecordSource(state.remoteRecord, 'task-updated');
	}

	removeRemoteSubtreeInState(state: SyncStateModel, remotePath: string): void {
		const normalizedRemotePath = normalizeRemotePath(
			this.normalizeRemoteAbsolutePath(remotePath),
		);
		const normalizedRemoteDir = normalizeRemoteDir(normalizedRemotePath);

		this.filterNodeChildren(state.remoteRecord, normalizedRemotePath);

		for (const nodePath of Object.keys(state.remoteRecord.nodes)) {
			if (nodePath === normalizedRemoteDir || nodePath.startsWith(normalizedRemoteDir)) {
				delete state.remoteRecord.nodes[nodePath];
				continue;
			}

			state.remoteRecord.nodes[nodePath] = state.remoteRecord.nodes[nodePath].filter(
				(stat) => {
					const childPath = normalizeRemotePath(stat.path);
					return (
						childPath !== normalizedRemotePath &&
						!childPath.startsWith(normalizedRemoteDir)
					);
				},
			);
		}

		state.remoteRecord.queue = state.remoteRecord.queue.filter((path) => {
			const normalizedPath = normalizeRemotePath(path);
			return (
				normalizedPath !== normalizedRemotePath &&
				!normalizedPath.startsWith(normalizedRemoteDir)
			);
		});

		this.setRemoteRecordSource(state.remoteRecord, 'task-updated');
	}

	upsertLocalRecordInState(state: SyncStateModel, path: string, record: LocalRecordModel): void {
		state.localRecords.set(normalizeVaultPath(path), record);
	}

	removeLocalRecordInState(state: SyncStateModel, path: string): void {
		state.localRecords.delete(normalizeVaultPath(path));
	}

	removeLocalSubtreeInState(state: SyncStateModel, path: string): void {
		const normalizedPath = normalizeVaultPath(path);
		const normalizedDir = normalizedPath.length === 0 ? '' : `${normalizedPath}/`;

		for (const key of Array.from(state.localRecords.keys())) {
			if (key === normalizedPath || (normalizedDir && key.startsWith(normalizedDir))) {
				state.localRecords.delete(key);
			}
		}
	}

	async drop() {
		const { plugin, syncStates } = await this.getSyncStates();
		delete syncStates[this.namespace];
		await plugin.saveSettings();
	}
}
