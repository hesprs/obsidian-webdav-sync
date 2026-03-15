import { TFile, TFolder, Vault } from 'obsidian';
import type { StatModel } from '~/model/stat.model';
import { normalizeVaultPath, vaultBasename } from '~/platform/path/vault-path';

export async function statVaultItem(vault: Vault, path: string): Promise<StatModel | undefined> {
	path = normalizeVaultPath(path);
	const file = vault.getAbstractFileByPath(path);
	if (!file) {
		return undefined;
	}
	if (file instanceof TFolder) {
		return {
			path,
			basename: vaultBasename(path),
			isDir: true,
			isDeleted: false,
		};
	} else if (file instanceof TFile) {
		return {
			path,
			basename: vaultBasename(path),
			isDir: false,
			isDeleted: false,
			mtime: file.stat.mtime,
			size: file.stat.size,
		};
	}
}
