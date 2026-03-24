import type { StatModel } from '~/model/stat.model';
import { normalizeRemoteWalkPath } from '~/fs/utils/normalize-remote-walk-path';
import {
	createEmptySyncState,
	type LocalRecordModel,
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
import { normalizeVaultPath, vaultBasename } from '~/platform/path/vault-path';
import type { PersistedLocalRecordsModel, SyncStateStore } from './store.interface';

export class SyncRecord {
	constructor(
		private namespace: string,
		private remoteBaseDir: string,
		private store: SyncStateStore,
	) {}

	private normalizeLocalRecords(
		localRecords: Map<string, LocalRecordModel> | Record<string, LocalRecordModel> | undefined,
	): Map<string, LocalRecordModel> {
		const entries =
			localRecords instanceof Map
				? Array.from(localRecords.entries())
				: localRecords && typeof localRecords === 'object'
					? Object.entries(localRecords)
					: [];

		return new Map(
			entries.map(([path, record]) => [
				normalizeVaultPath(path),
				this.normalizeLocalRecord(record),
			]),
		);
	}

	private normalizeRemoteRecord(
		remoteRecord: Partial<RemoteRecordModel> | undefined,
	): RemoteRecordModel {
		const queue = Array.isArray(remoteRecord?.queue)
			? Array.from(
					new Set(remoteRecord.queue.map((path) => this.normalizeRemoteNodeKey(path))),
				)
			: [];
		const nodes = this.normalizeRemoteNodes(remoteRecord?.nodes);

		return {
			queue,
			nodes,
			isComplete: remoteRecord?.isComplete ?? queue.length === 0,
			lastNormalSyncAt: remoteRecord?.lastNormalSyncAt,
			source: remoteRecord?.source,
		};
	}

	private serializeLocalRecords(
		localRecords: Map<string, LocalRecordModel>,
	): PersistedLocalRecordsModel {
		return Object.fromEntries(localRecords.entries());
	}

	private normalizeLocalRecord(record: LocalRecordModel): LocalRecordModel {
		return {
			...record,
			local: this.projectLocalStat(record.local.path, record.local),
		};
	}

	private normalizeRemoteNodes(nodes: unknown): Record<string, StatModel[]> {
		if (!nodes || typeof nodes !== 'object') return {};

		const normalizedNodes: Record<string, StatModel[]> = {};

		for (const [nodePath, stats] of Object.entries(nodes)) {
			if (!Array.isArray(stats)) continue;

			const normalizedNodePath = this.normalizeRemoteNodeKey(nodePath);
			const mergedStats = new Map<string, StatModel>(
				(normalizedNodes[normalizedNodePath] ?? []).map((stat) => [stat.path, stat]),
			);

			for (const stat of stats) {
				const normalizedStat = this.normalizeRemoteStat(stat);
				mergedStats.set(normalizedStat.path, normalizedStat);
			}

			normalizedNodes[normalizedNodePath] = Array.from(mergedStats.values());
		}

		return normalizedNodes;
	}

	private normalizeState(
		state:
			| (Omit<Partial<SyncStateModel>, 'localRecords'> & {
					localRecords?: Map<string, LocalRecordModel> | PersistedLocalRecordsModel;
			  })
			| undefined,
	): SyncStateModel {
		if (!state) return createEmptySyncState();

		return {
			version: 1,
			remoteRecord: this.normalizeRemoteRecord(state.remoteRecord),
			localRecords: this.normalizeLocalRecords(state.localRecords),
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

	private projectLocalStat(path: string, stat: StatModel): StatModel {
		const normalizedPath = normalizeVaultPath(path);
		const basename = vaultBasename(normalizedPath);
		if (stat.isDir) {
			return {
				path: normalizedPath,
				basename,
				isDir: true,
				isDeleted: stat.isDeleted,
				mtime: stat.mtime,
			};
		}

		return {
			path: normalizedPath,
			basename,
			isDir: false,
			isDeleted: stat.isDeleted,
			mtime: stat.mtime,
			size: stat.size,
		};
	}

	private createDirStat(path: string): StatModel {
		const normalizedPath = normalizeVaultPath(path);
		return {
			path: normalizedPath,
			basename: vaultBasename(normalizedPath),
			isDir: true,
			isDeleted: false,
		};
	}

	private upsertSyncedFileInState(
		state: SyncStateModel,
		params: {
			localPath: string;
			remotePath: string;
			localStat: StatModel;
			remoteStat: StatModel;
			baseText?: string;
		},
	): void {
		const { localPath, localStat, baseText, remotePath, remoteStat } = params;
		this.upsertLocalRecordInState(state, localPath, {
			local: this.projectLocalStat(localPath, localStat),
			...(baseText === undefined ? {} : { baseText }),
		});
		this.upsertRemotePathInState(state, {
			...remoteStat,
			path: remotePath,
			basename: remoteBasename(remotePath),
		});
	}

	private filterNodeChildren(remoteRecord: RemoteRecordModel, remotePath: string) {
		for (const [nodePath, stats] of Object.entries(remoteRecord.nodes)) {
			const nextStats = stats.filter((stat) => normalizeRemotePath(stat.path) !== remotePath);
			if (nextStats.length === stats.length) continue;
			remoteRecord.nodes[nodePath] = nextStats;
		}
	}

	private async loadState(): Promise<SyncStateModel> {
		const [remoteRecord, localRecords] = await Promise.all([
			this.store.getRemote(this.namespace),
			this.store.getLocal(this.namespace),
		]);

		return this.normalizeState({
			remoteRecord,
			localRecords,
		});
	}

	private async saveState(state: SyncStateModel): Promise<void> {
		const normalizedState = this.normalizeState(state);
		await Promise.all([
			this.store.setRemote(this.namespace, normalizedState.remoteRecord),
			this.store.setLocal(
				this.namespace,
				this.serializeLocalRecords(normalizedState.localRecords),
			),
		]);
	}

	private async mutateState(
		mutator: (state: SyncStateModel) => void | Promise<void>,
	): Promise<void> {
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
		await this.store.setRemote(this.namespace, this.normalizeRemoteRecord(remoteRecord));
	}

	async clearRemoteRecord(): Promise<void> {
		await this.store.clearRemote(this.namespace);
	}

	private upsertRemotePathInState(state: SyncStateModel, stat: StatModel): void {
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

	private removeRemotePathInState(state: SyncStateModel, remotePath: string): void {
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

	private removeRemoteSubtreeInState(state: SyncStateModel, remotePath: string): void {
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

	private upsertLocalRecordInState(
		state: SyncStateModel,
		path: string,
		record: LocalRecordModel,
	): void {
		state.localRecords.set(normalizeVaultPath(path), this.normalizeLocalRecord(record));
	}

	private removeLocalRecordInState(state: SyncStateModel, path: string): void {
		state.localRecords.delete(normalizeVaultPath(path));
	}

	private removeLocalSubtreeInState(state: SyncStateModel, path: string): void {
		const normalizedPath = normalizeVaultPath(path);
		const normalizedDir = normalizedPath.length === 0 ? '' : `${normalizedPath}/`;

		for (const key of Array.from(state.localRecords.keys())) {
			if (key === normalizedPath || (normalizedDir && key.startsWith(normalizedDir))) {
				state.localRecords.delete(key);
			}
		}
	}

	async removeLocalRecordPath(path: string): Promise<void> {
		await this.mutateState((state) => {
			this.removeLocalRecordInState(state, path);
		});
	}

	async removeLocalRecordSubtree(path: string): Promise<void> {
		await this.mutateState((state) => {
			this.removeLocalSubtreeInState(state, path);
		});
	}

	async removeRemoteRecordPath(path: string): Promise<void> {
		await this.mutateState((state) => {
			this.removeRemotePathInState(state, path);
		});
	}

	async removeRemoteRecordSubtree(path: string): Promise<void> {
		await this.mutateState((state) => {
			this.removeRemoteSubtreeInState(state, path);
		});
	}

	async cleanOrphanedRecordPaths(localPath: string, remotePath: string): Promise<void> {
		await this.mutateState((state) => {
			this.removeLocalSubtreeInState(state, localPath);
			this.removeRemoteSubtreeInState(state, remotePath);
		});
	}

	async upsertSyncedFileFromSnapshots(params: {
		localPath: string;
		remotePath: string;
		localStat: StatModel;
		remoteStat: StatModel;
		baseText?: string;
	}): Promise<void> {
		await this.mutateState((state) => {
			this.upsertSyncedFileInState(state, params);
		});
	}

	async upsertSyncedDirectoryFromSnapshots(params: {
		localPath: string;
		remotePath: string;
		localStat?: StatModel;
		remoteStat?: StatModel;
	}): Promise<void> {
		await this.mutateState((state) => {
			const { localPath, remotePath, localStat, remoteStat } = params;
			const resolvedLocalStat =
				localStat && localStat.isDir ? localStat : this.createDirStat(localPath);
			const resolvedRemoteStat =
				remoteStat && remoteStat.isDir
					? remoteStat
					: {
							...this.createDirStat(localPath),
							path: remotePath,
							basename: remoteBasename(remotePath),
						};
			this.upsertLocalRecordInState(state, localPath, {
				local: this.projectLocalStat(localPath, resolvedLocalStat),
			});
			this.upsertRemotePathInState(state, {
				...resolvedRemoteStat,
				path: remotePath,
				basename: remoteBasename(remotePath),
				isDir: true,
			});
		});
	}

	async drop() {
		await this.store.delete(this.namespace);
	}
}
