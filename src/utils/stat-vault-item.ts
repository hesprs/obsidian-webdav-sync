import { TFile, TFolder, Vault } from 'obsidian';
import type { StatModel } from '~/types';
import { normalizeVaultPath } from '~/platform/path';

export function statVaultItem(vault: Vault, path: string): StatModel | undefined {
	const file = vault.getAbstractFileByPath(path);
	if (!file) return undefined;
	if (file instanceof TFolder) {
		return {
			path: normalizeVaultPath(file.path),
			isDir: true,
		};
	} else if (file instanceof TFile) {
		return {
			path: normalizeVaultPath(file.path),
			isDir: false,
			mtime: file.stat.mtime,
			size: file.stat.size,
		};
	}
}
