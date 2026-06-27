import type { StoreSync } from '@hesprs/sync-engine-sdk';
import { gcmsiv } from '@noble/ciphers/aes.js';
import { textToArrayBuffer, textToUint8Array, uint8ArrayToText } from '@repo/shared';
import { toArrayBuffer } from './shared';

export type EncryptionStores = {
	decryptedToEncrypted: StoreSync<string>;
	encryptedToDecrypted: StoreSync<string>;
};

const BASENAME_CACHE_LIMIT = 10_000;
const FILE_NAME_NONCE = textToArrayBuffer('file-name-v1');

export function encryptPathSegments(
	nameKey: ArrayBuffer,
	key: string,
	stores: EncryptionStores,
): string {
	return transformPathSegments(key, (segment) => encryptPathSegment(nameKey, segment, stores));
}

export function decryptPathSegments(
	nameKey: ArrayBuffer,
	key: string,
	stores: EncryptionStores,
): string {
	return transformPathSegments(key, (segment) => decryptPathSegment(nameKey, segment, stores));
}

function transformPathSegments(key: string, transformSegment: (segment: string) => string): string {
	return key
		.split('/')
		.map((segment) => (segment === '' ? segment : transformSegment(segment)))
		.join('/');
}

function encryptPathSegment(
	nameKey: ArrayBuffer,
	segment: string,
	stores: EncryptionStores,
): string {
	const cached = stores.decryptedToEncrypted.get(segment);
	if (cached !== undefined) return cached;

	const encrypted = encryptBasename(nameKey, segment);
	cacheSegmentPair(stores, segment, encrypted);
	return encrypted;
}

function decryptPathSegment(
	nameKey: ArrayBuffer,
	segment: string,
	stores: EncryptionStores,
): string {
	const cached = stores.encryptedToDecrypted.get(segment);
	if (cached !== undefined) return cached;

	const decrypted = decryptBasename(nameKey, segment);
	cacheSegmentPair(stores, decrypted, segment);
	return decrypted;
}

function encryptBasename(nameKey: ArrayBuffer, basename: string): string {
	const normalizedBasename = normalizeBasename(basename);
	const ciphertext = gcmsiv(new Uint8Array(nameKey), new Uint8Array(FILE_NAME_NONCE)).encrypt(
		textToUint8Array(normalizedBasename),
	);
	return encodeBase64Url(toArrayBuffer(ciphertext));
}

function decryptBasename(nameKey: ArrayBuffer, encryptedBasename: string): string {
	if (encryptedBasename === '') throw new Error('Encrypted basename cannot be empty');
	const plaintext = gcmsiv(new Uint8Array(nameKey), new Uint8Array(FILE_NAME_NONCE)).decrypt(
		new Uint8Array(decodeBase64Url(encryptedBasename)),
	);
	return normalizeBasename(uint8ArrayToText(plaintext));
}

function cacheSegmentPair(stores: EncryptionStores, decrypted: string, encrypted: string) {
	cacheLimitedSet(stores.decryptedToEncrypted, decrypted, encrypted);
	cacheLimitedSet(stores.encryptedToDecrypted, encrypted, decrypted);
}

function cacheLimitedSet(store: StoreSync<string>, key: string, value: string) {
	if (store.get(key) !== undefined) return;
	const keys = store.keys();
	if (keys.length >= BASENAME_CACHE_LIMIT) {
		const oldestKey = keys[0];
		if (oldestKey !== undefined) store.delete(oldestKey);
	}
	store.set(key, value);
}

function normalizeBasename(basename: string) {
	if (basename === '') throw new Error('Basename cannot be empty');
	if (basename.includes('/')) throw new Error(`Basename must not contain '/': ${basename}`);
	return basename;
}

function encodeBase64Url(bytes: ArrayBuffer): string {
	const binary = Array.from(new Uint8Array(bytes), (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
	const padding = value.length % 4;
	const normalized =
		value.replace(/-/g, '+').replace(/_/g, '/') +
		(padding === 0 ? '' : '='.repeat(4 - padding));
	const binary = atob(normalized);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}
