import type { Vault } from 'obsidian';
import { dirname, stripEndSlash } from '~/platform/path';
import type { Stat, VaultFsInterface } from '../interface';

function toKey(vaultPath: string, isDir: boolean): string {
	if (vaultPath === '/') return '/';
	return isDir ? `${vaultPath}/` : vaultPath;
}

function toVaultPath(key: string) {
	if (key === '/') return key;
	return stripEndSlash(key);
}

function toStat(
	nativePath: string,
	stat: { type: 'file' | 'folder'; mtime: number; size?: number },
): Stat {
	if (stat.type === 'folder') return { isDir: true, key: toKey(nativePath, true) };
	return {
		isDir: false,
		key: toKey(nativePath, false),
		mtime: stat.mtime,
		size: stat.size ?? 0,
		uid: String(stat.mtime),
	};
}

async function ensureKeyDir(vault: Vault, key: string): Promise<void> {
	if (key === '/') return;
	const vaultPath = toVaultPath(key);
	if (await vault.adapter.exists(vaultPath)) return;
	await ensureKeyDir(vault, dirname(key));
	if (!(await vault.adapter.exists(vaultPath))) await vault.adapter.mkdir(vaultPath);
}

async function removeVaultFileIfExists(vault: Vault, path: string): Promise<void> {
	if (await vault.adapter.exists(path)) await vault.adapter.remove(path);
}

function getTempPath(): string {
	return `.trash/webdav-sync-temp/${crypto.randomUUID()}.part`;
}

function toArrayBuffer(chunk: Uint8Array): ArrayBuffer {
	return Uint8Array.from(chunk).buffer;
}

function getTrashOption(vault: Vault): 'local' | undefined {
	const configuredVault = vault as { config?: { trashOption?: 'local' } };
	return configuredVault.config?.trashOption;
}

async function getFileUid(fs: VaultFsInterface, key: string): Promise<string> {
	const stat = await fs.stat(key);
	if (stat.isDir) throw new Error(`File ${key} not found!`);
	return stat.uid;
}

export default class ObsidianVaultFs implements VaultFsInterface {
	constructor(private readonly vault: Vault) {}

	getUid(): string {
		return `obsidian-vault~${this.vault.getName()}`;
	}

	read(key: string): Promise<ArrayBuffer> {
		return this.vault.adapter.readBinary(toVaultPath(key));
	}

	async write(key: string, value: ArrayBuffer): Promise<string> {
		const nativePath = toVaultPath(key);
		await this.vault.adapter.writeBinary(nativePath, value);
		return getFileUid(this, key);
	}

	async writeStream(key: string, value: ReadableStream): Promise<string> {
		const nativePath = toVaultPath(key);
		const tempPath = getTempPath();
		await ensureKeyDir(this.vault, dirname(key));

		const reader = value.getReader();
		let hasWritten = false;

		try {
			while (true) {
				const result = await reader.read();
				if (result.done) break;
				const chunk = result.value;
				if (!(chunk instanceof Uint8Array)) continue;
				const data = toArrayBuffer(chunk);
				if (hasWritten) await this.vault.adapter.appendBinary(tempPath, data);
				else {
					await this.vault.adapter.writeBinary(tempPath, data);
					hasWritten = true;
				}
			}

			if (!hasWritten) await this.vault.adapter.writeBinary(tempPath, new ArrayBuffer(0));
			await removeVaultFileIfExists(this.vault, nativePath);
			await this.vault.adapter.rename(tempPath, nativePath);
			return getFileUid(this, key);
		} catch (error) {
			await removeVaultFileIfExists(this.vault, tempPath);
			throw error;
		} finally {
			reader.releaseLock();
		}
	}

	async delete(key: string): Promise<void> {
		const nativePath = toVaultPath(key);
		if (
			getTrashOption(this.vault) === 'local' ||
			!(await this.vault.adapter.trashSystem(nativePath))
		)
			await this.vault.adapter.trashLocal(nativePath);
	}

	move(oldKey: string, newKey: string): Promise<void> {
		return this.vault.adapter.rename(toVaultPath(oldKey), toVaultPath(newKey));
	}

	async mkdir(key: string): Promise<void> {
		const folderKey = toVaultPath(key);
		if (folderKey === '/') return;
		await this.vault.adapter.mkdir(folderKey);
	}

	async stat(key: string): Promise<Stat> {
		if (key === '/') return { isDir: true, key: '/' };

		const nativePath = toVaultPath(key);
		const stat = await this.vault.adapter.stat(nativePath);
		if (!stat) throw new Error(`Stat of ${key} not found!`);
		return toStat(nativePath, stat);
	}

	async listAll(key: string): Promise<Array<Stat>> {
		const rootKey = toVaultPath(key);
		const queue = [rootKey];
		const result: Array<Stat> = [];

		while (queue.length > 0) {
			const currentLevelKeys = queue.splice(0);
			const currentLevelResults = await Promise.all(
				currentLevelKeys.map(async (currentKey) => {
					const currentNativePath = currentKey === '/' ? '/' : currentKey.slice(0, -1);
					const contents = await this.vault.adapter.list(currentNativePath);
					return await Promise.all(
						[...contents.files, ...contents.folders].map(async (path) => {
							const stat = await this.vault.adapter.stat(path);
							if (!stat) throw new Error(`Stat of ${path} not found!`);
							return toStat(path, stat);
						}),
					);
				}),
			);

			for (const currentLevelItems of currentLevelResults)
				for (const unifiedStat of currentLevelItems) {
					result.push(unifiedStat);
					if (unifiedStat.isDir) queue.push(unifiedStat.key);
				}
		}

		return result;
	}
}
