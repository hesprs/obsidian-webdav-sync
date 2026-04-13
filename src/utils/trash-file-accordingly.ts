import type { Vault } from 'obsidian';

export async function trashFile(vault: Vault, path: string) {
	let toLocal = false;
	if ('config' in vault) {
		toLocal = (vault.config as { trashOption: 'local' | undefined }).trashOption === 'local';
	}
	if (toLocal) await vault.adapter.trashLocal(path);
	else await vault.adapter.trashSystem(path);
}
