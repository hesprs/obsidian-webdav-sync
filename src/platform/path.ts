function splitSegments(path: string): Array<string> {
	const normalized = path.replace(/\\/g, '/');
	const segments = normalized.split('/');
	const resolved: Array<string> = [];

	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			resolved.pop();
			continue;
		}
		resolved.push(segment.normalize('NFC'));
	}

	return resolved;
}

// #region Normalize Path
export function normalizeRemotePath(path: string) {
	const normalized = splitSegments(path).join('/');
	return normalized === '' ? '/' : `/${normalized}`;
}

export function normalizePathToRelative(remoteBaseDir: string, remotePath: string): string {
	const normalizedBasePath = normalizeRemotePath(remoteBaseDir);
	const normalizedRemotePath = normalizeRemotePath(remotePath);

	if (normalizedRemotePath === normalizedBasePath) return '/';

	// Already relative
	if (!normalizedRemotePath.startsWith(normalizedBasePath) || remoteBaseDir === '/')
		return normalizedRemotePath.slice(1);

	//
	return normalizedRemotePath.replace(normalizedBasePath, '').slice(1);
}

export function normalizePathToAbsolute(
	remoteBaseDir: string,
	path: string,
	isDir: boolean,
): string {
	const base = normalizeRemotePath(remoteBaseDir);
	let result = normalizeRemotePath(path);
	if (!result.startsWith(base)) result = `${base}${result}`;
	if (isDir && !result.endsWith('/')) result = `${result}/`;
	return result;
}

export function normalizeVaultPath(path: string): string {
	return splitSegments(path).join('/');
}

export function normalizeBaseDir(path: string): string {
	const dir = normalizeRemotePath(path);
	return dir === '/' ? '/' : `${dir}/`;
}

export function splitRemotePathAtBaseDir(remoteBaseDir: string, remotePath: string) {
	const baseDir = normalizeBaseDir(remoteBaseDir);
	const isDir = remotePath !== '/' && remotePath.endsWith('/');
	const normalizedPath = isDir ? normalizeBaseDir(remotePath) : normalizeRemotePath(remotePath);
	const relativePath = normalizePathToRelative(baseDir, normalizedPath);
	return {
		baseDir,
		descendantSegments: relativePath === '/' ? [] : relativePath.split('/'),
		isDir,
	};
}

export function joinRemotePathFromBaseDir(
	remoteBaseDir: string,
	descendantSegments: Array<string>,
	isDir: boolean,
): string {
	const baseDir = normalizeBaseDir(remoteBaseDir);
	if (descendantSegments.length === 0) return baseDir;
	const relativePath = descendantSegments.join('/');
	return `${baseDir}${relativePath}${isDir ? '/' : ''}`;
}
// #endregion ======================================================================

// #region Dirname / Basename
export function vaultDirname(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') return '.';
	const lastSlashIndex = normalized.lastIndexOf('/');
	if (lastSlashIndex === -1) return '.';
	return normalized.slice(0, lastSlashIndex) || '.';
}

export function remoteDirname(path: string): `/${string}/` | '/' {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') return '/';

	const lastSlashIndex = normalized.lastIndexOf('/');
	return (lastSlashIndex <= 0 ? '/' : normalized.slice(0, lastSlashIndex) + 1) as `/${string}/`;
}

export function vaultBasename(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') return '';
	const lastSlashIndex = normalized.lastIndexOf('/');
	return lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1);
}

export function remoteBasename(path: string): string {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') return '';

	const lastSlashIndex = normalized.lastIndexOf('/');
	return normalized.slice(lastSlashIndex + 1);
}
// #endregion ======================================================================
