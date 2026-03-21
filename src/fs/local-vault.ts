import { Vault } from 'obsidian';
import type { MaybePromise } from '~/types';
import { useSettings } from '~/settings';
import GlobMatch, {
	type GlobMatchOptions,
	isVoidGlobMatchOptions,
	needIncludeFromGlobRules,
} from '~/utils/glob-match';
import { traverseVault, type TraversalProgress } from '~/utils/traverse-vault';
import completeLossDir from './utils/complete-loss-dir';

export class LocalVaultFileSystem {
	constructor(private readonly options: { vault: Vault }) {}

	async walk(onProgress: (progress: TraversalProgress) => MaybePromise<void>) {
		const settings = await useSettings();
		const exclusions = this.buildRules(settings?.filterRules.exclusionRules);
		const inclusions = this.buildRules(settings?.filterRules.inclusionRules);

		const stats = await traverseVault({
			vault: this.options.vault,
			from: this.options.vault.getRoot().path,
			onProgress,
		});
		const includedStats = stats.filter((stat) =>
			needIncludeFromGlobRules(stat.path, inclusions, exclusions),
		);
		const completeStats = completeLossDir(stats, includedStats);
		const completeStatPaths = new Set(completeStats.map((s) => s.path));
		return stats.map((stat) => ({
			stat,
			ignored: !completeStatPaths.has(stat.path),
		}));
	}

	private buildRules(rules: GlobMatchOptions[] = []): GlobMatch[] {
		return rules
			.filter((opt) => !isVoidGlobMatchOptions(opt))
			.map(({ expr, options }) => new GlobMatch(expr, options));
	}
}
