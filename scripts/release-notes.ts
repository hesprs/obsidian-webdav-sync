import { exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const CHANGELOG_PATH = join(process.cwd(), 'CHANGELOG.md');
const OUTPUT_PATH = join(process.cwd(), 'release-notes.md');

function getSemVer(version: string): string {
	const match = version.match(/(\d+\.\d+\.\d+)/);
	if (!match) {
		throw new Error(`Invalid version format: ${version}. Expected semver (e.g., 1.0.0).`);
	}
	return match[1];
}

function extractNotes(version: string): string {
	if (!existsSync(CHANGELOG_PATH)) {
		throw new Error(`CHANGELOG.md not found at ${CHANGELOG_PATH}`);
	}

	const content = readFileSync(CHANGELOG_PATH, 'utf-8');
	const lines = content.split('\n');
	const targetSemVer = getSemVer(version);

	let found = false;
	const notes: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

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

try {
	const versionTag = process.argv[2];

	if (!versionTag) {
		throw new Error(
			'Missing version argument. Usage: tsx scripts/extract-release-notes.ts <version>',
		);
	}

	console.log(`Extracting release notes for ${versionTag}...`);
	const notes = extractNotes(versionTag);
	writeFileSync(OUTPUT_PATH, notes);
	exec('pnpm oxfmt release-notes.md');

	console.log(`Successfully wrote release notes to ${OUTPUT_PATH}`);
} catch (error) {
	console.error('Error:', error instanceof Error ? error.message : error);
	process.exit(1);
}
