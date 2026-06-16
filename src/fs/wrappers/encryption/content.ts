import { argon2id } from 'hash-wasm';
import { sha256Digest } from '~/utils/crypto';
import {
	AES_GCM_TAG_LENGTH,
	CONTENT_CHUNK_SIZE,
	FILE_SALT_LENGTH,
	MASTER_KEY_LENGTH,
	MASTER_SALT_LENGTH,
	concatArrayBuffer,
	decryptContentChunk,
	deriveFileKey,
	deriveHkdfKey,
	encodeUInt96,
	getEncryptedChunkSize,
	importAesGcmKey,
	toArrayBuffer,
} from './shared';

const textEncoder = new TextEncoder();
const ROOT_FILE_KEY_INFO = 'root-file-key-v1';
const NAME_KEY_INFO = 'name-key-v1';

export const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';

export async function deriveMasterSalt(remoteUid: string): Promise<ArrayBuffer> {
	const digest = await sha256Digest(textEncoder.encode(remoteUid));
	return digest.slice(0, MASTER_SALT_LENGTH);
}

export async function deriveMasterKey(
	password: string | ArrayBuffer,
	masterSalt: ArrayBuffer,
): Promise<ArrayBuffer> {
	const derived = await argon2id({
		hashLength: MASTER_KEY_LENGTH,
		iterations: 3,
		memorySize: 32 * 1024,
		outputType: 'binary',
		parallelism: 1,
		password: typeof password === 'string' ? password : new Uint8Array(password),
		salt: new Uint8Array(masterSalt),
	});
	return toArrayBuffer(derived);
}

export async function deriveRootFileKey(masterKey: ArrayBuffer): Promise<ArrayBuffer> {
	return deriveHkdfKey(masterKey, ROOT_FILE_KEY_INFO);
}

export async function deriveNameKey(masterKey: ArrayBuffer): Promise<ArrayBuffer> {
	return deriveHkdfKey(masterKey, NAME_KEY_INFO);
}

export async function encryptFileContent(
	rootFileKey: ArrayBuffer,
	key: string,
	plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
	const encryptedFileSize = getEncryptedFileSize(plaintext.byteLength);
	const fileSalt = crypto.getRandomValues(new Uint8Array(FILE_SALT_LENGTH)).buffer;
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
	);
	const encryptedChunks: Array<ArrayBuffer> = [fileSalt];

	for (
		let offset = 0, chunkIndex = 0;
		offset < plaintext.byteLength;
		offset += CONTENT_CHUNK_SIZE, chunkIndex += 1
	) {
		const chunk = plaintext.slice(offset, offset + CONTENT_CHUNK_SIZE);
		encryptedChunks.push(await encryptContentChunk(fileKey, chunk, chunkIndex));
	}

	return concatArrayBuffer(...encryptedChunks);
}

export async function decryptFileContent(
	rootFileKey: ArrayBuffer,
	key: string,
	encryptedContent: ArrayBuffer,
	encryptedFileSize: number,
): Promise<ArrayBuffer> {
	if (
		encryptedContent.byteLength !== encryptedFileSize ||
		encryptedContent.byteLength < FILE_SALT_LENGTH
	)
		throw new Error(DECRYPTION_ERROR_MESSAGE);

	const fileSalt = encryptedContent.slice(0, FILE_SALT_LENGTH);
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, key),
	);
	const plaintextChunks: Array<ArrayBuffer> = [];
	let offset = FILE_SALT_LENGTH;

	for (let chunkIndex = 0; offset < encryptedContent.byteLength; chunkIndex += 1) {
		const encryptedChunkSize = getEncryptedChunkSize(chunkIndex, encryptedFileSize);
		const encryptedChunk = encryptedContent.slice(offset, offset + encryptedChunkSize);
		if (encryptedChunk.byteLength !== encryptedChunkSize)
			throw new Error(DECRYPTION_ERROR_MESSAGE);
		plaintextChunks.push(await decryptContentChunk(fileKey, encryptedChunk, chunkIndex));
		offset += encryptedChunkSize;
	}

	if (offset !== encryptedContent.byteLength) throw new Error(DECRYPTION_ERROR_MESSAGE);
	return concatArrayBuffer(...plaintextChunks);
}

async function encryptContentChunk(
	key: CryptoKey,
	chunk: ArrayBuffer,
	chunkIndex: number,
): Promise<ArrayBuffer> {
	return crypto.subtle.encrypt({ iv: encodeUInt96(chunkIndex), name: 'AES-GCM' }, key, chunk);
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
