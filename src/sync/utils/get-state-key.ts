import type { RemoteFs, VaultFs } from '~/fs';
import { hash } from '~/utils/crypto';

export default function getStateKey(webdav: RemoteFs, vault: VaultFs): string {
	return hash(`${vault.getUid()}~~${webdav.getUid()}`);
}
