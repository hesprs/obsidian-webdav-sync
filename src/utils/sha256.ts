import { sha256Digest } from '~/platform/crypto';

export async function sha256(data: ArrayBuffer) {
	return sha256Digest(data);
}

export async function sha256Hex(data: ArrayBuffer) {
	const hashBuffer = await sha256(data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

export async function sha256Base64(data: ArrayBuffer): Promise<string> {
	const hashBuffer = await sha256(data);
	const hashBytes = new Uint8Array(hashBuffer);
	let binary = '';
	for (let i = 0; i < hashBytes.byteLength; i++) binary += String.fromCharCode(hashBytes[i]);
	return btoa(binary);
}
