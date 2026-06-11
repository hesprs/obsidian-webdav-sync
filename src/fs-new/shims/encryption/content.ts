import { argon2id } from 'hash-wasm';
import { sha256Digest } from '~/platform/crypto';
import {
	AES_GCM_TAG_LENGTH,
	CONTENT_CHUNK_SIZE,
	FILE_SALT_LENGTH,
	MASTER_KEY_LENGTH,
	MASTER_SALT_LENGTH,
	concatUint8Arrays,
	decryptContentChunk,
	deriveFileKey,
	deriveHkdfKey,
	encodeUInt96,
	getEncryptedChunkSize,
	importAesGcmKey,
	ownedBytes,
	toArrayBuffer,
} from './shared';

const textEncoder = new TextEncoder();
const ROOT_FILE_KEY_INFO = 'root-file-key-v1';
const NAME_KEY_INFO = 'name-key-v1';

export const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';

export async function deriveMasterSalt(remoteUid: string): Promise<Uint8Array> {
	const digest = await sha256Digest(textEncoder.encode(remoteUid));
	return ownedBytes(new Uint8Array(digest.slice(0, MASTER_SALT_LENGTH)));
}

export async function deriveMasterKey(
	password: string | Uint8Array,
	masterSalt: Uint8Array,
): Promise<Uint8Array> {
	return ownedBytes(
		await argon2id({
			hashLength: MASTER_KEY_LENGTH,
			iterations: 3,
			memorySize: 32 * 1024,
			outputType: 'binary',
			parallelism: 1,
			password,
			salt: masterSalt,
		}),
	);
}

export async function deriveRootFileKey(masterKey: BufferSource): Promise<Uint8Array> {
	return deriveHkdfKey(masterKey, ROOT_FILE_KEY_INFO);
}

export async function deriveNameKey(masterKey: BufferSource): Promise<Uint8Array> {
	return deriveHkdfKey(masterKey, NAME_KEY_INFO);
}

export async function encryptFileContent(
	rootFileKey: Uint8Array,
	key: string,
	plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
	const plaintextBytes = new Uint8Array(plaintext);
	const encryptedFileSize = getEncryptedFileSize(plaintextBytes.length);
	const fileSalt = ownedBytes(crypto.getRandomValues(new Uint8Array(FILE_SALT_LENGTH)));
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
	);
	const encryptedChunks: Array<Uint8Array> = [fileSalt];

	for (
		let offset = 0, chunkIndex = 0;
		offset < plaintextBytes.length;
		offset += CONTENT_CHUNK_SIZE, chunkIndex += 1
	) {
		const chunk = plaintextBytes.slice(offset, offset + CONTENT_CHUNK_SIZE);
		encryptedChunks.push(await encryptContentChunk(fileKey, chunk, chunkIndex));
	}

	return toArrayBuffer(concatUint8Arrays(...encryptedChunks));
}

export async function decryptFileContent(
	rootFileKey: Uint8Array,
	key: string,
	encryptedContent: ArrayBuffer,
	encryptedFileSize: number,
): Promise<ArrayBuffer> {
	const encryptedBytes = new Uint8Array(encryptedContent);
	if (encryptedBytes.length !== encryptedFileSize || encryptedBytes.length < FILE_SALT_LENGTH)
		throw new Error(DECRYPTION_ERROR_MESSAGE);

	const fileSalt = ownedBytes(encryptedBytes.slice(0, FILE_SALT_LENGTH));
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
	);
	const plaintextChunks: Array<Uint8Array> = [];
	let offset = FILE_SALT_LENGTH;

	for (let chunkIndex = 0; offset < encryptedBytes.length; chunkIndex += 1) {
		const encryptedChunkSize = getEncryptedChunkSize(chunkIndex, encryptedFileSize);
		const encryptedChunk = ownedBytes(
			encryptedBytes.slice(offset, offset + encryptedChunkSize),
		);
		if (encryptedChunk.length !== encryptedChunkSize) throw new Error(DECRYPTION_ERROR_MESSAGE);
		plaintextChunks.push(await decryptContentChunk(fileKey, encryptedChunk, chunkIndex));
		offset += encryptedChunkSize;
	}

	if (offset !== encryptedBytes.length) throw new Error(DECRYPTION_ERROR_MESSAGE);
	return toArrayBuffer(concatUint8Arrays(...plaintextChunks));
}

async function encryptContentChunk(
	key: CryptoKey,
	chunk: Uint8Array,
	chunkIndex: number,
): Promise<Uint8Array> {
	return new Uint8Array(
		await crypto.subtle.encrypt(
			{ iv: toArrayBuffer(encodeUInt96(chunkIndex)), name: 'AES-GCM' },
			key,
			toArrayBuffer(chunk),
		),
	);
}

function getEncryptedFileSize(rawFileSize: number): number {
	if (rawFileSize < 0) throw new Error('Raw file size must be non-negative');
	if (rawFileSize === 0) return FILE_SALT_LENGTH;
	return (
		rawFileSize +
		FILE_SALT_LENGTH +
		Math.ceil(rawFileSize / CONTENT_CHUNK_SIZE) * AES_GCM_TAG_LENGTH
	);
}
