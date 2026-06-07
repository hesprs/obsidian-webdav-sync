# scripts/

## Responsibility

Houses standalone Node scripts for release management. One script bumps plugin metadata during versioning; the other extracts release notes into a publishable file.

## Design

- Both files are CLI-style, top-level scripts with no exports.
- They use Node built-ins directly and write repo-root files in place.
- Formatting is delegated to `bun oxfmt` after writes.
- `version-bump.ts` is driven by `npm_package_version` and updates `manifest.json` plus `versions.json`.
- `release-notes.ts` accepts a version argument, reads `CHANGELOG.md`, and emits `release-notes.md`; prerelease versions get a fixed debug message instead of changelog extraction.

## Flow

1. Package scripts invoke the files with `node`.
2. `version-bump.ts` reads the current manifest, copies `minAppVersion`, writes the target version into `manifest.json`, then records the version-to-minimum-app-version mapping in `versions.json`.
3. `release-notes.ts` validates the argument, normalizes the version to semver, scans `CHANGELOG.md` for the matching `##` section, trims the captured notes, and writes them to `release-notes.md`.
4. Both scripts run `bun oxfmt` on their output files to keep generated JSON/Markdown formatted.

## Integration

- `package.json` exposes `ver: node scripts/version-bump.ts` for release/version bumps.
- `package.json` exposes `notes: node scripts/release-notes.ts` for changelog extraction.
- `version-bump.ts` depends on `manifest.json` and `versions.json` at the repo root.
- `release-notes.ts` depends on `CHANGELOG.md` at the repo root and writes `release-notes.md` in the same location.
