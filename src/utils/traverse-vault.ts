import { isNil, partial } from 'lodash-es';
import { normalizePath, TFolder, Vault } from 'obsidian';
import type { StatModel } from '~/model/stat.model';
import type { MaybePromise } from '~/types';
import GlobMatch from './glob-match';
import { statVaultItem } from './stat-vault-item';

export interface TraversalProgress {
	processedDirectories: number;
	totalDirectories: number;
	currentDirectory?: string;
}

interface TraverseVaultOptions {
	vault: Vault;
	onProgress: (progress: TraversalProgress) => MaybePromise<void>;
	from: string;
}

export async function traverseVault({ vault, from, onProgress }: TraverseVaultOptions) {
	const queue = [from];
	const res: StatModel[] = [];
	const ignores = [
		new GlobMatch(`${vault.configDir}/plugins/*/node_modules`, {
			caseSensitive: true,
		}),
	];
	function folderFilter(path: string) {
		path = normalizePath(path);
		if (ignores.some((rule) => rule.test(path))) return false;
		return true;
	}

	while (queue.length > 0) {
		const from = queue.shift();
		if (isNil(from)) continue;
		const folder = vault.getAbstractFileByPath(normalizePath(from));
		if (!folder || !(folder instanceof TFolder)) continue;
		const files = folder.children.filter((f) => !(f instanceof TFolder)).map((f) => f.path);
		let folders = folder.children.filter((f) => f instanceof TFolder).map((f) => f.path);
		folders = folders.filter(folderFilter);
		queue.push(...folders);
		res.push(
			...[...files, ...folders]
				.map(partial(statVaultItem, vault))
				.filter((content) => !isNil(content)),
		);
		await onProgress({
			processedDirectories: res.length,
			totalDirectories: res.length + queue.length,
			currentDirectory: from,
		});
	}
	return res;
}
