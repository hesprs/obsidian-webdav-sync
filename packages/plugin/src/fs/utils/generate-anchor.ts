export function generate5ByteUid(): string {
	const forbidden = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*', '~']);
	const SAFE_85: Array<string> = [];
	for (let i = 32; i <= 126; i++) {
		const char = String.fromCharCode(i);
		if (!forbidden.has(char)) SAFE_85.push(char);
	}
	const SAFE_83 = SAFE_85.filter((c) => c !== ' ' && c !== '.');
	const cryptoObj = globalThis.crypto;
	const buffer = new Uint8Array(32);
	let bufferIdx = 32;
	const getByte = (): number => {
		if (bufferIdx >= buffer.length) {
			cryptoObj.getRandomValues(buffer);
			bufferIdx = 0;
		}
		return buffer[bufferIdx++];
	};
	let uid = '';
	for (let i = 0; i < 4; i++) {
		let byte: number;
		do byte = getByte();
		while (byte >= 170);
		uid += SAFE_85[byte % 85];
	}
	let byte: number;
	do byte = getByte();
	while (byte >= 249);
	uid += SAFE_83[byte % 83];
	return uid;
}

export default function generateAnchor(existing: Set<string>) {
	let anchor: string;
	do anchor = generate5ByteUid();
	while (existing.has(anchor));
	return anchor;
}
