import type { StatModel } from './stat.model';

export interface BaseBlobRef {
	key: string;
}

export interface LocalRecordModel {
	local: StatModel;
	base?: BaseBlobRef;
}

export interface SyncRecordModel {
	local: StatModel;
	remote: StatModel;
	base?: BaseBlobRef;
}

export interface RemoteRecordModel {
	queue: string[];
	nodes: Record<string, StatModel[]>;
	isComplete: boolean;
	lastNormalSyncAt?: number;
	source?: 'normal-sync' | 'task-updated' | 'imported';
}

export interface SyncStateModel {
	version: 1;
	remoteRecord: RemoteRecordModel;
	localRecords: Map<string, LocalRecordModel>;
}

export function createEmptyRemoteRecord(): RemoteRecordModel {
	return {
		queue: [],
		nodes: {},
		isComplete: false,
	};
}

export function createEmptySyncState(): SyncStateModel {
	return {
		version: 1,
		remoteRecord: createEmptyRemoteRecord(),
		localRecords: new Map(),
	};
}
