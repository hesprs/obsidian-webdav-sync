export default function isMergeablePath(path: string): boolean {
	path = path.trim().toLowerCase();
	return path.endsWith('.md') || path.endsWith('.markdown');
}
