import { isNil } from 'lodash-es';
import { Vault } from 'obsidian';
import { useSettings } from '~/settings';
import { getTraversalWebDAVDBKey } from '~/utils/get-db-key';
import GlobMatch, {
	type GlobMatchOptions,
	isVoidGlobMatchOptions,
	needIncludeFromGlobRules,
} from '~/utils/glob-match';
import { ResumableWebDAVTraversal, type WalkFreshness } from '~/utils/traverse-webdav';
import AbstractFileSystem, { type FsWalkOptions } from './fs.interface';
import completeLossDir from './utils/complete-loss-dir';
import { normalizeRemoteWalkPath } from './utils/normalize-remote-walk-path';

export type { WalkFreshness };

export class RemoteWebDAVFileSystem implements AbstractFileSystem {
	constructor(
		private options: {
			vault: Vault;
			token: string;
			remoteServerUrl?: string;
			remoteBaseDir: string;
		},
	) {}

	async walk(options?: FsWalkOptions) {
		const settings = await useSettings();
		const remoteServerUrl = this.options.remoteServerUrl || settings.serverUrl;
		const traversal = new ResumableWebDAVTraversal({
			remoteServerUrl,
			token: this.options.token,
			remoteBaseDir: this.options.remoteBaseDir,
			kvKey: await getTraversalWebDAVDBKey(this.options.token, this.options.remoteBaseDir),
			saveInterval: 1,
		});
		let stats = await traversal.traverse({
			freshness: options?.freshness ?? 'cached-ok',
		});

		if (stats.length === 0) {
			return [];
		}

		// Paths returned by traversal are expected to be already relative to remoteBaseDir
		// (e.g. /Welcome.md). Some servers may still return base-prefixed absolute paths.
		// Normalize both shapes into plugin-relative paths (e.g. Welcome.md).
		stats = stats
			.map((item) => {
				const path = normalizeRemoteWalkPath(item.path, this.options.remoteBaseDir);
				return {
					...item,
					path,
				};
			})
			.filter((item) => item.path.length > 0)
			.filter((item) => !isNil(item));

		const exclusions = this.buildRules(settings?.filterRules.exclusionRules);
		const inclusions = this.buildRules(settings?.filterRules.inclusionRules);

		const includedStats = stats.filter((stat) =>
			needIncludeFromGlobRules(stat.path, inclusions, exclusions),
		);
		const completeStats = completeLossDir(stats, includedStats);
		const completeStatPaths = new Set(completeStats.map((s) => s.path));
		const results = stats.map((stat) => ({
			stat,
			ignored: !completeStatPaths.has(stat.path),
		}));
		return results;
	}

	private buildRules(rules: GlobMatchOptions[] = []): GlobMatch[] {
		return rules
			.filter((opt) => !isVoidGlobMatchOptions(opt))
			.map(({ expr, options }) => new GlobMatch(expr, options));
	}
}
