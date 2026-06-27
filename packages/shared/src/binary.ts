const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function arrayBufferEquals(a: ArrayBuffer, b: ArrayBuffer): boolean {
	if (a === b) return true;
	if (a.byteLength !== b.byteLength) return false;
	const viewA = new Uint8Array(a);
	const viewB = new Uint8Array(b);
	for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
	return true;
}

export function arrayBufferToText(buffer: ArrayBuffer): string {
	return decoder.decode(buffer);
}

export function textToArrayBuffer(text: string): ArrayBuffer {
	const bytes = encoder.encode(text);
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

export function textToUint8Array(text: string): Uint8Array {
	return encoder.encode(text);
}

export function uint8ArrayToText(bytes: Uint8Array): string {
	return decoder.decode(bytes);
}
