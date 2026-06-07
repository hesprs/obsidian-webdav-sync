const CHANGELOG_PATH = 'CHANGELOG.md';
const OUTPUT_PATH = 'release-notes.md';

function getSemVer(version: string): string {
	const match = /(?<semver>\d+\.\d+\.\d+)/.exec(version);
	if (!match)
		throw new Error(`Invalid version format: ${version}. Expected semver (e.g., 1.0.0).`);

	return match.groups?.semver ?? '';
}

async function extractNotes(version: string): Promise<string> {
	if (!(await Bun.file(CHANGELOG_PATH).exists()))
		throw new Error(`CHANGELOG.md not found at ${CHANGELOG_PATH}`);

	const content = await Bun.file(CHANGELOG_PATH).text();
	const lines = content.split('\n');
	const targetSemVer = getSemVer(version);

	let found = false;
	const notes: Array<string> = [];

	for (const line of lines) {
		// Check for version header: ## ... v1.2.3 ...
		if (line.startsWith('## ')) {
			if (found) break;
			const headerSemVer = getSemVer(line);
			if (headerSemVer === targetSemVer) {
				found = true;
				continue;
			}
		}

		if (found) notes.push(line);
	}

	if (!found) throw new Error(`Release notes for version ${version} not found in CHANGELOG.md`);

	// Trim leading/trailing empty lines for cleanliness
	return notes.join('\n').trim();
}

async function main(): Promise<void> {
	const versionTag = Bun.argv[2];

	if (!versionTag)
		throw new Error(
			'Missing version argument. Usage: tsx scripts/extract-release-notes.ts <version>',
		);

	console.log(`Extracting release notes for ${versionTag}...`);
	const notes = versionTag.includes('-')
		? 'Development release built for debug purpose, not recommended for real usage.'
		: await extractNotes(versionTag);
	await Bun.write(OUTPUT_PATH, notes);
	Bun.spawnSync({ cmd: ['bun', 'oxfmt', OUTPUT_PATH] });

	console.log(`Successfully wrote release notes to ${OUTPUT_PATH}`);
}

try {
	await main();
} catch (error) {
	console.error('Error:', error instanceof Error ? error.message : error);
	throw error;
}

// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
