import { testKit } from '@hesprs/sync-engine-sdk';
import { beforeEach, expect, mock, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';
import type { EncryptionDBMeta, EncryptionDBSchema } from '@/wrapper';
import encryptionWrapper from '@/wrapper';

const { bytes, stream, remoteFs, collectStream } = testKit;
const actualContentModule = await import('../src/wrapper/content');
const actualDeriveMasterKey = actualContentModule.deriveMasterKey;
const actualDeriveMasterSalt = actualContentModule.deriveMasterSalt;
const actualDeriveNameKey = actualContentModule.deriveNameKey;
const actualDeriveRootFileKey = actualContentModule.deriveRootFileKey;

type ContentModule = typeof import('../src/wrapper/content');

const derivationCalls = {
	deriveMasterKey: 0,
	deriveMasterSalt: 0,
	deriveNameKey: 0,
	deriveRootFileKey: 0,
};

await mock.module('@/wrapper/content', () => ({
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

const PASSWORD = 'password';
const DECRYPTION_ERROR_MESSAGE = 'data corrupted or wrong password';
const DEFAULT_REMOTE_UID = 'remote-uid';
const memoryDB = openMemoryDB<EncryptionDBSchema, EncryptionDBMeta>('encryption-wrapper-test');

beforeEach(() => {
	derivationCalls.deriveMasterKey = 0;
	derivationCalls.deriveMasterSalt = 0;
	derivationCalls.deriveNameKey = 0;
	derivationCalls.deriveRootFileKey = 0;
	memoryDB.clearStores();
	memoryDB.setMeta('encryptionKeys', undefined);
	memoryDB.setMeta('lastEncryptionUid', undefined);
});

function splitBytes(source: Uint8Array, sizes: Array<number>) {
	const chunks: Array<ArrayBuffer> = [];
	let offset = 0;
	for (const size of sizes) {
		if (offset >= source.length) break;
		const end = Math.min(source.length, offset + size);
		chunks.push(source.slice(offset, end).buffer);
		offset = end;
	}
	if (offset < source.length) chunks.push(source.slice(offset).buffer);
	return chunks;
}

function createRemote() {
	const remote = remoteFs({ uid: DEFAULT_REMOTE_UID });
	return { remote, shim: encryptionWrapper(remote.fs, { memoryDB, password: PASSWORD }) };
}

async function captureEncryptedKey(path: string, action: 'mkdir' | 'write' = 'write') {
	const { remote, shim } = createRemote();
	if (action === 'mkdir') {
		await shim.mkdir(path);
		return remote.calls.mkdir.at(-1) as string;
	}

	await shim.write(path, new ArrayBuffer(0));
	return remote.calls.write.at(-1)?.[0] as string;
}

async function seedPersistentCache(uid: string, password = PASSWORD) {
	const remote = remoteFs({ uid });
	const shim = encryptionWrapper(remote.fs, { memoryDB, password });

	await shim.write('Folder/file.md', new ArrayBuffer(0));
	remote.control.stat = async (key) => ({
		isDir: false,
		key,
		mtime: 1,
		size: 0,
		uid: 'etag',
	});
	await shim.stat('Folder/file.md');

	return remote;
}

function expectPersistentCacheFilled() {
	expect(memoryDB.getStore('decryptedToEncrypted').keys()).not.toStrictEqual([]);
	expect(memoryDB.getStore('encryptedToDecrypted').keys()).not.toStrictEqual([]);
	expect(memoryDB.getMeta('encryptionKeys')).not.toBeUndefined();
}

function expectPersistentCacheReset(marker: string) {
	expect(memoryDB.getStore('decryptedToEncrypted').keys()).toStrictEqual([]);
	expect(memoryDB.getStore('encryptedToDecrypted').keys()).toStrictEqual([]);
	expect(memoryDB.getMeta('encryptionKeys')).toBeUndefined();
	expect(memoryDB.getMeta('lastEncryptionUid')).toBe(marker);
}

test('Write encrypts delegated key and content before forwarding', async () => {
	const { remote, shim } = createRemote();
	const plaintext = bytes('hello world');

	await shim.write('Folder/file.md', plaintext);

	expect(remote.calls.write[0]?.[0]).not.toBe('Folder/file.md');
	expect(remote.calls.write[0]?.[1]).toBeGreaterThan(plaintext.byteLength);
	expect(new Uint8Array(remote.state.writePayloads[0]?.[1])).not.toStrictEqual(
		new Uint8Array(plaintext),
	);
});

test('Read decrypts encrypted remote content back to plaintext', async () => {
	const { remote, shim } = createRemote();
	const plaintext = bytes('hello world'.repeat(8000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = remote.state.writePayloads.at(-1)?.[1] as ArrayBuffer;
	remote.control.read = async () => encryptedContent;

	const decrypted = await shim.read('Folder/file.md');

	expect(new Uint8Array(decrypted)).toStrictEqual(new Uint8Array(plaintext));
	expect(remote.calls.read[0]?.[0]).toBe(remote.calls.write[0]?.[0]);
});

test('ReadStream uses provided encrypted size without extra stat', async () => {
	const { remote, shim } = createRemote();
	const plaintext = bytes('stream data'.repeat(15_000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = remote.state.writePayloads.at(-1)?.[1] as ArrayBuffer;
	remote.control.readStream = async () => stream([encryptedContent]);

	const decryptedStream = await shim.readStream('Folder/file.md', encryptedContent.byteLength);

	expect(remote.calls.stat).toStrictEqual([]);
	expect(remote.calls.readStream).toStrictEqual([
		[remote.calls.write[0]?.[0], encryptedContent.byteLength],
	]);
	expect(await collectStream(decryptedStream)).toStrictEqual(plaintext);
});

test('ReadStream falls back to encrypted stat when size is missing', async () => {
	const { remote, shim } = createRemote();
	const plaintext = bytes('stream fallback'.repeat(10_000));

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = remote.state.writePayloads.at(-1)?.[1] as ArrayBuffer;
	remote.control.stat = async (key) => ({
		isDir: false,
		key,
		mtime: 10,
		size: encryptedContent.byteLength,
		uid: 'uid',
	});
	remote.control.readStream = async () =>
		stream(splitBytes(new Uint8Array(encryptedContent), [1, 7, 3, 64, 4096, 9999]));

	const decryptedStream = await shim.readStream('Folder/file.md');

	expect(remote.calls.stat).toStrictEqual([remote.calls.write[0]?.[0]]);
	expect(remote.calls.readStream).toStrictEqual([
		[remote.calls.write[0]?.[0], encryptedContent.byteLength],
	]);
	expect(await collectStream(decryptedStream)).toStrictEqual(plaintext);
});

test('ReadStream handles arbitrary source chunk boundaries', async () => {
	const { remote, shim } = createRemote();
	const plaintext = new Uint8Array(300_000).fill(7).buffer;

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = remote.state.writePayloads.at(-1)?.[1] as ArrayBuffer;
	remote.control.readStream = async () =>
		stream(splitBytes(new Uint8Array(encryptedContent), [1, 7, 3, 4096, 11, 8192]));

	const decryptedStream = await shim.readStream('Folder/file.md', encryptedContent.byteLength);

	expect(await collectStream(decryptedStream)).toStrictEqual(plaintext);
});

test('Stat decrypts returned key and preserves metadata', async () => {
	const { remote, shim } = createRemote();
	remote.control.stat = async (key) => ({
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
	expect(remote.calls.stat[0]).not.toBe('Folder/file.md');
});

test('List and listAll decrypt returned descendant keys', async () => {
	const folderKey = await captureEncryptedKey('Folder/folder/', 'mkdir');
	const fileKey = await captureEncryptedKey('Folder/note.md');

	const listRemote = remoteFs({ uid: DEFAULT_REMOTE_UID });
	const listShim = encryptionWrapper(listRemote.fs, { memoryDB, password: PASSWORD });
	listRemote.control.list = async () => [
		{ isDir: true, key: folderKey } as never,
		{ isDir: false, key: fileKey, mtime: 11, size: 6, uid: 'note' } as never,
	];

	const list = await listShim.list('Folder/');

	expect(list).toStrictEqual([
		{ isDir: true, key: 'Folder/folder/' },
		{ isDir: false, key: 'Folder/note.md', mtime: 11, size: 6, uid: 'note' },
	]);

	const listAllRemote = remoteFs({ uid: DEFAULT_REMOTE_UID });
	const listAllShim = encryptionWrapper(listAllRemote.fs, { memoryDB, password: PASSWORD });
	let forwardedProgress: unknown;
	listAllRemote.control.listAll = async (_key, progress) => {
		forwardedProgress = progress;
		return [
			{ isDir: true, key: folderKey } as never,
			{ isDir: false, key: fileKey, mtime: 12, size: 7, uid: 'note-2' } as never,
		];
	};

	const progress = () => {};
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
	const { remote, shim } = createRemote();

	await shim.exists('Folder/Sub/');
	await shim.delete('Folder/Sub/');
	await shim.mkdir('Folder/Sub/');

	expect(remote.calls.exists[0]).toBe(remote.calls.delete[0]);
	expect(remote.calls.delete[0]).toBe(remote.calls.mkdir[0]);
});

test('Same plaintext path reuses deterministic encrypted segments across repeated calls', async () => {
	const { remote, shim } = createRemote();

	await shim.write('Folder/Repeat.md', new ArrayBuffer(0));
	await shim.write('Folder/Repeat.md', new ArrayBuffer(0));

	expect(remote.calls.write[0]?.[0]).toBe(remote.calls.write[1]?.[0]);
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

test('derived keys should be reused across wrapper instances when remote uid and password match', async () => {
	const remoteA = remoteFs({ uid: 'shared-uid' });
	const shimA = encryptionWrapper(remoteA.fs, { memoryDB, password: PASSWORD });

	await shimA.exists('Folder/Sub/');

	const remoteB = remoteFs({ uid: 'shared-uid' });
	const shimB = encryptionWrapper(remoteB.fs, { memoryDB, password: PASSWORD });

	await shimB.exists('Folder/Sub/');

	expect(derivationCalls.deriveMasterSalt).toBe(1);
	expect(derivationCalls.deriveMasterKey).toBe(1);
	expect(derivationCalls.deriveRootFileKey).toBe(1);
	expect(derivationCalls.deriveNameKey).toBe(1);
	expect(memoryDB.getMeta('encryptionKeys')).not.toBeUndefined();
});

test('persistent encryption cache should reset when remote uid changes', async () => {
	await seedPersistentCache('uid-a');
	expectPersistentCacheFilled();

	const remoteB = remoteFs({ uid: 'uid-b' });
	const shimB = encryptionWrapper(remoteB.fs, { memoryDB, password: PASSWORD });

	expectPersistentCacheReset('uid-b~password');

	remoteB.control.exists = async () => true;
	await shimB.exists('Folder/file.md');

	expect(derivationCalls.deriveMasterSalt).toBe(2);
	expect(derivationCalls.deriveMasterKey).toBe(2);
	expect(derivationCalls.deriveRootFileKey).toBe(2);
	expect(derivationCalls.deriveNameKey).toBe(2);
	expect(remoteB.calls.exists[0]).not.toBe('Folder/file.md');
});

test('persistent encryption cache should reset when password changes', async () => {
	const remote = await seedPersistentCache('uid-password');
	expectPersistentCacheFilled();

	const shimB = encryptionWrapper(remote.fs, { memoryDB, password: 'wrong-password' });

	expectPersistentCacheReset('uid-password~wrong-password');

	remote.control.exists = async () => true;
	await shimB.exists('Folder/file.md');

	expect(derivationCalls.deriveMasterSalt).toBe(2);
	expect(derivationCalls.deriveMasterKey).toBe(2);
	expect(derivationCalls.deriveRootFileKey).toBe(2);
	expect(derivationCalls.deriveNameKey).toBe(2);
});

test('Wrong password or malformed content throws data corrupted or wrong password', async () => {
	const { remote, shim } = createRemote();
	const plaintext = bytes('secret payload');

	await shim.write('Folder/file.md', plaintext);
	const encryptedContent = remote.state.writePayloads.at(-1)?.[1] as ArrayBuffer;

	const wrongRemote = remoteFs({ uid: DEFAULT_REMOTE_UID });
	const wrongShim = encryptionWrapper(wrongRemote.fs, { memoryDB, password: 'wrong-password' });
	wrongRemote.control.read = async () => encryptedContent;

	expect(wrongShim.read('Folder/file.md')).rejects.toThrow(DECRYPTION_ERROR_MESSAGE);

	wrongRemote.control.read = async () => new ArrayBuffer(1);
	expect(wrongShim.read('Folder/file.md')).rejects.toThrow(DECRYPTION_ERROR_MESSAGE);
});
