import type { Stat, Vault } from 'obsidian';
import type { StatModel } from '~/types';

export async function statItem(vault: Vault, path: string) {
	const file = await vault.adapter.stat(path);
	if (!file) return undefined;
	return toStatModel(file, path);
}

export function toStatModel(file: Stat, path: string): StatModel {
	if (file.type === 'file') {
		return { path, isDir: false, mtime: file.mtime, size: file.size };
	} else return { path, isDir: true };
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
