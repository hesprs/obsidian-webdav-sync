import { isNil } from 'lodash-es';
import { Vault } from 'obsidian';
import type { StatModel } from '~/model/stat.model';
import type { SyncStateStore } from '~/storage';
import { useSettings } from '~/settings';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import GlobMatch, {
	type GlobMatchOptions,
	isVoidGlobMatchOptions,
	needIncludeFromGlobRules,
} from '~/utils/glob-match';
import { ResumableWebDAVTraversal, type WalkFreshness } from '~/utils/traverse-webdav';
import { type FsWalkOptions } from './fs.interface';
import completeLossDir from './utils/complete-loss-dir';
import { normalizeRemoteWalkPath } from './utils/normalize-remote-walk-path';

export type { WalkFreshness };

export class RemoteWebDAVFileSystem {
	constructor(
		private options: {
			vault: Vault;
			token: string;
			remoteServerUrl?: string;
			remoteBaseDir: string;
			syncStateStore: SyncStateStore;
		},
	) {}

	async walk(options?: FsWalkOptions) {
		const settings = await useSettings();
		const stateKey = getSyncStateKey({
			vaultName: this.options.vault.getName(),
			remoteBaseDir: this.options.remoteBaseDir,
			serverUrl: this.options.remoteServerUrl || settings.serverUrl,
			account: settings.account,
		});

		if (options?.remoteSource === 'stored-record') {
			const traversal = new ResumableWebDAVTraversal({
				remoteServerUrl: this.options.remoteServerUrl || settings.serverUrl,
				token: this.options.token,
				remoteBaseDir: this.options.remoteBaseDir,
				stateKey,
				syncStateStore: this.options.syncStateStore,
				saveInterval: 1,
			});
			const stats = await traversal.getStoredSnapshot();
			return this.toWalkResults(stats);
		}

		const remoteServerUrl = this.options.remoteServerUrl || settings.serverUrl;
		const traversal = new ResumableWebDAVTraversal({
			remoteServerUrl,
			token: this.options.token,
			remoteBaseDir: this.options.remoteBaseDir,
			stateKey,
			syncStateStore: this.options.syncStateStore,
			saveInterval: 1,
		});
		let stats = await traversal.traverse({
			freshness: options?.freshness ?? 'resume',
			onProgress: options?.onTraversalProgress,
		});

		return await this.toWalkResults(stats, settings?.filterRules);
	}

	async toWalkResults(
		stats: StatModel[],
		filterRules?: {
			exclusionRules?: GlobMatchOptions[];
			inclusionRules?: GlobMatchOptions[];
		},
	) {
		if (stats.length === 0) return [];

		const normalizedStats = stats
			.map((item: StatModel) => {
				const path = normalizeRemoteWalkPath(item.path, this.options.remoteBaseDir);
				return {
					...item,
					path,
				};
			})
			.filter((item: StatModel) => item.path.length > 0)
			.filter((item: StatModel) => !isNil(item));

		const settings = filterRules ? { filterRules } : await useSettings();
		const exclusions = this.buildRules(settings?.filterRules.exclusionRules);
		const inclusions = this.buildRules(settings?.filterRules.inclusionRules);

		const includedStats = normalizedStats.filter((stat: StatModel) =>
			needIncludeFromGlobRules(stat.path, inclusions, exclusions),
		);
		const completeStats = completeLossDir(normalizedStats, includedStats);
		const completeStatPaths = new Set(completeStats.map((s) => s.path));
		return normalizedStats.map((stat: StatModel) => ({
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
