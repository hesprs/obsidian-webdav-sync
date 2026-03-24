function normalizeVaultSegment(segment: string): string {
	return segment.normalize('NFC');
}

function splitVaultSegments(path: string): string[] {
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
		resolved.push(normalizeVaultSegment(segment));
	}

	return resolved;
}

export function normalizeVaultPath(path: string): string {
	return splitVaultSegments(path).join('/');
}

export function joinVaultPath(...parts: string[]): string {
	return normalizeVaultPath(parts.join('/'));
}

export function vaultDirname(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') {
		return '.';
	}

	const lastSlashIndex = normalized.lastIndexOf('/');
	if (lastSlashIndex === -1) {
		return '.';
	}

	return normalized.slice(0, lastSlashIndex) || '.';
}

export function vaultBasename(path: string): string {
	const normalized = normalizeVaultPath(path);
	if (normalized === '') {
		return '';
	}

	const lastSlashIndex = normalized.lastIndexOf('/');
	return lastSlashIndex === -1 ? normalized : normalized.slice(lastSlashIndex + 1);
}
