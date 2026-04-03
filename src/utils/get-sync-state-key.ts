import { hash } from '~/platform/crypto';
import { normalizeBaseDir } from '~/platform/path';

export interface SyncStateIdentity {
	vaultName: string;
	remoteBaseDir: string;
	serverUrl?: string;
	account?: string;
}

export function getSyncStateKey({
	vaultName,
	remoteBaseDir,
	serverUrl,
	account,
}: SyncStateIdentity) {
	return hash({
		vaultName,
		remoteBaseDir: normalizeBaseDir(remoteBaseDir),
		serverUrl: serverUrl?.trim().replace(/\/+$/, '') || '',
		account: account?.trim() || '',
	});
}
