import { sha256Digest } from '~/platform/crypto';

const textEncoder = new TextEncoder();
const EMPTY_SALT = ownedBytes(new Uint8Array());

const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';
export const MASTER_KEY_LENGTH = 32;
export const MASTER_SALT_LENGTH = 16;
export const FILE_SALT_LENGTH = 16;
export const AES_GCM_TAG_LENGTH = 16;
export const CONTENT_CHUNK_SIZE = 128 * 1024;
const ENCRYPTED_CONTENT_CHUNK_SIZE = CONTENT_CHUNK_SIZE + AES_GCM_TAG_LENGTH;
const FILE_KEY_INFO = 'file-key-v1';

export async function deriveFileKey(
	rootFileKey: Uint8Array,
	fileSalt: Uint8Array,
	encryptedFileSize: number,
	virtualPath: string,
): Promise<Uint8Array> {
	const fileKeySalt = await sha256Digest(
		toArrayBuffer(
			concatUint8Arrays(
				fileSalt,
				encodeUInt96(encryptedFileSize),
				ownedBytes(textEncoder.encode(virtualPath)),
			),
		),
	);
	return deriveHkdfKey(
		toArrayBuffer(rootFileKey),
		FILE_KEY_INFO,
		ownedBytes(new Uint8Array(fileKeySalt)),
	);
}

export async function deriveHkdfKey(
	masterKey: BufferSource,
	info: string,
	salt: Uint8Array = EMPTY_SALT,
): Promise<Uint8Array> {
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		toBufferSource(masterKey),
		'HKDF',
		false,
		['deriveBits'],
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			hash: 'SHA-256',
			info: textEncoder.encode(info),
			name: 'HKDF',
			salt: toArrayBuffer(salt),
		},
		keyMaterial,
		MASTER_KEY_LENGTH * 8,
	);
	return ownedBytes(new Uint8Array(derivedBits));
}

export async function importAesGcmKey(key: Uint8Array): Promise<CryptoKey> {
	return await crypto.subtle.importKey('raw', toArrayBuffer(key), 'AES-GCM', false, [
		'encrypt',
		'decrypt',
	]);
}

export async function decryptContentChunk(
	key: CryptoKey,
	encryptedChunk: Uint8Array,
	chunkIndex: number,
): Promise<Uint8Array> {
	try {
		return new Uint8Array(
			await crypto.subtle.decrypt(
				{ iv: toArrayBuffer(encodeUInt96(chunkIndex)), name: 'AES-GCM' },
				key,
				toArrayBuffer(encryptedChunk),
			),
		);
	} catch {
		throw new Error(DECRYPTION_ERROR_MESSAGE);
	}
}

export function getEncryptedChunkCount(encryptedFileSize: number): number {
	if (encryptedFileSize < FILE_SALT_LENGTH) throw new Error(DECRYPTION_ERROR_MESSAGE);
	const encryptedPayloadSize = encryptedFileSize - FILE_SALT_LENGTH;
	if (encryptedPayloadSize === 0) return 0;
	return Math.ceil(encryptedPayloadSize / ENCRYPTED_CONTENT_CHUNK_SIZE);
}

export function getEncryptedChunkSize(chunkIndex: number, encryptedFileSize: number): number {
	const chunkCount = getEncryptedChunkCount(encryptedFileSize);
	if (chunkIndex < 0 || chunkIndex >= chunkCount) throw new Error(DECRYPTION_ERROR_MESSAGE);
	if (chunkIndex < chunkCount - 1) return ENCRYPTED_CONTENT_CHUNK_SIZE;

	const encryptedPayloadSize = encryptedFileSize - FILE_SALT_LENGTH;
	return encryptedPayloadSize - ENCRYPTED_CONTENT_CHUNK_SIZE * (chunkCount - 1);
}

export function encodeUInt96(value: number): Uint8Array {
	if (!Number.isSafeInteger(value) || value < 0)
		throw new Error('Value must be a non-negative safe integer');
	let remainder = value;
	const result = new Uint8Array(12);
	for (let index = result.length - 1; index >= 0; index -= 1) {
		result[index] = remainder & 0xff;
		remainder = Math.floor(remainder / 256);
	}
	return ownedBytes(result);
}

export function concatUint8Arrays(...arrays: Array<Uint8Array>): Uint8Array {
	const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
	const buffer = new ArrayBuffer(totalLength);
	const result = new Uint8Array(buffer);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const result = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(result).set(bytes);
	return result;
}

export function toBufferSource(source: BufferSource): BufferSource {
	if (source instanceof ArrayBuffer) return source;
	return toArrayBuffer(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
}

export function ownedBytes(bytes: Uint8Array): Uint8Array {
	const buffer = new ArrayBuffer(bytes.byteLength);
	const result = new Uint8Array(buffer);
	result.set(bytes);
	return result;
}
