import { gcmsiv } from '@noble/ciphers/aes.js';
import { argon2id } from 'hash-wasm';
import { sha256Digest } from '~/platform/crypto';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const EMPTY_SALT = ownedBytes(new Uint8Array());
const MASTER_KEY_LENGTH = 32;
const MASTER_SALT_LENGTH = 16;
const FILE_SALT_LENGTH = 16;
const AES_GCM_TAG_LENGTH = 16;
const CONTENT_CHUNK_SIZE = 128 * 1024;
const ENCRYPTED_CONTENT_CHUNK_SIZE = CONTENT_CHUNK_SIZE + AES_GCM_TAG_LENGTH;
const ROOT_FILE_KEY_INFO = 'root-file-key-v1';
const NAME_KEY_INFO = 'name-key-v1';
const FILE_KEY_INFO = 'file-key-v1';
const FILE_NAME_NONCE = ownedBytes(textEncoder.encode('file-name-v1'));
const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';

type EncryptionIdentity = {
	serverUrl: string;
	account: string;
	remoteDir: string;
};

export class RangedFileDecrypter {
	private pending = new Uint8Array();
	private fileKeyPromise: Promise<CryptoKey> | undefined;
	private chunkIndex = 0;

	constructor(
		private readonly rootFileKey: Uint8Array,
		private readonly virtualPath: string,
		private readonly encryptedFileSize: number,
	) {}

	async update(buffer: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
		return await this.process(toUint8Array(buffer), false);
	}

	async finish(): Promise<ArrayBuffer> {
		return await this.process(new Uint8Array(), true);
	}

	private async process(chunk: Uint8Array, isFinal: boolean): Promise<ArrayBuffer> {
		this.pending = ownedBytes(concatUint8Arrays(this.pending, chunk));

		const outputs: Array<Uint8Array> = [];
		const totalChunkCount = getEncryptedChunkCount(this.encryptedFileSize);

		if (!this.fileKeyPromise) {
			if (this.pending.length < FILE_SALT_LENGTH) {
				if (isFinal && this.pending.length > 0) throw new Error(DECRYPTION_ERROR_MESSAGE);
				return new ArrayBuffer(0);
			}

			const fileSalt = ownedBytes(this.pending.slice(0, FILE_SALT_LENGTH));
			this.pending = ownedBytes(this.pending.slice(FILE_SALT_LENGTH));
			this.fileKeyPromise = importAesGcmKey(
				await deriveFileKey(
					this.rootFileKey,
					fileSalt,
					this.encryptedFileSize,
					this.virtualPath,
				),
			);
		}

		while (this.chunkIndex < totalChunkCount) {
			const expectedSize = getEncryptedChunkSize(this.chunkIndex, this.encryptedFileSize);
			if (this.pending.length < expectedSize) break;

			const encryptedChunk = ownedBytes(this.pending.slice(0, expectedSize));
			this.pending = ownedBytes(this.pending.slice(expectedSize));
			outputs.push(
				await decryptContentChunk(
					await this.fileKeyPromise,
					encryptedChunk,
					this.chunkIndex,
				),
			);
			this.chunkIndex += 1;
		}

		if (isFinal && (this.chunkIndex !== totalChunkCount || this.pending.length > 0))
			throw new Error(DECRYPTION_ERROR_MESSAGE);

		return toArrayBuffer(concatUint8Arrays(...outputs));
	}
}

export async function deriveMasterSalt(identity: EncryptionIdentity): Promise<Uint8Array> {
	const digest = await sha256Digest(
		textEncoder.encode(`${identity.serverUrl}.${identity.account}.${identity.remoteDir}`),
	);
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

function getEncryptedFileSize(rawFileSize: number): number {
	if (rawFileSize < 0) throw new Error('Raw file size must be non-negative');
	if (rawFileSize === 0) return FILE_SALT_LENGTH;
	return (
		rawFileSize +
		FILE_SALT_LENGTH +
		Math.ceil(rawFileSize / CONTENT_CHUNK_SIZE) * AES_GCM_TAG_LENGTH
	);
}

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
				ownedBytes(textEncoder.encode(normalizeVirtualPath(virtualPath))),
			),
		),
	);
	return deriveHkdfKey(
		toArrayBuffer(rootFileKey),
		FILE_KEY_INFO,
		ownedBytes(new Uint8Array(fileKeySalt)),
	);
}

export async function encryptFileContent(
	rootFileKey: Uint8Array,
	virtualPath: string,
	plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
	const plaintextBytes = new Uint8Array(plaintext);
	const encryptedFileSize = getEncryptedFileSize(plaintextBytes.length);
	const fileSalt = ownedBytes(crypto.getRandomValues(new Uint8Array(FILE_SALT_LENGTH)));
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, virtualPath),
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
	virtualPath: string,
	encryptedContent: ArrayBuffer,
	encryptedFileSize: number,
): Promise<ArrayBuffer> {
	const encryptedBytes = new Uint8Array(encryptedContent);
	if (encryptedBytes.length !== encryptedFileSize || encryptedBytes.length < FILE_SALT_LENGTH)
		throw new Error(DECRYPTION_ERROR_MESSAGE);

	const fileSalt = ownedBytes(encryptedBytes.slice(0, FILE_SALT_LENGTH));
	const fileKey = await importAesGcmKey(
		await deriveFileKey(rootFileKey, fileSalt, encryptedFileSize, virtualPath),
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

export function createRangedFileDecrypter(
	rootFileKey: Uint8Array,
	virtualPath: string,
	encryptedFileSize: number,
) {
	return new RangedFileDecrypter(rootFileKey, virtualPath, encryptedFileSize);
}

export function encryptBasename(nameKey: Uint8Array, basename: string): string {
	const normalizedBasename = normalizeBasename(basename);
	const ciphertext = gcmsiv(nameKey, FILE_NAME_NONCE).encrypt(
		ownedBytes(textEncoder.encode(normalizedBasename)),
	);
	return encodeBase64Url(ciphertext);
}

export function decryptBasename(nameKey: Uint8Array, encryptedBasename: string): string {
	if (encryptedBasename === '') throw new Error('Encrypted basename cannot be empty');
	const plaintext = gcmsiv(nameKey, FILE_NAME_NONCE).decrypt(decodeBase64Url(encryptedBasename));
	return normalizeBasename(textDecoder.decode(plaintext));
}

async function deriveHkdfKey(
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

async function importAesGcmKey(key: Uint8Array): Promise<CryptoKey> {
	return await crypto.subtle.importKey('raw', toArrayBuffer(key), 'AES-GCM', false, [
		'encrypt',
		'decrypt',
	]);
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

async function decryptContentChunk(
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

function getEncryptedChunkCount(encryptedFileSize: number): number {
	if (encryptedFileSize < FILE_SALT_LENGTH) throw new Error(DECRYPTION_ERROR_MESSAGE);
	const encryptedPayloadSize = encryptedFileSize - FILE_SALT_LENGTH;
	if (encryptedPayloadSize === 0) return 0;
	return Math.ceil(encryptedPayloadSize / ENCRYPTED_CONTENT_CHUNK_SIZE);
}

function getEncryptedChunkSize(chunkIndex: number, encryptedFileSize: number): number {
	const chunkCount = getEncryptedChunkCount(encryptedFileSize);
	if (chunkIndex < 0 || chunkIndex >= chunkCount) throw new Error(DECRYPTION_ERROR_MESSAGE);
	if (chunkIndex < chunkCount - 1) return ENCRYPTED_CONTENT_CHUNK_SIZE;

	const encryptedPayloadSize = encryptedFileSize - FILE_SALT_LENGTH;
	return encryptedPayloadSize - ENCRYPTED_CONTENT_CHUNK_SIZE * (chunkCount - 1);
}

function normalizeVirtualPath(path: string): string {
	return path
		.replace(/\\/g, '/')
		.replace(/^\/+/, '')
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.normalize('NFC'))
		.join('/');
}

function encodeUInt96(value: number): Uint8Array {
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

function concatUint8Arrays(...arrays: Array<Uint8Array>): Uint8Array {
	const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const array of arrays) {
		result.set(array, offset);
		offset += array.length;
	}
	return result;
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
	return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const result = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(result).set(bytes);
	return result;
}

function toBufferSource(source: BufferSource): BufferSource {
	if (source instanceof ArrayBuffer) return source;
	return toArrayBuffer(new Uint8Array(source.buffer, source.byteOffset, source.byteLength));
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
	return ownedBytes(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function ownedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
	const result = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(result).set(bytes);
	return new Uint8Array(result);
}
