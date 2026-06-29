import type { Vault } from 'obsidian';
import { dirname, stripEndSlash } from '@repo/shared';
import type { Stat } from '@/types';
import type { RootLocalFs, LocalFs, RootLocalFsCtor } from './interface';

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
	{ type, mtime, size }: { type: 'file' | 'folder'; mtime: number; size: number },
): Stat {
	if (type === 'folder') return { isDir: true, key: toKey(nativePath, true) };
	return { isDir: false, key: toKey(nativePath, false), mtime, size, uid: `${mtime}~${size}` };
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
	return `.trash/sync-engine-temp/${crypto.randomUUID()}.part`;
}

function getTrashOption(vault: Vault): 'local' | undefined {
	const configuredVault = vault as { config?: { trashOption?: 'local' } };
	return configuredVault.config?.trashOption;
}

async function getFileUid(fs: LocalFs, key: string): Promise<string> {
	const stat = await fs.stat(key);
	if (stat.isDir) throw new Error(`File ${key} not found!`);
	return stat.uid;
}

class VaultFs implements RootLocalFs {
	constructor(public readonly vault: Vault) {}

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

	async writeStream(key: string, value: ReadableStream<ArrayBuffer>): Promise<string> {
		const nativePath = toVaultPath(key);
		const tempPath = getTempPath();
		await ensureKeyDir(this.vault, dirname(key));

		const reader = value.getReader();

		try {
			while (true) {
				const result = await reader.read();
				if (result.done) break;
				const chunk = result.value;
				await this.vault.adapter.appendBinary(tempPath, chunk);
			}
			await removeVaultFileIfExists(this.vault, nativePath);
			await this.vault.adapter.rename(tempPath, nativePath);
			return getFileUid(this, key);
		} catch (error) {
			await reader.cancel().catch(() => {});
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

	async list(key: string): Promise<Array<Stat>> {
		const result: Array<Stat> = [];
		const visit = async (dir: string) => {
			const path = dir === '/' ? '/' : dir.slice(0, -1);
			const { files, folders } = await this.vault.adapter.list(path);
			await Promise.all(
				[...files, ...folders].map(async (p) => {
					const stat = await this.vault.adapter.stat(p);
					if (!stat) throw new Error(`Stat of ${p} not found!`);
					const s = toStat(p, stat);
					result.push(s);
					if (s.isDir) await visit(s.key);
				}),
			);
		};
		await visit(toVaultPath(key));
		return result;
	}
}

export default VaultFs satisfies RootLocalFsCtor<Vault>;
