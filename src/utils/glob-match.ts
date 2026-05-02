import type { UserOptions } from '~/composable/glob-match';
import GlobMatch from '~/composable/glob-match';

export function buildRules(
	rules: Array<{ expr: string; options?: UserOptions }> = [],
): Array<GlobMatch> {
	return rules
		.filter((rule) => rule.expr?.trim())
		.map((rule) => new GlobMatch(rule.expr, rule.options));
}

export function needIncludeFromGlobRules(
	path: string,
	inclusion: Array<GlobMatch>,
	exclusion: Array<GlobMatch>,
): boolean {
	for (const rule of exclusion) if (rule.matchesAncestor(path)) return false;

	const included = inclusion.some((rule) => rule.matchesPath(path));
	if (inclusion.length > 0 && !included) return false;
	if (included) return true;

	for (const rule of exclusion) if (rule.matchesPath(path)) return false;
	return true;
}
