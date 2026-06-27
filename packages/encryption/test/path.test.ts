import { expect, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';
import type { EncryptionDBSchema } from '@/wrapper';
import type { EncryptionStores } from '@/wrapper/path';
import { decryptPathSegments, encryptPathSegments } from '@/wrapper/path';

const NAME_KEY = new Uint8Array(32).buffer;
let dbIndex = 0;

function createStores() {
	const db = openMemoryDB<EncryptionDBSchema>(`encryption-path-test-${(dbIndex += 1)}`);
	return {
		decryptedToEncrypted: db.getStore('decryptedToEncrypted'),
		encryptedToDecrypted: db.getStore('encryptedToDecrypted'),
	};
}

function seedStores(stores: EncryptionStores, prefix: string) {
	for (let index = 0; index < 10_000; index += 1) {
		stores.decryptedToEncrypted.set(`${prefix}-plain-${index}`, `${prefix}-encrypted-${index}`);
		stores.encryptedToDecrypted.set(`${prefix}-encrypted-${index}`, `${prefix}-plain-${index}`);
	}
}

test('basename segment cache should reuse stored encrypted translation on repeated encrypt calls', () => {
	const stores = createStores();
	stores.decryptedToEncrypted.set('Folder', 'cached-folder');

	expect(encryptPathSegments(NAME_KEY, 'Folder', stores)).toBe('cached-folder');
	expect(encryptPathSegments(NAME_KEY, 'Folder', stores)).toBe('cached-folder');
	expect(stores.decryptedToEncrypted.keys()).toStrictEqual(['Folder']);
	expect(stores.encryptedToDecrypted.keys()).toStrictEqual([]);
});

test('basename segment cache should reuse stored decrypted translation on repeated decrypt calls', () => {
	const stores = createStores();
	stores.encryptedToDecrypted.set('cached-folder', 'Folder');

	expect(decryptPathSegments(NAME_KEY, 'cached-folder', stores)).toBe('Folder');
	expect(decryptPathSegments(NAME_KEY, 'cached-folder', stores)).toBe('Folder');
	expect(stores.encryptedToDecrypted.keys()).toStrictEqual(['cached-folder']);
	expect(stores.decryptedToEncrypted.keys()).toStrictEqual([]);
});

test('basename stores should keep 10K-entry cap while inserting new pairs', () => {
	const encryptStores = createStores();
	seedStores(encryptStores, 'encrypt');
	const encrypted = encryptPathSegments(NAME_KEY, 'encrypt-plain-10000', encryptStores);

	expect(encryptStores.decryptedToEncrypted.keys().length).toBe(10_000);
	expect(encryptStores.encryptedToDecrypted.keys().length).toBe(10_000);
	expect(encryptStores.decryptedToEncrypted.get('encrypt-plain-0')).toBeUndefined();
	expect(encryptStores.encryptedToDecrypted.get('encrypt-encrypted-0')).toBeUndefined();
	expect(encryptStores.decryptedToEncrypted.get('encrypt-plain-10000')).toBe(encrypted);
	expect(encryptStores.encryptedToDecrypted.get(encrypted)).toBe('encrypt-plain-10000');

	const decryptSource = encryptPathSegments(NAME_KEY, 'decrypt-plain-10000', createStores());
	const decryptStores = createStores();
	seedStores(decryptStores, 'decrypt');

	expect(decryptPathSegments(NAME_KEY, decryptSource, decryptStores)).toBe('decrypt-plain-10000');
	expect(decryptStores.decryptedToEncrypted.keys().length).toBe(10_000);
	expect(decryptStores.encryptedToDecrypted.keys().length).toBe(10_000);
	expect(decryptStores.decryptedToEncrypted.get('decrypt-plain-0')).toBeUndefined();
	expect(decryptStores.encryptedToDecrypted.get('decrypt-encrypted-0')).toBeUndefined();
	expect(decryptStores.decryptedToEncrypted.get('decrypt-plain-10000')).toBe(decryptSource);
	expect(decryptStores.encryptedToDecrypted.get(decryptSource)).toBe('decrypt-plain-10000');
});
