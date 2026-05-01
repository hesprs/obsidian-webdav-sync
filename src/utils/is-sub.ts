// Accepts local path
export default function isSub(parent: string, sub: string, include = false) {
	if (sub === parent) return include;
	return sub.startsWith(parent) && sub.charAt(parent.length) === '/';
}
