import type { Vault } from 'obsidian';

export async function readLocalFile(vault: Vault, path: string) {
	const file = vault.getFileByPath(path);
	if (!file) throw new Error(`Cannot find file in vault: ${path}`);
	return await vault.readBinary(file);
}

export function readLocalAbstractFile(vault: Vault, path: string) {
	const file = vault.getAbstractFileByPath(path);
	if (!file) throw new Error(`Cannot find file in vault: ${path}`);
	return file;
}
