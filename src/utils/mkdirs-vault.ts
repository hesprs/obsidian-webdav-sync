import { isNil } from 'lodash-es';
import { Vault } from 'obsidian';
import { normalizeVaultPath, vaultDirname } from '~/platform/path/vault-path';

export async function mkdirsVault(vault: Vault, path: string) {
	const stack: string[] = [];
	let currentPath = normalizeVaultPath(path);
	if (currentPath === '' || currentPath === '.') {
		return;
	}
	if (vault.getAbstractFileByPath(currentPath)) {
		return;
	}
	while (
		currentPath !== '' &&
		currentPath !== '.' &&
		isNil(vault.getAbstractFileByPath(currentPath))
	) {
		stack.push(currentPath);
		currentPath = vaultDirname(currentPath);
	}
	while (stack.length) {
		const pop = stack.pop();
		if (!pop) {
			continue;
		}
		await vault.createFolder(pop);
	}
}
