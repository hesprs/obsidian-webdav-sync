import { normalize } from 'node:path';

export function stdRemotePath(remotePath: string): `/${string}/` {
	if (!remotePath.startsWith('/')) remotePath = `/${remotePath}`;
	if (!remotePath.endsWith('/')) remotePath = `${remotePath}/`;
	return normalize(remotePath) as `/${string}/`;
}
