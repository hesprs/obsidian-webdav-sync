import type {
	DatabaseSync,
	RemoteFs,
	WrappedRemoteFs,
	RemoteFsWrapper,
	MaybePromise,
	Progress,
	Stat,
} from '@hesprs/sync-engine-sdk';
import type { EncryptionStores } from './path';
import {
	decryptFileContent,
	deriveMasterKey,
	deriveMasterSalt,
	deriveNameKey,
	deriveRootFileKey,
	encryptFileContent,
} from './content';
import { decryptPathSegments, encryptPathSegments } from './path';
import createDecryptedReadableStream from './read-stream';

export type DerivedKeys = {
	nameKey: ArrayBuffer;
	rootFileKey: ArrayBuffer;
};

export type EncryptionDBSchema = {
	decryptedToEncrypted: string;
	encryptedToDecrypted: string;
};

export type EncryptionDBMeta = {
	encryptionKeys?: DerivedKeys;
	lastEncryptionUid?: string;
};

export type EncryptionDB = DatabaseSync<EncryptionDBSchema, EncryptionDBMeta>;

export type EncryptionWrapperOptions = {
	memoryDB: EncryptionDB;
	password: string;
};

class EncryptionRemoteFs implements WrappedRemoteFs {
	private readonly pathStores: EncryptionStores;
	private keysPromise: Promise<DerivedKeys> | undefined;

	constructor(
		public readonly original: RemoteFs,
		private readonly options: EncryptionWrapperOptions,
	) {
		const marker = `${this.original.getUid()}~${this.options.password}`;
		this.pathStores = {
			decryptedToEncrypted: this.options.memoryDB.getStore('decryptedToEncrypted'),
			encryptedToDecrypted: this.options.memoryDB.getStore('encryptedToDecrypted'),
		};
		if (this.options.memoryDB.getMeta('lastEncryptionUid') !== marker) {
			this.pathStores.decryptedToEncrypted.clear();
			this.pathStores.encryptedToDecrypted.clear();
			this.options.memoryDB.setMeta('encryptionKeys', undefined);
			this.options.memoryDB.setMeta('lastEncryptionUid', marker);
		}
	}

	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }> {
		return this.original.checkConnection();
	}

	getUid(): string {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		const encryptedKey = await this.encryptKey(key);
		const { rootFileKey } = await this.getKeys();
		const encryptedContent = await this.original.read(encryptedKey, size);
		return decryptFileContent(rootFileKey, key, encryptedContent, encryptedContent.byteLength);
	}

	async readStream(key: string, size?: number) {
		const encryptedKey = await this.encryptKey(key);
		const { rootFileKey } = await this.getKeys();
		if (typeof size !== 'number') {
			const stat = await this.original.stat(encryptedKey);
			if (stat.isDir) throw new Error('Cannot stream a folder');
			size = stat.size;
		}
		const source = await this.original.readStream(encryptedKey, size);
		return createDecryptedReadableStream(source, rootFileKey, key, size);
	}

	async write(key: string, value: ArrayBuffer) {
		const encryptedKey = await this.encryptKey(key);
		const { rootFileKey } = await this.getKeys();
		const encryptedContent = await encryptFileContent(rootFileKey, key, value);
		return this.original.write(encryptedKey, encryptedContent);
	}

	async delete(key: string) {
		return this.original.delete(await this.encryptKey(key));
	}

	async mkdir(key: string, recursive?: boolean) {
		return this.original.mkdir(await this.encryptKey(key), recursive);
	}

	async stat(key: string) {
		const encryptedKey = await this.encryptKey(key);
		const stat = await this.original.stat(encryptedKey);
		return { ...stat, key: await this.decryptKey(stat.key) };
	}

	async exists(key: string): Promise<boolean> {
		return this.original.exists(await this.encryptKey(key));
	}

	async list(key: string) {
		const encryptedKey = await this.encryptKey(key);
		const stats = await this.original.list(encryptedKey);
		return this.decryptStats(stats);
	}

	async listAll(key: string, progress?: (prog: Progress) => void) {
		const encryptedKey = await this.encryptKey(key);
		const stats = await this.original.listAll(encryptedKey, progress);
		return this.decryptStats(stats);
	}

	private async getKeys(): Promise<DerivedKeys> {
		if (!this.keysPromise) this.keysPromise = this.createKeysPromise();
		return this.keysPromise;
	}

	private async createKeysPromise(): Promise<DerivedKeys> {
		const encryptionKeys = this.options.memoryDB.getMeta('encryptionKeys');
		if (encryptionKeys !== undefined) return encryptionKeys;

		const masterSalt = await deriveMasterSalt(this.original.getUid());
		const masterKey = await deriveMasterKey(this.options.password, masterSalt);
		const [rootFileKey, nameKey] = await Promise.all([
			deriveRootFileKey(masterKey),
			deriveNameKey(masterKey),
		]);
		const derivedKeys = { nameKey, rootFileKey };
		this.options.memoryDB.setMeta('encryptionKeys', derivedKeys);
		return derivedKeys;
	}

	private async encryptKey(key: string): Promise<string> {
		const { nameKey } = await this.getKeys();
		return encryptPathSegments(nameKey, key, this.pathStores);
	}

	private async decryptKey(key: string): Promise<string> {
		const { nameKey } = await this.getKeys();
		return decryptPathSegments(nameKey, key, this.pathStores);
	}

	private async decryptStats(stats: Array<Stat>) {
		return Promise.all(
			stats.map(async (stat) => ({ ...stat, key: await this.decryptKey(stat.key) })),
		);
	}
}

function encryptionWrapper(original: RemoteFs, options: EncryptionWrapperOptions): WrappedRemoteFs {
	return new EncryptionRemoteFs(original, options);
}

export default encryptionWrapper satisfies RemoteFsWrapper<EncryptionWrapperOptions>;
