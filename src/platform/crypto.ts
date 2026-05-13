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
