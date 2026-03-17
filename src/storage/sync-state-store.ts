import type { LocalRecordModel, RemoteRecordModel } from '~/model/sync-record.model';

export type PersistedLocalRecordsModel = Record<string, LocalRecordModel>;

export interface SyncStateStore {
	initialize(): Promise<void>;
	getRemote(namespace: string): Promise<RemoteRecordModel | undefined>;
	setRemote(namespace: string, remoteRecord: RemoteRecordModel): Promise<void>;
	clearRemote(namespace: string): Promise<void>;
	getLocal(namespace: string): Promise<PersistedLocalRecordsModel | undefined>;
	setLocal(namespace: string, localRecords: PersistedLocalRecordsModel): Promise<void>;
	delete(namespace: string): Promise<void>;
}
