import { normalizeRemoteDir } from '~/platform/path/remote-path';

export function stdRemotePath(remotePath: string): `/${string}/` {
	return normalizeRemoteDir(remotePath);
}
