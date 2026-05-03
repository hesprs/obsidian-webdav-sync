import type { Stat, Vault } from 'obsidian';
import type { StatModel } from '~/types';
import { normalizeVaultPath, vaultDirname } from '~/platform/path';

export async function statItem(vault: Vault, path: string) {
	const file = await vault.adapter.stat(path);
	if (!file) return undefined;
	return toStatModel(file, path);
}

export function toStatModel(file: Stat, path: string): StatModel {
	return file.type === 'file'
		? { isDir: false, mtime: file.mtime, path, size: file.size }
		: { isDir: true, path };
}

export async function getContent(vault: Vault, path: string) {
	return vault.adapter.readBinary(path);
}

export async function trashFile(vault: Vault, path: string) {
	let toLocal = false;
	if ('config' in vault)
		toLocal = (vault.config as { trashOption: 'local' | undefined }).trashOption === 'local';
	if (toLocal || !(await vault.adapter.trashSystem(path))) await vault.adapter.trashLocal(path);
}

export async function prepareRangedDownloadTempPath(
	vault: Vault,
	localPath: string,
): Promise<string> {
	const tempPath = normalizeVaultPath(`.trash/webdav-sync/${localPath}.${Date.now()}.part`);
	await ensureVaultDir(vault, vaultDirname(tempPath));
	return tempPath;
}

export async function finalizeRangedDownloadTempPath(
	vault: Vault,
	tempPath: string,
	localPath: string,
) {
	if (await vault.adapter.exists(localPath)) await vault.adapter.remove(localPath);
	await vault.adapter.rename(tempPath, localPath);
}

export async function removeVaultFileIfExists(vault: Vault, path: string) {
	if (await vault.adapter.exists(path)) await vault.adapter.remove(path);
}

async function ensureVaultDir(vault: Vault, path: string): Promise<void> {
	if (path === '.' || path === '') return;
	if (await vault.adapter.exists(path)) return;
	await ensureVaultDir(vault, vaultDirname(path));
	if (!(await vault.adapter.exists(path))) await vault.adapter.mkdir(path);
}
