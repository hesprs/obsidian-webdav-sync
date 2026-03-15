export type BinaryLike = ArrayBuffer | ArrayBufferView | Blob;

export function toArrayBufferSync(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
	if (data instanceof ArrayBuffer) {
		return data;
	}

	if (ArrayBuffer.isView(data)) {
		if (data.buffer instanceof SharedArrayBuffer) {
			const copy = new ArrayBuffer(data.byteLength);
			new Uint8Array(copy).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
			return copy;
		}

		return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
	}

	throw new TypeError('Unsupported binary data type');
}

export async function toArrayBuffer(data: BinaryLike): Promise<ArrayBuffer> {
	if (data instanceof Blob) {
		return data.arrayBuffer();
	}

	return toArrayBufferSync(data);
}

export function arrayBufferEquals(left: ArrayBuffer, right: ArrayBuffer): boolean {
	if (left.byteLength !== right.byteLength) {
		return false;
	}

	const leftBytes = new Uint8Array(left);
	const rightBytes = new Uint8Array(right);

	for (let index = 0; index < leftBytes.length; index++) {
		if (leftBytes[index] !== rightBytes[index]) {
			return false;
		}
	}

	return true;
}
