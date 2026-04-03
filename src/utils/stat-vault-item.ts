import { TAbstractFile, TFile, TFolder, Vault } from 'obsidian';
import type { StatModel } from '~/types';
import { normalizeVaultPath } from '~/platform/path';

export function statVaultItem(vault: Vault, path: string): StatModel | undefined {
	const file = vault.getAbstractFileByPath(path);
	if (!file) return undefined;
	const mtime = getMtime(file);
	if (file instanceof TFolder) {
		return {
			path: normalizeVaultPath(file.path),
			isDir: true,
			mtime,
		};
	} else if (file instanceof TFile) {
		return {
			path: normalizeVaultPath(file.path),
			isDir: false,
			mtime,
			size: file.stat.size,
		};
	}
}

function getMtime(file: TAbstractFile) {
	if (file instanceof TFile) {
		return file.stat.mtime;
	} else if (file instanceof TFolder) {
		let latest = 0;
		for (const subFile of file.children) latest = Math.max(latest, getMtime(subFile));
		return latest;
	}
	return 0;
}
