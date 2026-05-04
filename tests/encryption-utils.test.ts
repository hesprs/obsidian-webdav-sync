import type { SecretStorage } from 'obsidian';
import { describe, expect, it } from 'vitest';
import type { PluginSettings } from '~/settings';
import {
	decryptFileContent,
	createRangedFileDecrypter,
	encryptBasename,
	encryptFileContent,
} from '~/composable/encryption';
import { setPluginInstance } from '~/settings/plugin-instance';
import {
	createRemoteFileContentRangedDecrypter,
	createSyncEncryptionContext,
	decryptRemoteFileContent,
	decryptRemotePathForTraversal,
	encryptContentForRemoteFile,
	resolveRemoteExecutionPath,
} from '~/utils/encryption';

describe('encryption composable helpers', () => {
	it('encrypts and decrypts file content with the virtual path in key derivation', async () => {
		const rootFileKey = new Uint8Array(32).fill(1);
		const plaintext = new TextEncoder().encode('hello world '.repeat(20_000)).buffer;

		const encrypted = await encryptFileContent(rootFileKey, 'Folder/file.md', plaintext);

		await expect(
			decryptFileContent(rootFileKey, 'Folder/file.md', encrypted, encrypted.byteLength),
		).resolves.toStrictEqual(plaintext);
	});

	it('replays sequential encrypted buffers through the ranged decrypter', async () => {
		const rootFileKey = new Uint8Array(32).fill(2);
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

		expect(combined.buffer).toStrictEqual(plaintext);
	});

	it('encrypts basenames deterministically', () => {
		const nameKey = new Uint8Array(32).fill(3);
		const encrypted = encryptBasename(nameKey, '空 格.md');

		expect(encrypted).toBe(encryptBasename(nameKey, '空 格.md'));
		expect(encrypted).not.toContain('/');
	});
});

describe('encryption runtime helpers', () => {
	it('creates sync encryption context from settings and secret storage only', async () => {
		const context = createSyncEncryptionContext(
			{
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			} as PluginSettings,
			{ getSecret: () => 'password' } as unknown as SecretStorage,
		);

		const first = await context.keysPromise;
		const second = await context.keysPromise;
		expect([...first.rootFileKey]).toStrictEqual([...second.rootFileKey]);
		expect([...first.nameKey]).toStrictEqual([...second.nameKey]);
	});

	it('rejects sync encryption context when secret is missing or empty', async () => {
		const context = createSyncEncryptionContext(
			{
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			} as PluginSettings,
			{ getSecret: () => '' } as unknown as SecretStorage,
		);

		await expect(context.keysPromise).rejects.toThrow(
			'Failed to retrieve encryption password!',
		);
	});

	it('passes through when encryption is disabled', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } },
			settings: {
				account: 'alice',
				encryption: { enabled: false, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			},
		};
		setPluginInstance(plugin as never);
		const plaintext = new TextEncoder().encode('hello runtime').buffer;

		try {
			await expect(resolveRemoteExecutionPath('/vault/Folder/file.md')).resolves.toBe(
				'/vault/Folder/file.md',
			);
			await expect(decryptRemotePathForTraversal('/vault/Folder/file.md')).resolves.toBe(
				'/vault/Folder/file.md',
			);
			await expect(encryptContentForRemoteFile('Folder/file.md', plaintext)).resolves.toBe(
				plaintext,
			);
			await expect(
				decryptRemoteFileContent('Folder/file.md', plaintext, plaintext.byteLength),
			).resolves.toBe(plaintext);
			await expect(
				createRemoteFileContentRangedDecrypter('Folder/file.md', plaintext.byteLength),
			).resolves.toBeUndefined();
		} finally {
			setPluginInstance();
		}
	});

	it('encrypts runtime wrappers when encryption is enabled', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } as unknown as SecretStorage },
			getSyncEncryptionContext() {
				return createSyncEncryptionContext(this.settings, this.app.secretStorage);
			},
			getSyncEncryptionKeys() {
				return this.getSyncEncryptionContext().keysPromise;
			},
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			} as PluginSettings,
		};
		plugin.settings.account = ' alice ';
		plugin.settings.serverUrl = 'https://dav.example.com///';
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

			expect(direct).toStrictEqual(plaintext);
			expect(combined.buffer).toStrictEqual(plaintext);
		} finally {
			setPluginInstance();
		}
	});

	it('encrypts and decrypts remote paths through the runtime wrappers', async () => {
		const plugin = {
			app: { secretStorage: { getSecret: () => 'password' } as unknown as SecretStorage },
			getSyncEncryptionContext() {
				return createSyncEncryptionContext(this.settings, this.app.secretStorage);
			},
			getSyncEncryptionKeys() {
				return this.getSyncEncryptionContext().keysPromise;
			},
			settings: {
				account: 'alice',
				encryption: { enabled: true, value: 'secret-ref' },
				remoteDir: '/vault/',
				serverUrl: 'https://dav.example.com',
			} as PluginSettings,
		};
		setPluginInstance(plugin as never);

		try {
			const encryptedPath = await resolveRemoteExecutionPath('/vault/Folder/空 格.md');
			expect(encryptedPath).not.toBe('/vault/Folder/空 格.md');
			await expect(decryptRemotePathForTraversal(encryptedPath)).resolves.toBe(
				'/vault/Folder/空 格.md',
			);
		} finally {
			setPluginInstance();
		}
	});
});
