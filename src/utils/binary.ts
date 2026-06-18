export function arrayBufferEquals(left: ArrayBuffer, right: ArrayBuffer): boolean {
	if (left.byteLength !== right.byteLength) return false;

	const leftBytes = new Uint8Array(left);
	const rightBytes = new Uint8Array(right);

	for (let index = 0; index < leftBytes.length; index++)
		if (leftBytes[index] !== rightBytes[index]) return false;

	return true;
}

export async function arrayBufferToText(buffer: ArrayBuffer): Promise<string> {
	return await new Blob([new Uint8Array(buffer)]).text();
}

export async function textToArrayBuffer(text: string): Promise<ArrayBuffer> {
	return await new Blob([text]).arrayBuffer();
}
