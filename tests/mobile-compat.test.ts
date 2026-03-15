import { describe, expect, it } from 'vitest';
import { arrayBufferEquals, toArrayBuffer } from '~/platform/binary';
import { getTraversalWebDAVDBKey } from '~/utils/get-db-key';
import { sha256Base64, sha256Hex } from '~/utils/sha256';

describe('phase 1 mobile compatibility', () => {
	it('produces stable sha256 encodings without node:crypto', async () => {
		const data = new TextEncoder().encode('hello').buffer;

		expect(await sha256Hex(data)).toBe(
			'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
		);
		expect(await sha256Base64(data)).toBe('LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ=');
	});

	it('builds traversal cache keys from sha256 token digest', async () => {
		expect(await getTraversalWebDAVDBKey('token', '/remote/base')).toBe(
			'3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0:/remote/base',
		);
	});

	it('normalizes binary views into exact ArrayBuffer slices', async () => {
		const source = new Uint8Array([1, 2, 3, 4, 5]);
		const slice = source.subarray(1, 4);
		const arrayBuffer = await toArrayBuffer(slice);

		expect(Array.from(new Uint8Array(arrayBuffer))).toEqual([2, 3, 4]);
		expect(arrayBuffer.byteLength).toBe(3);
	});

	it('supports blob payloads at the binary boundary', async () => {
		const arrayBuffer = await toArrayBuffer(new Blob([new Uint8Array([7, 8, 9])]));

		expect(Array.from(new Uint8Array(arrayBuffer))).toEqual([7, 8, 9]);
	});

	it('compares normalized binary payloads by bytes', async () => {
		const left = await toArrayBuffer(new Uint8Array([1, 2, 3]).subarray(0, 3));
		const right = await toArrayBuffer(new Blob([new Uint8Array([1, 2, 3])]));
		const different = await toArrayBuffer(new Uint8Array([1, 2, 4]));

		expect(arrayBufferEquals(left, right)).toBe(true);
		expect(arrayBufferEquals(left, different)).toBe(false);
	});
});
