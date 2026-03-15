import { toArrayBufferSync } from '~/platform/binary';

export function uint8ArrayToArrayBuffer(data: Uint8Array<ArrayBuffer>) {
	return toArrayBufferSync(data);
}
