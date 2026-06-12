import { beforeEach, expect, mock, test } from 'bun:test';
import { ref } from 'synthkernel';
import { ShimmedRemoteFs } from './utils';

const actualContentModule = await import('../src/fs/shims/encryption/content');
const actualDeriveMasterKey = actualContentModule.deriveMasterKey;
const actualDeriveMasterSalt = actualContentModule.deriveMasterSalt;
const actualDeriveNameKey = actualContentModule.deriveNameKey;
const actualDeriveRootFileKey = actualContentModule.deriveRootFileKey;

type ContentModule = typeof import('~/fs/shims/encryption/content');

const derivationCalls = {
	deriveMasterKey: 0,
	deriveMasterSalt: 0,
	deriveNameKey: 0,
	deriveRootFileKey: 0,
};

await mock.module('~/fs/shims/encryption/content', () => ({
	...actualContentModule,
	deriveMasterKey: async (...args: Parameters<ContentModule['deriveMasterKey']>) => {
		derivationCalls.deriveMasterKey += 1;
		return await actualDeriveMasterKey(...args);
	},
	deriveMasterSalt: async (...args: Parameters<ContentModule['deriveMasterSalt']>) => {
		derivationCalls.deriveMasterSalt += 1;
		return await actualDeriveMasterSalt(...args);
	},
	deriveNameKey: async (...args: Parameters<ContentModule['deriveNameKey']>) => {
		derivationCalls.deriveNameKey += 1;
		return await actualDeriveNameKey(...args);
	},
	deriveRootFileKey: async (...args: Parameters<ContentModule['deriveRootFileKey']>) => {
		derivationCalls.deriveRootFileKey += 1;
		return await actualDeriveRootFileKey(...args);
	},
}));

const { default: encryptionShim } = await import('~/fs/shims/encryption');

const PASSWORD = 'password';
const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';
const textEncoder = new TextEncoder();

beforeEach(() => {
	derivationCalls.deriveMasterKey = 0;
	derivationCalls.deriveMasterSalt = 0;
	derivationCalls.deriveNameKey = 0;
	derivationCalls.deriveRootFileKey = 0;
});

function bytes(value: string) {
	return textEncoder.encode(value).buffer;
}

function splitBytes(source: Uint8Array, sizes: Array<number>) {
	const chunks: Array<Uint8Array> = [];
	let offset = 0;
	for (const size of sizes) {
		if (offset >= source.length) break;
		const end = Math.min(source.length, offset + size);
		chunks.push(source.slice(offset, end));
		offset = end;
	}
	if (offset < source.length) chunks.push(source.slice(offset));
	return chunks;
}

function createStreamFromChunks(chunks: Array<Uint8Array>) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

async function readStreamBytes(stream: ReadableStream<Uint8Array>) {
	const reader = stream.getReader();
	const chunks: Array<Uint8Array> = [];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
	}
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result.buffer;
}

function createRemote() {
	const original = new ShimmedRemoteFs(async () => ({
		headers: {},
		status: 200,
		text: '',
	}));
	return {
		original,
		shim: encryptionShim(original, PASSWORD),
	};
}

async function captureEncryptedKey(path: string, action: 'mkdir' | 'write' = 'write') {
	const { original, shim } = createRemote();
	if (action === 'mkdir') {
		await shim.mkdir(path);
		return original.calls.mkdir.at(-1) as string;
	}

	await shim.write(path, new ArrayBuffer(0));
	return original.calls.write.at(-1)?.[0] as string;
}

test('Write encrypts delegated key and content before forwarding', async () => {
	const { original, shim } = createRemote();
	const plaintext = bytes('hello world');

	await shim.write('Folder/file.md', plaintext);

	expect(original.calls.write[0]?.[0]).not.toBe('Folder/file.md');
	expect(original.calls.write[0]?.[1]).toBeGreaterThan(plaintext.byteLength);
	expect(new Uint8Array(original.writePayloads[0]?.[1])).not.toStrictEqual(
		new Uint8Array(plaintext),
	);
});

test('Read decrypts encrypted remote content back to plaintext', async () => {
	const { original, shim } = createRemote();
	const plaintext = bytes('hello world'.repeat(8000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = original.writePayloads.at(-1)?.[1] as ArrayBuffer;
	original.readResponse = async () => encryptedContent;

	const decrypted = await shim.read('Folder/file.md');

	expect(new Uint8Array(decrypted)).toStrictEqual(new Uint8Array(plaintext));
	expect(original.calls.read[0]).toBe(original.calls.write[0]?.[0]);
});

test('ReadStream uses provided encrypted size without extra stat', async () => {
	const { original, shim } = createRemote();
	const plaintext = bytes('stream data'.repeat(15_000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = original.writePayloads.at(-1)?.[1] as ArrayBuffer;
	const encryptedBytes = new Uint8Array(encryptedContent);
	original.readStreamResponse = async () => createStreamFromChunks([encryptedBytes]);

	const decryptedStream = await shim.readStream('Folder/file.md', encryptedContent.byteLength);

	expect(original.calls.stat).toStrictEqual([]);
	expect(original.calls.readStream).toStrictEqual([
		[original.calls.write[0]?.[0], encryptedContent.byteLength],
	]);
	expect(await readStreamBytes(decryptedStream)).toStrictEqual(plaintext);
});

test('ReadStream falls back to encrypted stat when size is missing', async () => {
	const { original, shim } = createRemote();
	const plaintext = bytes('stream fallback'.repeat(10_000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = original.writePayloads.at(-1)?.[1] as ArrayBuffer;
	const encryptedBytes = new Uint8Array(encryptedContent);
	original.statResponse = (key) => ({
		isDir: false,
		key,
		mtime: 10,
		size: encryptedContent.byteLength,
		uid: 'uid',
	});
	original.readStreamResponse = async () =>
		createStreamFromChunks(splitBytes(encryptedBytes, [1, 7, 3, 64, 4096, 9999]));

	const decryptedStream = await shim.readStream('Folder/file.md');

	expect(original.calls.stat).toStrictEqual([original.calls.write[0]?.[0]]);
	expect(original.calls.readStream).toStrictEqual([
		[original.calls.write[0]?.[0], encryptedContent.byteLength],
	]);
	expect(await readStreamBytes(decryptedStream)).toStrictEqual(plaintext);
});

test('ReadStream handles arbitrary source chunk boundaries', async () => {
	const { original, shim } = createRemote();
	const plaintext = new Uint8Array(300_000).fill(7).buffer;

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = original.writePayloads.at(-1)?.[1] as ArrayBuffer;
	const encryptedBytes = new Uint8Array(encryptedContent);
	original.readStreamResponse = async () =>
		createStreamFromChunks(splitBytes(encryptedBytes, [1, 7, 3, 4096, 11, 8192]));

	const decryptedStream = await shim.readStream('Folder/file.md', encryptedContent.byteLength);

	expect(await readStreamBytes(decryptedStream)).toStrictEqual(plaintext);
});

test('Stat decrypts returned key and preserves metadata', async () => {
	const { original, shim } = createRemote();
	original.statResponse = (key) => ({
		isDir: false,
		key,
		mtime: 1234,
		size: 567,
		uid: 'etag-1',
	});

	const stat = await shim.stat('Folder/file.md');

	expect(stat).toStrictEqual({
		isDir: false,
		key: 'Folder/file.md',
		mtime: 1234,
		size: 567,
		uid: 'etag-1',
	});
	expect(original.calls.stat[0]).not.toBe('Folder/file.md');
});

test('List and listAll decrypt returned descendant keys', async () => {
	const folderKey = await captureEncryptedKey('Folder/folder/', 'mkdir');
	const fileKey = await captureEncryptedKey('Folder/note.md');

	const listRemote = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const listShim = encryptionShim(listRemote, PASSWORD);
	listRemote.listResponse = async () => [
		{ isDir: true, key: folderKey } as never,
		{ isDir: false, key: fileKey, mtime: 11, size: 6, uid: 'note' } as never,
	];

	const list = await listShim.list('Folder/');

	expect(list).toStrictEqual([
		{ isDir: true, key: 'Folder/folder/' },
		{ isDir: false, key: 'Folder/note.md', mtime: 11, size: 6, uid: 'note' },
	]);

	const listAllRemote = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const listAllShim = encryptionShim(listAllRemote, PASSWORD);
	let forwardedProgress: unknown;
	listAllRemote.listAllResponse = async (_key, progress) => {
		forwardedProgress = progress;
		return [
			{ isDir: true, key: folderKey } as never,
			{ isDir: false, key: fileKey, mtime: 12, size: 7, uid: 'note-2' } as never,
		];
	};

	const progress = ref({ completed: 0, total: 0 });
	const listAll = await listAllShim.listAll('Folder/', progress);

	expect(listAll).toStrictEqual([
		{ isDir: true, key: 'Folder/folder/' },
		{ isDir: false, key: 'Folder/note.md', mtime: 12, size: 7, uid: 'note-2' },
	]);
	expect(listRemote.calls.list[0]).not.toBe('Folder/');
	expect(listAllRemote.calls.listAll[0]).not.toBe('Folder/');
	expect(forwardedProgress).toBe(progress);
});

test('Exists, delete, and mkdir rewrite keys consistently', async () => {
	const { original, shim } = createRemote();

	await shim.exists('Folder/Sub/');
	await shim.delete('Folder/Sub/');
	await shim.mkdir('Folder/Sub/');

	expect(original.calls.exists[0]).toBe(original.calls.delete[0]);
	expect(original.calls.delete[0]).toBe(original.calls.mkdir[0]);
});

test('Same plaintext path reuses deterministic encrypted segments across repeated calls', async () => {
	const { original, shim } = createRemote();

	await shim.write('Folder/Repeat.md', new ArrayBuffer(0));
	await shim.write('Folder/Repeat.md', new ArrayBuffer(0));

	expect(original.calls.write[0]?.[0]).toBe(original.calls.write[1]?.[0]);
});

test('Same shim instance reuses derived keys across multiple operations', async () => {
	const { shim } = createRemote();

	await shim.exists('Folder/Sub/');
	await shim.delete('Folder/Sub/');
	await shim.mkdir('Folder/Sub/');

	expect(derivationCalls.deriveMasterSalt).toBe(1);
	expect(derivationCalls.deriveMasterKey).toBe(1);
	expect(derivationCalls.deriveRootFileKey).toBe(1);
	expect(derivationCalls.deriveNameKey).toBe(1);
});

test('Wrong password or malformed content throws data corrupted or wrong password', async () => {
	const { original, shim } = createRemote();
	const plaintext = bytes('secret payload');

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = original.writePayloads.at(-1)?.[1] as ArrayBuffer;

	const wrongRemote = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const wrongShim = encryptionShim(wrongRemote, 'wrong-password');
	wrongRemote.readResponse = async () => encryptedContent;

	expect(wrongShim.read('Folder/file.md')).rejects.toThrow(DECRYPTION_ERROR_MESSAGE);

	wrongRemote.readResponse = async () => new ArrayBuffer(1);
	expect(wrongShim.read('Folder/file.md')).rejects.toThrow(DECRYPTION_ERROR_MESSAGE);
});
