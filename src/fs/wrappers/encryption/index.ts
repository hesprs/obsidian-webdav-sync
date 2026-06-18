import type { Ref } from 'synthkernel';
import type { MaybePromise } from '~/types';
import type { Progress, Stat, RemoteFs, WrappedRemoteFs, RemoteFsWrapper } from '../../interface';
import type { EncryptionPathCache } from './path';
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

type DerivedKeys = {
	nameKey: ArrayBuffer;
	rootFileKey: ArrayBuffer;
};

class EncryptionRemoteFs implements WrappedRemoteFs {
	private readonly pathCache: EncryptionPathCache = {
		decryptedToEncrypted: new Map(),
		encryptedToDecrypted: new Map(),
	};

	private keysPromise: Promise<DerivedKeys> | undefined;

	constructor(
		public readonly original: RemoteFs | WrappedRemoteFs,
		private readonly password: string,
	) {}

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

	async listAll(key: string, progress?: Ref<Progress>) {
		const encryptedKey = await this.encryptKey(key);
		const stats = await this.original.listAll(encryptedKey, progress);
		return this.decryptStats(stats);
	}

	private async getKeys(): Promise<DerivedKeys> {
		if (!this.keysPromise) this.keysPromise = this.createKeysPromise();
		return this.keysPromise;
	}

	private async createKeysPromise(): Promise<DerivedKeys> {
		const masterSalt = await deriveMasterSalt(this.original.getUid());
		const masterKey = await deriveMasterKey(this.password, masterSalt);
		const [rootFileKey, nameKey] = await Promise.all([
			deriveRootFileKey(masterKey),
			deriveNameKey(masterKey),
		]);
		return { nameKey, rootFileKey };
	}

	private async encryptKey(key: string): Promise<string> {
		const { nameKey } = await this.getKeys();
		return encryptPathSegments(nameKey, key, this.pathCache);
	}

	private async decryptKey(key: string): Promise<string> {
		const { nameKey } = await this.getKeys();
		return decryptPathSegments(nameKey, key, this.pathCache);
	}

	private async decryptStats(stats: Array<Stat>) {
		return Promise.all(
			stats.map(async (stat) => ({ ...stat, key: await this.decryptKey(stat.key) })),
		);
	}
}

function encryptionWrapper(original: RemoteFs, password: string): WrappedRemoteFs {
	return new EncryptionRemoteFs(original, password);
}

export default encryptionWrapper satisfies RemoteFsWrapper<string>;
