// oxlint-disable-next-line typescript/no-explicit-any
type General = any;

export async function sha256Digest(data: BufferSource): Promise<ArrayBuffer> {
	return globalThis.crypto.subtle.digest('SHA-256', data);
}

function stableStringify(obj: General): string {
	if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
	if (Array.isArray(obj)) return '[' + obj.map((item) => stableStringify(item)).join(',') + ']';

	// Handle circular references safely
	const seen = new WeakSet();
	const stringify = (value: General): string => {
		if (value === null || typeof value !== 'object') return JSON.stringify(value);
		if (seen.has(value)) return '"[Circular]"';
		seen.add(value);

		if (Array.isArray(value)) return '[' + value.map((item) => stringify(item)).join(',') + ']';

		const keys = Object.keys(value).sort();
		return '{' + keys.map((key) => `"${key}":${stringify(value[key])}`).join(',') + '}';
	};

	return stringify(obj);
}

export function hash(input: General): string {
	const str = typeof input === 'string' ? input : stableStringify(input);
	let hash = 0x811c9dc5;
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

export function isEqual(a: General, b: General): boolean {
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

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!keysB.includes(key)) return false;
		if (!isEqual(a[key], b[key])) return false;
	}

	return true;
}
