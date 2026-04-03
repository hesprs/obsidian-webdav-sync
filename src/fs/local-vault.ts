import { Vault } from 'obsidian';
import type { MaybePromise } from '~/types';
import { useSettings } from '~/settings';
import postTraversal from '~/utils/post-traversal';
import { traverseVault, type TraversalProgress } from '~/utils/traverse-vault';

export class LocalVaultFileSystem {
	constructor(private readonly options: { vault: Vault }) {}

	async walk(onProgress: (progress: TraversalProgress) => MaybePromise<void>) {
		const { filterRules } = await useSettings();

		const stats = await traverseVault({
			vault: this.options.vault,
			from: this.options.vault.getRoot().path,
			onProgress,
		});
		return postTraversal(stats, filterRules);
	}
}
