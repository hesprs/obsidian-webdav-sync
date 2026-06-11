import type { requestUrl } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { MaybePromise } from '~/types';
import type { Progress, Stat } from '../../interface';
import type { EncryptionPathCache } from './path';
import { RemoteFs } from '../../interface';
import {
	decryptFileContent,
	deriveMasterKey,
	deriveMasterSalt,
	deriveNameKey,
	deriveRootFileKey,
	encryptFileContent,
} from './content';
import { decryptPathSegments, encryptPathSegments } from './path';
import { createDecryptedReadableStream } from './read-stream';
import { toArrayBuffer } from './shared';

type DerivedKeys = {
	nameKey: Uint8Array;
	rootFileKey: Uint8Array;
};

class EncryptionRemoteFs<T extends object> implements RemoteFs<T> {
	private readonly pathCache: EncryptionPathCache = {
		decryptedToEncrypted: new Map(),
		encryptedToDecrypted: new Map(),
	};

	private keysPromise: Promise<DerivedKeys> | undefined;

	constructor(
		private readonly original: RemoteFs<T>,
		private readonly password: string,
	) {
		this.options = original.options;
		this.request = original.request;
	}

	options: T;
	request: typeof requestUrl;

	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }> {
		return this.original.checkConnection();
	}

	getUid(): string {
		return this.original.getUid();
	}

	async read(key: string) {
		const encryptedKey = await this.encryptKey(key);
		const { rootFileKey } = await this.getKeys();
		const encryptedContent = await this.original.read(encryptedKey);
		return decryptFileContent(rootFileKey, key, encryptedContent, encryptedContent.byteLength);
	}

	async readStream(key: string, totalSize?: number) {
		const encryptedKey = await this.encryptKey(key);
		const { rootFileKey } = await this.getKeys();
		let encryptedSize = totalSize;
		if (encryptedSize === undefined) {
			const stat = await this.original.stat(encryptedKey);
			if (stat.isDir) throw new Error('Cannot stream a folder');
			encryptedSize = stat.size;
		}
		const source = await this.original.readStream(encryptedKey, encryptedSize);
		return createDecryptedReadableStream(source, rootFileKey, key, encryptedSize);
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
			deriveRootFileKey(toArrayBuffer(masterKey)),
			deriveNameKey(toArrayBuffer(masterKey)),
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

export default function applyEncryptionShim<T extends object>(
	original: RemoteFs<T>,
	password: string,
): RemoteFs<T> {
	return new EncryptionRemoteFs(original, password);
}
