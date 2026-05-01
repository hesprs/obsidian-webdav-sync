import { hash } from '~/platform/crypto';
import { normalizeBaseDir } from '~/platform/path';

export type SyncStateIdentity = {
	vaultName: string;
	remoteBaseDir: string;
	serverUrl?: string;
	account?: string;
};

export function getSyncStateKey({
	vaultName,
	remoteBaseDir,
	serverUrl,
	account,
}: SyncStateIdentity) {
	return hash({
		account: account?.trim() || '',
		remoteBaseDir: normalizeBaseDir(remoteBaseDir),
		serverUrl: serverUrl?.trim().replace(/\/+$/, '') || '',
		vaultName,
	});
}
