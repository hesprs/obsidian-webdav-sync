import { isAbsolute } from 'path-browserify';
import { stdRemotePath } from '../../utils/std-remote-path';

export function normalizeRemoteWalkPath(path: string, remoteBaseDir: string): string {
	let normalizedPath = path;
	if (normalizedPath.endsWith('/'))
		normalizedPath = normalizedPath.slice(0, normalizedPath.length - 1);
	if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`;

	const base = stdRemotePath(remoteBaseDir);
	if (remoteBaseDir !== '/' && normalizedPath.startsWith(base))
		normalizedPath = normalizedPath.slice(base.length - 1);

	if (isAbsolute(normalizedPath) && normalizedPath.startsWith('/'))
		normalizedPath = normalizedPath.slice(1);

	return normalizedPath;
}
