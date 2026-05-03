import { describe, expect, it } from 'vitest';
import {
	decryptBasename,
	deriveMasterKey,
	deriveMasterSalt,
	deriveNameKey,
	deriveRootFileKey,
	encryptBasename,
} from '~/composable/encryption';
import {
	createSyncEncryptionContext,
	decryptRemotePathBelowBaseDir,
	deriveSyncEncryptionKeys,
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
});
