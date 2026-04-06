import { normalizePath, TAbstractFile, TFolder, Vault } from 'obsidian';
import type { StatModel, StatsMap } from '~/types';
import { useSettings } from '~/settings';
import { localToStatModel } from '~/utils/to-stat-model';
import postTraversal from './post-traversal';

interface TraverseVaultOptions {
	vault: Vault;
}

function recursion(item: TAbstractFile) {
	const res: StatModel[] = [localToStatModel(item)];
	if (item instanceof TFolder) {
		for (const child of item.children) res.push(...recursion(child));
	}
	return res;
}

export async function traverseVault({ vault }: TraverseVaultOptions) {
	const { filterRules, skipLargeFiles } = await useSettings();
	const root = vault.getAbstractFileByPath(normalizePath(vault.getRoot().path));
	if (!root) throw new Error('Vault root folder not found.');
	const res: StatsMap = new Map();
	recursion(root).forEach((item) => res.set(item.path, item));
	return postTraversal(res, filterRules, skipLargeFiles.bytes);
}
