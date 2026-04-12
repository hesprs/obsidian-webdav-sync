import { Vault } from 'obsidian';
import type { StatsMap } from '~/types';
import { normalizeVaultPath } from '~/platform/path';
import { useSettings } from '~/settings';
import logger from '~/utils/logger';
import { localToStatModel } from '~/utils/to-stat-model';
import postTraversal from './post-traversal';

interface TraverseVaultOptions {
	vault: Vault;
}

export async function traverseVault({ vault }: TraverseVaultOptions) {
	const { filterRules, skipLargeFiles } = await useSettings();
	const queue = [vault.getRoot().path];
	const result: StatsMap = new Map();

	while (queue.length > 0) {
		const currentLevelPaths = queue.splice(0);

		await Promise.all(
			currentLevelPaths.map(async (currentPath) => {
				try {
					const resultItems = await vault.adapter.list(currentPath);

					await Promise.all(
						[...resultItems.files, ...resultItems.folders].map(async (_path) => {
							const _stat = await vault.adapter.stat(_path);
							if (!_stat) throw new Error(`Stat of ${_path} not found!`);
							const path = normalizeVaultPath(_path);
							const stat = localToStatModel(_stat, path);
							result.set(path, stat);
						}),
					);
					queue.push(...resultItems.folders);
				} catch (err) {
					logger.error(`Error processing ${currentPath}`, err);
					throw err;
				}
			}),
		);
	}
	return postTraversal(result, filterRules, skipLargeFiles.bytes);
}
