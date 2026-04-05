import type { StatModel } from '~/types';

function normalizeSegment(segment: string): string {
	return segment.normalize('NFC');
}

function splitRemoteSegments(path: string): string[] {
	const normalized = path.replaceAll('\\', '/');
	const segments = normalized.split('/');
	const resolved: string[] = [];

	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			resolved.pop();
			continue;
		}
		resolved.push(normalizeSegment(segment));
	}

	return resolved;
}

export function normalizeRemotePath(path: string) {
	const normalized = splitRemoteSegments(path).join('/');
	return normalized === '' ? '/' : `/${normalized}`;
}

export function remoteDirname(path: string): `/${string}/` | '/' {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') return '/';

	const lastSlashIndex = normalized.lastIndexOf('/');
	return (lastSlashIndex <= 0 ? '/' : normalized.slice(0, lastSlashIndex) + 1) as `/${string}/`;
}

export function remoteBasename(path: string): string {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') return '';

	const lastSlashIndex = normalized.lastIndexOf('/');
	return normalized.slice(lastSlashIndex + 1);
}

export function normalizeBaseDir(path: string): string {
	const dir = normalizeRemotePath(path);
	return dir === '/' ? '/' : `${dir}/`;
}

export function remotePathToVault(remoteBaseDir: string, remotePath: string): string {
	const normalizedBasePath = normalizeRemotePath(remoteBaseDir);
	const normalizedRemotePath = normalizeRemotePath(remotePath);

	if (normalizedRemotePath === normalizedBasePath) return '/';

	// already relative
	if (!normalizedRemotePath.startsWith(normalizedBasePath) || remoteBaseDir === '/')
		return normalizedRemotePath.slice(1);

	//
	return normalizedRemotePath.replace(normalizedBasePath, '').slice(1);
}

// should only be used during WebDAV traversal (single source of inflow)
export function remotePathToAbsolute(remoteBaseDir: string, stat: StatModel): string {
	const base = normalizeRemotePath(remoteBaseDir);
	let result = normalizeRemotePath(stat.path);
	if (!result.startsWith(base)) result = `${base}${result}`;
	if (stat.isDir) result = `${result}/`;
	return result;
}

export function inferRemotePathFromVault(remoteBaseDir: string, vaultStat?: StatModel): string {
	if (vaultStat) return remotePathToAbsolute(remoteBaseDir, vaultStat);
	return normalizeBaseDir(remoteBaseDir);
}

function splitVaultSegments(path: string): string[] {
	const normalized = path.replaceAll('\\', '/');
	const segments = normalized.split('/');
	const resolved: string[] = [];

	for (const segment of segments) {
		if (segment === '' || segment === '.') continue;
		if (segment === '..') {
			resolved.pop();
			continue;
		}
		resolved.push(normalizeSegment(segment));
	}

	return resolved;
}

// should only be used during stat vault item (single source of inflow)
export function normalizeVaultPath(path: string): string {
	return splitVaultSegments(path).join('/');
}

export function vaultDirname(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') return '.';
	const lastSlashIndex = normalized.lastIndexOf('/');
	if (lastSlashIndex === -1) return '.';
	return normalized.slice(0, lastSlashIndex) || '.';
}

export function vaultBasename(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') return '';
	const lastSlashIndex = normalized.lastIndexOf('/');
	return lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1);
}
