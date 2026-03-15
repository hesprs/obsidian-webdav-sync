import { remotePathToLocalRelative } from '~/platform/path/remote-path';

export function remotePathToLocalPath(remoteBaseDir: string, remotePath: string) {
	return remotePathToLocalRelative(remoteBaseDir, remotePath);
}
