import { Vault } from 'obsidian';
import { useSettings } from '~/settings';
import type { OnProgress } from './fs.interface';
import postTraversal from './post-traversal';
import { traverseVault } from './traverse-vault';

export class LocalVaultFileSystem {
	constructor(private vault: Vault) {}

	async walk(onProgress: OnProgress) {
		const { filterRules, skipLargeFiles } = await useSettings();

		const stats = await traverseVault({
			vault: this.vault,
			from: this.vault.getRoot().path,
			onProgress,
		});
		return postTraversal(stats, filterRules, skipLargeFiles.bytes);
	}
}
