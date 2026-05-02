import type { GlobMatchOptions } from '~/settings';
import type { StatsMap } from '~/types';
import { vaultDirname } from '~/platform/path';
import { buildRules, needIncludeFromGlobRules } from '~/utils/glob-match';
import logger from '~/utils/logger';

// Apply inclusion / exclusion / file size rules and filter out invalid entries
export default function postTraversal(
	stats: StatsMap,
	filterRules?: {
		exclusionRules?: Array<GlobMatchOptions>;
		inclusionRules?: Array<GlobMatchOptions>;
	},
	maxSize?: number,
) {
	const includedStats: StatsMap = new Map();
	if (stats.size === 0) return includedStats;
	const exclusions = buildRules(filterRules?.exclusionRules);
	const inclusions = buildRules(filterRules?.inclusionRules);

	for (const [path, stat] of stats) {
		if (path.length === 0) continue;
		if (!needIncludeFromGlobRules(path, inclusions, exclusions)) {
			logger.debug(`Skipping ${stat.path} due to exclusion rules.`);
			continue;
		}
		if (!stat.isDir && maxSize && stat.size > maxSize) {
			logger.debug(`Skipping ${stat.path} due to file size limit.`);
			continue;
		}
		includedStats.set(path, stat);
	}
	completeLostDir(stats, includedStats);
	return includedStats;
}

/**
 * 经过 inclusion 和 exclusion 之后，
 * 有些符合规则的文件保留了下来，
 * 但是他们的父文件夹可能丢失了，需要补全
 */
function completeLostDir(stats: StatsMap, filteredStats: StatsMap): void {
	for (const filePath of filteredStats.keys()) {
		let currentPath = filePath;
		while (true) {
			const path = vaultDirname(currentPath);
			if (isRoot(path) || filteredStats.has(path)) break;
			const dirStat = stats.get(path);
			if (!dirStat || !dirStat.isDir) break;
			filteredStats.set(path, dirStat);
			currentPath = path;
		}
	}
}

function isRoot(path: string) {
	return path === '/' || path === '.' || path === '';
}
