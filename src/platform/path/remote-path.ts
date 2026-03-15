import { normalizeVaultPath } from './vault-path';

function splitRemoteSegments(path: string): string[] {
	const normalized = path.replaceAll('\\', '/');
	const segments = normalized.split('/');
	const resolved: string[] = [];

	for (const segment of segments) {
		if (segment === '' || segment === '.') {
			continue;
		}
		if (segment === '..') {
			resolved.pop();
			continue;
		}
		resolved.push(segment);
	}

	return resolved;
}

export function isAbsoluteRemotePath(path: string): boolean {
	return path.startsWith('/');
}

export function normalizeRemotePath(path: string): `/${string}` {
	const normalized = splitRemoteSegments(path).join('/');
	return (normalized === '' ? '/' : `/${normalized}`) as `/${string}`;
}

export function normalizeRemoteDir(path: string): `/${string}/` {
	const normalized = normalizeRemotePath(path);
	return (normalized === '/' ? '/' : `${normalized}/`) as `/${string}/`;
}

export function joinRemotePath(...parts: string[]): `/${string}` {
	return normalizeRemotePath(parts.join('/'));
}

export function remoteDirname(path: string): `/${string}` {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') {
		return '/';
	}

	const lastSlashIndex = normalized.lastIndexOf('/');
	return (lastSlashIndex <= 0 ? '/' : normalized.slice(0, lastSlashIndex)) as `/${string}`;
}

export function remoteBasename(path: string): string {
	const normalized = normalizeRemotePath(path);
	if (normalized === '/') {
		return '';
	}

	const lastSlashIndex = normalized.lastIndexOf('/');
	return normalized.slice(lastSlashIndex + 1);
}

export function remotePathToLocalRelative(remoteBaseDir: string, remotePath: string): string {
	if (!isAbsoluteRemotePath(remotePath)) {
		return normalizeVaultPath(remotePath);
	}

	const normalizedBasePath = normalizeRemotePath(remoteBaseDir);
	const normalizedBaseDir = normalizeRemoteDir(remoteBaseDir);
	const normalizedRemotePath = normalizeRemotePath(remotePath);

	if (normalizedRemotePath === normalizedBasePath) {
		return '';
	}

	if (normalizedBasePath !== '/' && normalizedRemotePath.startsWith(normalizedBaseDir)) {
		return normalizeVaultPath(normalizedRemotePath.slice(normalizedBaseDir.length));
	}

	return normalizeVaultPath(normalizedRemotePath.slice(1));
}
