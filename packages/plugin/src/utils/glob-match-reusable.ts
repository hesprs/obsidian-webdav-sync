import GlobToRegExp from 'glob-to-regexp';

export type UserOptions = {
	caseSensitive?: boolean;
};

function normalizePath(path: string): {
	normalized: string;
	segments: Array<string>;
	isDir: boolean;
} {
	const withSlashes = path.replace(/\\/g, '/');
	const isDir = withSlashes.endsWith('/');
	const segments: Array<string> = [];
	for (const seg of withSlashes.split('/')) {
		if (!seg || seg === '.') continue;
		if (seg === '..') segments.pop();
		else segments.push(seg);
	}
	return { isDir, normalized: segments.join('/'), segments };
}

function buildRegExp(expr: string, opts: UserOptions): RegExp | undefined {
	return GlobToRegExp(expr, {
		extended: true,
		flags: opts.caseSensitive ? '' : 'i',
		globstar: true,
	});
}

export default class GlobMatch {
	private readonly regex?: RegExp;
	private readonly anchored: boolean;
	private readonly dirOnly: boolean;
	private readonly hasSlash: boolean;
	private readonly hasWildcards: boolean;
	private readonly body: string;

	constructor(
		public expr: string,
		public options: UserOptions = {},
	) {
		const trimmed = expr.trim();
		this.anchored = trimmed.startsWith('/');
		this.dirOnly = trimmed.endsWith('/');
		this.body = trimmed.replace(/^\/+|\/+$/g, '');
		this.hasSlash = this.body.includes('/');
		this.hasWildcards = /[*?[]/.test(this.body);
		if (this.body) this.regex = buildRegExp(this.body, options);
	}

	private matchesNormalizedPath(
		normalized: string,
		segments: Array<string>,
		isDir: boolean,
	): boolean {
		if (!this.regex) return false;
		const matchesAnySegment = (): boolean =>
			segments.some((segment) => this.regex?.test(segment) ?? false);

		if (!this.hasSlash) {
			if (this.anchored) {
				if (segments.length === 0 || !this.regex.test(segments[0])) return false;
				if (this.dirOnly) return segments.length > 1 || isDir;
				return true;
			}

			if (this.dirOnly)
				return segments.some(
					(segment, index) =>
						segment === this.body && (index < segments.length - 1 || isDir),
				);

			return matchesAnySegment();
		}

		if (this.hasWildcards) return this.regex.test(normalized);
		if (this.dirOnly) return normalized === this.body && isDir;
		return normalized === this.body;
	}

	matchesPath(path: string): boolean {
		const { normalized, segments, isDir } = normalizePath(path);
		return this.matchesNormalizedPath(normalized, segments, isDir);
	}

	matchesAncestor(path: string): boolean {
		const { segments } = normalizePath(path);
		for (let index = 0; index < segments.length - 1; index++) {
			const prefixSegments = segments.slice(0, index + 1);
			if (this.matchesNormalizedPath(prefixSegments.join('/'), prefixSegments, true))
				return true;
		}
		return false;
	}

	test(path: string): boolean {
		return this.matchesPath(path) || this.matchesAncestor(path);
	}
}
