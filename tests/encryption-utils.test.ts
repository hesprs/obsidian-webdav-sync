import { describe, expect, it } from 'vitest';
import {
	createRangedFileDecrypter,
	decryptBasename,
	decryptFileContent,
	deriveMasterKey,
	deriveMasterSalt,
	deriveNameKey,
	deriveRootFileKey,
	encryptBasename,
	encryptFileContent,
	getEncryptedFileSize,
} from '~/composable/encryption';
import { setPluginInstance } from '~/settings/plugin-instance';
import {
	createRemoteFileContentRangedDecrypter,
	createSyncEncryptionContext,
	decryptRemoteFileContent,
	decryptRemotePathBelowBaseDir,
	deriveSyncEncryptionKeys,
	encryptContentForRemoteFile,
	encryptRemotePathBelowBaseDir,
	getEncryptionIdentity,
} from '~/utils/encryption';

describe('encryption composable helpers', () => {
	it('derives a deterministic 16-byte master salt from identity', async () => {
		const identity = {
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		};

		const first = await deriveMasterSalt(identity);
		const second = await deriveMasterSalt(identity);

		expect(first).toBeInstanceOf(Uint8Array);
		expect(first).toHaveLength(16);
		expect([...first]).toEqual([...second]);
	});

	it('derives stable root and name keys from the same master key', async () => {
		const masterSalt = await deriveMasterSalt({
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		});
		const masterKey = await deriveMasterKey('password', masterSalt);
		const masterKeyBytes = new Uint8Array(masterKey);
		const [rootFileKey, nameKey] = await Promise.all([
			deriveRootFileKey(masterKeyBytes),
			deriveNameKey(masterKeyBytes),
		]);

		expect(rootFileKey).toBeInstanceOf(Uint8Array);
		expect(nameKey).toBeInstanceOf(Uint8Array);
		expect(rootFileKey).toHaveLength(32);
		expect(nameKey).toHaveLength(32);
		expect([...rootFileKey]).not.toEqual([...nameKey]);
	});

	it('encrypts and decrypts basenames deterministically', async () => {
		const masterSalt = await deriveMasterSalt({
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		});
		const masterKey = await deriveMasterKey('password', masterSalt);
		const nameKey = await deriveNameKey(new Uint8Array(masterKey));

		const encrypted = encryptBasename(nameKey, '空 格.md');

		expect(encrypted).toBe(encryptBasename(nameKey, '空 格.md'));
		expect(encrypted).not.toContain('/');
		expect(decryptBasename(nameKey, encrypted)).toBe('空 格.md');
	});

	it('encrypts and decrypts file content with the virtual path in key derivation', async () => {
		const masterSalt = await deriveMasterSalt({
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		});
		const masterKey = await deriveMasterKey('password', masterSalt);
		const rootFileKey = await deriveRootFileKey(new Uint8Array(masterKey));
		const plaintext = new TextEncoder().encode('hello world '.repeat(20_000)).buffer;

		const encrypted = await encryptFileContent(rootFileKey, 'Folder/file.md', plaintext);

		expect(encrypted.byteLength).toBe(getEncryptedFileSize(plaintext.byteLength));
		expect(
			await decryptFileContent(
				rootFileKey,
				'Folder/file.md',
				encrypted,
				encrypted.byteLength,
			),
		).toEqual(plaintext);
		await expect(
			decryptFileContent(rootFileKey, 'Other/file.md', encrypted, encrypted.byteLength),
		).rejects.toThrow('data corrupted or wrong password');
	});

	it('replays sequential encrypted buffers through the ranged decrypter', async () => {
		const masterSalt = await deriveMasterSalt({
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		});
		const masterKey = await deriveMasterKey('password', masterSalt);
		const rootFileKey = await deriveRootFileKey(new Uint8Array(masterKey));
		const plaintext = new TextEncoder().encode('chunk-'.repeat(50_000)).buffer;
		const encrypted = await encryptFileContent(rootFileKey, 'Folder/file.md', plaintext);
		const encryptedBytes = new Uint8Array(encrypted);
		const decrypter = createRangedFileDecrypter(
			rootFileKey,
			'Folder/file.md',
			encrypted.byteLength,
		);

		const partA = await decrypter.update(encryptedBytes.slice(0, 2_000_000));
		const partB = await decrypter.update(encryptedBytes.slice(2_000_000, 3_500_000));
		const partC = await decrypter.update(encryptedBytes.slice(3_500_000));
		const tail = await decrypter.finish();
		const combined = new Uint8Array(
			partA.byteLength + partB.byteLength + partC.byteLength + tail.byteLength,
		);
		combined.set(new Uint8Array(partA), 0);
		combined.set(new Uint8Array(partB), partA.byteLength);
		combined.set(new Uint8Array(partC), partA.byteLength + partB.byteLength);
		combined.set(new Uint8Array(tail), partA.byteLength + partB.byteLength + partC.byteLength);

		expect(combined.buffer).toEqual(plaintext);
	});
});

describe('encryption runtime helpers', () => {
	it('normalizes identity inputs from plugin settings', () => {
		const plugin = {
			settings: {
				account: ' alice ',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault',
				serverUrl: 'https://dav.example.com///',
			},
		} as const;

		expect(getEncryptionIdentity(plugin as never)).toEqual({
			account: 'alice',
			remoteDir: '/vault/',
			serverUrl: 'https://dav.example.com',
		});
	});

	it('derives the same sync keys for equivalent normalized settings', async () => {
		const pluginA = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: ' alice ',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault',
				serverUrl: 'https://dav.example.com///',
			},
		};
		const pluginB = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};

		const [first, second] = await Promise.all([
			deriveSyncEncryptionKeys(pluginA as never),
			deriveSyncEncryptionKeys(pluginB as never),
		]);

		expect([...first.rootFileKey]).toEqual([...second.rootFileKey]);
		expect([...first.nameKey]).toEqual([...second.nameKey]);
	});

	it('throws when secret reference is empty, missing, or blank', async () => {
		const missingReferencePlugin = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: '' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		const missingSecretPlugin = {
			app: { secretStorage: { getSecret: () => undefined } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		const blankSecretPlugin = {
			app: { secretStorage: { getSecret: () => '   ' } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};

		await expect(deriveSyncEncryptionKeys(missingReferencePlugin as never)).rejects.toThrow(
			'Failed to retrieve encryption password!',
		);
		await expect(deriveSyncEncryptionKeys(missingSecretPlugin as never)).rejects.toThrow(
			'Failed to retrieve encryption password!',
		);
		await expect(deriveSyncEncryptionKeys(blankSecretPlugin as never)).rejects.toThrow(
			'Failed to retrieve encryption password!',
		);
	});

	it('encrypts virtual descendant paths and decrypts remote absolute paths with shared cache', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		const context = createSyncEncryptionContext(plugin as never);

		const encryptedPath = await encryptRemotePathBelowBaseDir(
			'/vault/',
			'Folder/空 格.md',
			false,
			context,
		);

		expect(encryptedPath.startsWith('/vault/')).toBe(true);
		expect(encryptedPath).not.toContain('Folder');
		expect(await decryptRemotePathBelowBaseDir('/vault/', encryptedPath, context)).toBe(
			'/vault/Folder/空 格.md',
		);
		expect(context.basenameCache.decryptedToEncrypted.size).toBe(2);
		expect(context.basenameCache.encryptedToDecrypted.size).toBe(2);

		await encryptRemotePathBelowBaseDir('/vault/', 'Folder/空 格.md', false, context);
		expect(context.basenameCache.decryptedToEncrypted.size).toBe(2);
	});

	it('keeps the remote base dir plaintext and fails on invalid encrypted basenames', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		const context = createSyncEncryptionContext(plugin as never);

		expect(await encryptRemotePathBelowBaseDir('/vault/', '/', true, context)).toBe('/vault/');
		await expect(
			decryptRemotePathBelowBaseDir('/vault/', '/vault/not-base64/', context),
		).rejects.toThrow();
	});

	it('encrypts and decrypts remote file content through runtime helpers', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } },
			getSyncEncryptionContext() {
				return createSyncEncryptionContext(this as never);
			},
			getSyncEncryptionKeys() {
				return deriveSyncEncryptionKeys(this as never);
			},
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		setPluginInstance(plugin as never);
		const plaintext = new TextEncoder().encode('runtime hello'.repeat(20_000)).buffer;

		try {
			const encrypted = await encryptContentForRemoteFile('Folder/file.md', plaintext);
			const direct = await decryptRemoteFileContent(
				'Folder/file.md',
				encrypted,
				encrypted.byteLength,
			);
			const ranged = await createRemoteFileContentRangedDecrypter(
				'Folder/file.md',
				encrypted.byteLength,
			);
			const rangedFirst = await ranged?.update(encrypted.slice(0, 250_000));
			const rangedSecond = await ranged?.update(encrypted.slice(250_000));
			const rangedTail = await ranged?.finish();
			const combined = new Uint8Array(
				(rangedFirst?.byteLength ?? 0) +
					(rangedSecond?.byteLength ?? 0) +
					(rangedTail?.byteLength ?? 0),
			);
			combined.set(new Uint8Array(rangedFirst ?? new ArrayBuffer(0)), 0);
			combined.set(
				new Uint8Array(rangedSecond ?? new ArrayBuffer(0)),
				rangedFirst?.byteLength ?? 0,
			);
			combined.set(
				new Uint8Array(rangedTail ?? new ArrayBuffer(0)),
				(rangedFirst?.byteLength ?? 0) + (rangedSecond?.byteLength ?? 0),
			);

			expect(direct).toEqual(plaintext);
			expect(combined.buffer).toEqual(plaintext);
		} finally {
			setPluginInstance();
		}
	});
});
