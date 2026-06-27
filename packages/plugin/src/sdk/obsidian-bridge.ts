export default function obsidianBridge() {
	return {
		name: 'obsidian-import-bridge',
		transform(code: string) {
			const transformed = code
				.replace(
					/^\s*import\s+(?<name>[A-Za-z_$][\w$]*)\s+from\s+(?<quote>['"])obsidian\k<quote>\s*;?\s*$/gm,
					(_, name: string) => `const ${name} = window.syncEngineApiBridge;`,
				)
				.replace(
					/^\s*import\s+\*\s+as\s+(?<name>[A-Za-z_$][\w$]*)\s+from\s+(?<quote>['"])obsidian\k<quote>\s*;?\s*$/gm,
					(_, name: string) => `const ${name} = window.syncEngineApiBridge;`,
				)
				.replace(
					/^\s*import\s+(?!(?:type\b|\*\s+as\s+))(?<name>.+?)\s+from\s+(?<quote>['"])obsidian\k<quote>\s*;?\s*$/gm,
					(_, name: string) => `const ${name} = window.syncEngineApiBridge;`,
				);
			return transformed === code ? undefined : { code: transformed };
		},
	};
}
