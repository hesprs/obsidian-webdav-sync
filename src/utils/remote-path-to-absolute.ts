import { isAbsolute, join } from 'node:path';

export default function remotePathToAbsolute(remoteBaseDir: string, remotePath: string): string {
	return isAbsolute(remotePath) ? remotePath : join(remoteBaseDir, remotePath);
}
