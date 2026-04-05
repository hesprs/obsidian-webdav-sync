export function createStorageUnavailableError(cause: unknown): Error {
	if (cause instanceof Error)
		return new Error(`Sync state storage unavailable: ${cause.message}`);
	return new Error('Sync state storage unavailable');
}

export const STORAGE_NAME = 'obsidian-webdav-sync';
export const SYNC_STATE_STORE_NAME = 'sync-state';
export const BASE_TEXT_STORE_NAME = 'base-text';

export function parseKey(key: string) {
	const i = key.indexOf(':');
	const j = key.indexOf(':', i + 1);
	return { namespace: key.slice(i + 1, j), path: key.slice(j + 1) };
}
