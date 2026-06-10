import type { Vault } from 'obsidian';
import { normalizeVaultPath, vaultDirname } from '~/platform/path';
import type { Stat, VaultFsInterface } from '../interface';

function toNativePath(key: string): string {
	if (key === '/') return '/';
	return normalizeVaultPath(key);
}

function toFolderKey(key: string): string {
	if (key === '/') return '/';
	const normalized = normalizeVaultPath(key);
	return normalized === '' ? '/' : `${normalized}/`;
}

function toStatKey(path: string, isDir: boolean): string {
	if (path === '/') return '/';
	const normalized = normalizeVaultPath(path);
	return isDir ? `${normalized}/` : normalized;
}

function toStat(
	nativePath: string,
	stat: { type: 'file' | 'folder'; mtime: number; size?: number },
): Stat {
	if (stat.type === 'folder') return { isDir: true, key: toStatKey(nativePath, true) };
	return {
		isDir: false,
		key: toStatKey(nativePath, false),
		mtime: stat.mtime,
		size: stat.size ?? 0,
		uid: String(stat.mtime),
	};
}

async function ensureVaultDir(vault: Vault, path: string): Promise<void> {
	if (path === '' || path === '.' || path === '/') return;
	if (await vault.adapter.exists(path)) return;
	await ensureVaultDir(vault, vaultDirname(path));
	if (!(await vault.adapter.exists(path))) await vault.adapter.mkdir(path);
}

async function removeVaultFileIfExists(vault: Vault, path: string): Promise<void> {
	if (await vault.adapter.exists(path)) await vault.adapter.remove(path);
}

function getTrashTempPath(key: string): string {
	return normalizeVaultPath(`.trash/webdav-sync/${key}.${Date.now()}.part`);
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
		return this.vault.getName();
	}

	read(key: string): Promise<ArrayBuffer> {
		return this.vault.adapter.readBinary(toNativePath(key));
	}

	async write(key: string, value: ArrayBuffer): Promise<string> {
		const nativePath = toNativePath(key);
		await this.vault.adapter.writeBinary(nativePath, value);
		return getFileUid(this, key);
	}

	async writeStream(key: string, value: ReadableStream): Promise<string> {
		const nativePath = toNativePath(key);
		const tempPath = getTrashTempPath(nativePath);
		await ensureVaultDir(this.vault, vaultDirname(tempPath));

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
		const nativePath = toNativePath(key);
		if (
			getTrashOption(this.vault) === 'local' ||
			!(await this.vault.adapter.trashSystem(nativePath))
		)
			await this.vault.adapter.trashLocal(nativePath);
	}

	move(oldKey: string, newKey: string): Promise<void> {
		return this.vault.adapter.rename(toNativePath(oldKey), toNativePath(newKey));
	}

	async mkdir(key: string): Promise<void> {
		const folderKey = toFolderKey(key);
		if (folderKey === '/') return;
		await this.vault.adapter.mkdir(folderKey.slice(0, -1));
	}

	async stat(key: string): Promise<Stat> {
		if (key === '/') return { isDir: true, key: '/' };

		const nativePath = toNativePath(key);
		const stat = await this.vault.adapter.stat(nativePath);
		if (!stat) throw new Error(`Stat of ${key} not found!`);
		return toStat(nativePath, stat);
	}

	async listAll(key: string): Promise<Array<Stat>> {
		const rootKey = toFolderKey(key);
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
							const nativePath = toNativePath(path);
							const stat = await this.vault.adapter.stat(nativePath);
							if (!stat) throw new Error(`Stat of ${path} not found!`);
							return toStat(nativePath, stat);
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
