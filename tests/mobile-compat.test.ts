import { describe, expect, it } from 'vitest';
import { arrayBufferEquals, toArrayBuffer } from '~/platform/binary';
import { getSyncStateKey } from '~/utils/get-sync-state-key';

describe('phase 1 mobile compatibility', () => {
	it('builds stable sync state keys from sync namespace identity', () => {
		expect(
			getSyncStateKey({
				vaultName: 'Vault',
				remoteBaseDir: '/remote/base/',
				serverUrl: 'https://dav.example.com///',
				account: 'alice',
			}),
		).toBe(
			getSyncStateKey({
				vaultName: 'Vault',
				remoteBaseDir: '/remote/base',
				serverUrl: 'https://dav.example.com',
				account: 'alice',
			}),
		);
		expect(
			getSyncStateKey({
				vaultName: 'Vault',
				remoteBaseDir: '/remote/base',
				serverUrl: 'https://dav.example.com',
				account: 'alice',
			}),
		).not.toBe(
			getSyncStateKey({
				vaultName: 'Vault',
				remoteBaseDir: '/remote/base',
				serverUrl: 'https://dav.example.com',
				account: 'bob',
			}),
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
