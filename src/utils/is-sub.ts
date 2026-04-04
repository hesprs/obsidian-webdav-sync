// accepts local path
export function isSub(parent: string, sub: string, include = false) {
	if (sub === parent) return include;
	return sub.startsWith(parent);
}
