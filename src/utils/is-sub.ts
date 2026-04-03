import { normalizeRemotePath, normalizeVaultPath } from '~/platform/path';

function normalizeComparablePath(path: string): string {
	return path.startsWith('/') ? normalizeRemotePath(path) : normalizeVaultPath(path);
}

export function isSub(parent: string, sub: string) {
	parent = normalizeComparablePath(parent);
	sub = normalizeComparablePath(sub);
	if (!parent.endsWith('/')) parent += '/';
	if (!sub.endsWith('/')) sub += '/';
	if (sub === parent) return false;
	return sub.startsWith(parent);
}
