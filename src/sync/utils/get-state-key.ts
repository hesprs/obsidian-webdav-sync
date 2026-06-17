import type { RemoteFs, LocalFs } from '~/fs';
import { hash } from '~/utils/crypto';

export default function getStateKey(webdav: RemoteFs, vault: LocalFs): string {
	return hash(`${vault.getUid()}~~${webdav.getUid()}`);
}
