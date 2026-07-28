export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hex = '0123456789abcdef';
	const lookup = Array.from({ length: 256 }, (_, i) => hex[i >> 4] + hex[i & 0xf]);
	const view = new DataView(hashBuffer);
	let output = '';
	for (let i = 0; i < 32; i++) output += lookup[view.getUint8(i)];
	return output;
}

export async function sha256Digest(data: BufferSource): Promise<ArrayBuffer> {
	return crypto.subtle.digest('SHA-256', data);
}

export function hash(input: unknown): string {
	const str = JSON.stringify(input);
	let hashHex = 0x81_1c_9d_c5;
	for (let i = 0; i < str.length; i++) {
		hashHex ^= str.charCodeAt(i);
		hashHex = Math.imul(hashHex, 0x01_00_01_93);
	}
	return (hashHex >>> 0).toString(16);
}
