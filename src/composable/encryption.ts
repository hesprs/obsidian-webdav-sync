import { gcmsiv } from '@noble/ciphers/aes.js';
import { argon2id } from 'hash-wasm';
import { sha256Digest } from '~/platform/crypto';

const textEncoder = new TextEncoder();
const textDecoder = new globalThis.TextDecoder();
const EMPTY_SALT = new Uint8Array();
const MASTER_KEY_LENGTH = 32;
const MASTER_SALT_LENGTH = 16;
const ROOT_FILE_KEY_INFO = 'root-file-key-v1';
const NAME_KEY_INFO = 'name-key-v1';
const FILE_NAME_NONCE = textEncoder.encode('file-name-v1');

export type EncryptionIdentity = {
	serverUrl: string;
	account: string;
	remoteDir: string;
};

export async function deriveMasterSalt(identity: EncryptionIdentity): Promise<Uint8Array> {
	const digest = await sha256Digest(
		textEncoder.encode(`${identity.serverUrl}.${identity.account}.${identity.remoteDir}`),
	);
	return new Uint8Array(digest.slice(0, MASTER_SALT_LENGTH));
}

export async function deriveMasterKey(
	password: string | Uint8Array,
	masterSalt: Uint8Array,
): Promise<Uint8Array> {
	return argon2id({
		hashLength: MASTER_KEY_LENGTH,
		iterations: 3,
		memorySize: 32 * 1024,
		outputType: 'binary',
		parallelism: 1,
		password,
		salt: masterSalt,
	});
}

export async function deriveRootFileKey(masterKey: BufferSource): Promise<Uint8Array> {
	return deriveHkdfKey(masterKey, ROOT_FILE_KEY_INFO);
}

export async function deriveNameKey(masterKey: BufferSource): Promise<Uint8Array> {
	return deriveHkdfKey(masterKey, NAME_KEY_INFO);
}

export function encryptBasename(nameKey: Uint8Array, basename: string): string {
	const normalizedBasename = normalizeBasename(basename);
	const ciphertext = gcmsiv(nameKey, FILE_NAME_NONCE).encrypt(
		textEncoder.encode(normalizedBasename),
	);
	return encodeBase64Url(ciphertext);
}

export function decryptBasename(nameKey: Uint8Array, encryptedBasename: string): string {
	if (encryptedBasename === '') throw new Error('Encrypted basename cannot be empty');
	const plaintext = gcmsiv(nameKey, FILE_NAME_NONCE).decrypt(decodeBase64Url(encryptedBasename));
	return normalizeBasename(textDecoder.decode(plaintext));
}

async function deriveHkdfKey(masterKey: BufferSource, info: string): Promise<Uint8Array> {
	const keyMaterial = await globalThis.crypto.subtle.importKey('raw', masterKey, 'HKDF', false, [
		'deriveBits',
	]);
	const derivedBits = await globalThis.crypto.subtle.deriveBits(
		{
			hash: 'SHA-256',
			info: textEncoder.encode(info),
			name: 'HKDF',
			salt: EMPTY_SALT,
		},
		keyMaterial,
		MASTER_KEY_LENGTH * 8,
	);
	return new Uint8Array(derivedBits);
}

function normalizeBasename(basename: string): string {
	if (basename === '') throw new Error('Basename cannot be empty');
	if (basename.includes('/')) throw new Error(`Basename must not contain '/': ${basename}`);
	return basename.normalize('NFC');
}

function encodeBase64Url(bytes: Uint8Array): string {
	const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string): Uint8Array {
	const padding = value.length % 4;
	const normalized =
		value.replace(/-/g, '+').replace(/_/g, '/') +
		(padding === 0 ? '' : '='.repeat(4 - padding));
	const binary = atob(normalized);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
