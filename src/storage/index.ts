import type { Stat } from '~/fs-new';
import type { RecordStat } from '~/types';

export { default as SyncRecord } from './sync-record';
export { default as IndexedDbSyncStateStore } from './sync-record.store';
export { default as IndexedDbBaseTextStore } from './base-text.store';
export * from './store.interface';

export function toRecordStat(local: Stat, remote: Stat): RecordStat {
	return !local.isDir && !remote.isDir
		? { isDir: false, local: local.uid, remote: remote.uid }
		: { isDir: true };
}
