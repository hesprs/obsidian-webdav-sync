import { gcmsiv } from '@noble/ciphers/aes.js';
import { toArrayBuffer } from './shared';

export type EncryptionPathCache = {
	decryptedToEncrypted: Map<string, string>;
	encryptedToDecrypted: Map<string, string>;
};

const BASENAME_CACHE_LIMIT = 10_000;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const FILE_NAME_NONCE = textEncoder.encode('file-name-v1').buffer;

export function encryptPathSegments(
	nameKey: ArrayBuffer,
	key: string,
	cache: EncryptionPathCache,
): string {
	return transformPathSegments(key, (segment) => encryptPathSegment(nameKey, segment, cache));
}

export function decryptPathSegments(
	nameKey: ArrayBuffer,
	key: string,
	cache: EncryptionPathCache,
): string {
	return transformPathSegments(key, (segment) => decryptPathSegment(nameKey, segment, cache));
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
	cache: EncryptionPathCache,
): string {
	const cached = cache.decryptedToEncrypted.get(segment);
	if (cached !== undefined) return cached;

	const encrypted = encryptBasename(nameKey, segment);
	cacheSegmentPair(cache, segment, encrypted);
	return encrypted;
}

function decryptPathSegment(
	nameKey: ArrayBuffer,
	segment: string,
	cache: EncryptionPathCache,
): string {
	const cached = cache.encryptedToDecrypted.get(segment);
	if (cached !== undefined) return cached;

	const decrypted = decryptBasename(nameKey, segment);
	cacheSegmentPair(cache, decrypted, segment);
	return decrypted;
}

function encryptBasename(nameKey: ArrayBuffer, basename: string): string {
	const normalizedBasename = normalizeBasename(basename);
	const ciphertext = gcmsiv(new Uint8Array(nameKey), new Uint8Array(FILE_NAME_NONCE)).encrypt(
		textEncoder.encode(normalizedBasename),
	);
	return encodeBase64Url(toArrayBuffer(ciphertext));
}

function decryptBasename(nameKey: ArrayBuffer, encryptedBasename: string): string {
	if (encryptedBasename === '') throw new Error('Encrypted basename cannot be empty');
	const plaintext = gcmsiv(new Uint8Array(nameKey), new Uint8Array(FILE_NAME_NONCE)).decrypt(
		new Uint8Array(decodeBase64Url(encryptedBasename)),
	);
	return normalizeBasename(textDecoder.decode(plaintext));
}

function cacheSegmentPair(cache: EncryptionPathCache, decrypted: string, encrypted: string) {
	cacheLimitedSet(cache.decryptedToEncrypted, decrypted, encrypted);
	cacheLimitedSet(cache.encryptedToDecrypted, encrypted, decrypted);
}

function cacheLimitedSet(map: Map<string, string>, key: string, value: string) {
	if (map.has(key)) return;
	if (map.size >= BASENAME_CACHE_LIMIT) {
		const oldestKey = map.keys().next().value;
		if (oldestKey !== undefined) map.delete(oldestKey);
	}
	map.set(key, value);
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
