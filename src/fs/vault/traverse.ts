import type { Vault } from 'obsidian';
import type { StatsMap } from '~/types';
import { normalizeVaultPath } from '~/platform/path';
import { useSettings } from '~/settings';
import logger from '~/utils/logger';
import postTraversal from '../post-traversal';
import { toStatModel } from './utils';

type TraverseVaultOptions = {
	vault: Vault;
};

export default async function traverse({ vault }: TraverseVaultOptions) {
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
							const stat = await vault.adapter.stat(_path);
							if (!stat) throw new Error(`Stat of ${_path} not found!`);
							const path = normalizeVaultPath(_path);
							const processedStat = toStatModel(stat, path);
							result.set(path, processedStat);
						}),
					);
					queue.push(...resultItems.folders);
				} catch (error) {
					logger.error(`Error processing ${currentPath}`, error);
					throw error;
				}
			}),
		);
	}
	return postTraversal(
		result,
		filterRules,
		skipLargeFiles.enabled ? skipLargeFiles.value : undefined,
	);
}
