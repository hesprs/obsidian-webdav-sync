export async function sha256Digest(data: BufferSource): Promise<ArrayBuffer> {
	return globalThis.crypto.subtle.digest('SHA-256', data);
}

export function hash(input: unknown): string {
	const str = JSON.stringify(input);
	let hash = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

export function isEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== typeof b) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (!isEqual(a[i], b[i])) return false;
		return true;
	}
	if (Array.isArray(a) || Array.isArray(b)) return false;

	if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

	type GeneralObj = Record<string, unknown>;

	const keysA = Object.keys(a as GeneralObj);
	const keysB = Object.keys(b as GeneralObj);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!keysB.includes(key)) return false;
		if (!isEqual((a as GeneralObj)[key], (b as GeneralObj)[key])) return false;
	}

	return true;
}
