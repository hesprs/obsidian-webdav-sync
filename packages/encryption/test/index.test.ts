import type {
	MemoryDBMeta,
	MemoryDBSchema,
	RemoteFs,
	RemoteFsWrapperEntry,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import { expect, mock, test } from 'bun:test';
import { openMemoryDB } from 'uni-kv';

const encryptionWrapperMock = mock((fs: unknown) => fs);

void mock.module('@/wrapper', () => ({
	default: encryptionWrapperMock,
}));

const { default: Encryption } = await import('../src/index');

const memoryDB = openMemoryDB<MemoryDBSchema, MemoryDBMeta>('encryption-module-test');

function createHarness(secret: string | undefined) {
	let registeredWrapper: RemoteFsWrapperEntry | undefined;
	const ctx = {
		app: {
			secretStorage: {
				getSecret: (key: string) => (key === 'encryption-password' ? secret : undefined),
			},
		} as App,
		memoryDB,
		registerRemoteFsWrapper: (wrapper: RemoteFsWrapperEntry) => {
			registeredWrapper = wrapper;
			return () => true;
		},
	};
	const module = new Encryption(ctx);

	module.moduleSettings.enabled = true;
	module.moduleSettings.password = 'encryption-password';
	module.start();

	return { registeredWrapper };
}

test('Encryption.start should register wrapper using shared memoryDB and resolved password', () => {
	encryptionWrapperMock.mockReset();
	const { registeredWrapper } = createHarness('resolved-password');
	const fs = {} as RemoteFs;

	expect(registeredWrapper).toBeDefined();
	registeredWrapper!.apply(fs);

	expect(encryptionWrapperMock).toHaveBeenCalledWith(fs, {
		memoryDB,
		password: 'resolved-password',
	});
});

test('Encryption.start should throw when enabled encryption password secret is missing', () => {
	encryptionWrapperMock.mockReset();
	const { registeredWrapper } = createHarness(undefined);

	expect(registeredWrapper).toBeDefined();
	expect(() => registeredWrapper!.apply({} as RemoteFs)).toThrow(
		'Please configure encryption password!',
	);
});
