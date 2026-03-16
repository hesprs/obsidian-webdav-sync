import { hash } from '~/platform/crypto';
import { normalizeRemoteDir } from '~/platform/path/remote-path';

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
		remoteBaseDir: normalizeRemoteDir(remoteBaseDir),
		serverUrl: serverUrl?.trim().replace(/\/+$/, '') || '',
		account: account?.trim() || '',
	});
}
