// #region Normalize Path
export function normalizeChar(path: string) {
	return path
		.split('/')
		.map((segment) => decodeURIComponent(segment.normalize('NFC')))
		.join('/');
}

export function normalizeKey(path: string, isDir: boolean) {
	const noSlashes = path
		.split('/')
		.filter((segment) => segment !== '')
		.join('/');
	return isDir ? `${noSlashes}/` : noSlashes;
}

export function normalizeBaseDir(path: string): string {
	return normalizeKey(normalizeChar(path), true);
}
// #endregion ======================================================================

// #region Dirname / Basename
export function dirname(key: string) {
	if (key === '/') return '/';
	if (key.endsWith('/')) key = key.slice(0, -1);
	const lastSlashIndex = key.lastIndexOf('/');
	return lastSlashIndex <= 0 ? '/' : key.slice(0, lastSlashIndex + 1);
}

export function basename(key: string): string {
	if (key === '/') return '';
	if (key.endsWith('/')) key = key.slice(0, -1);
	const lastSlashIndex = key.lastIndexOf('/');
	return key.slice(lastSlashIndex + 1);
}
// #endregion ======================================================================

export function normalizeUrl(value: string) {
	const parsedUrl = new URL(value);
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error(`Invalid URL ${value}`);
	return parsedUrl.toString().replace(/\/+$/, '');
}

export function stripEndSlash(key: string) {
	if (key.endsWith('/')) return key.slice(0, -1);
	return key;
}
