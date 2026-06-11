import type { RemoteFs, VaultFs } from '~/fs-new';
import { hash } from '~/platform/crypto';

export default function getStateKey(webdav: RemoteFs, vault: VaultFs): string {
	return hash(`${vault.getUid()}~~${webdav.getUid()}`);
}
