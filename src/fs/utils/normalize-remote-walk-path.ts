import { remotePathToLocalRelative } from '~/platform/path/remote-path';

export function normalizeRemoteWalkPath(path: string, remoteBaseDir: string): string {
	return remotePathToLocalRelative(remoteBaseDir, path);
}
