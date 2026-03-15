import {
	isAbsoluteRemotePath,
	joinRemotePath,
	normalizeRemotePath,
} from '~/platform/path/remote-path';

export default function remotePathToAbsolute(remoteBaseDir: string, remotePath: string): string {
	return isAbsoluteRemotePath(remotePath)
		? normalizeRemotePath(remotePath)
		: joinRemotePath(remoteBaseDir, remotePath);
}
