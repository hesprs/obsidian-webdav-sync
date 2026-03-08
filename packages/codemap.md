# packages

## Responsibility

Workspace boundary for reusable/distributable plugin modules. Currently hosts the `webdav-explorer` UI package.

## Design Patterns

- Monorepo package isolation (`packages/<module>`).
- Library packaging pattern: source in `src/`, build output in `dist/`, exports defined in package metadata.
- Package-level codemaps (`codemap.md`) to document structure per directory.

## Data & Control Flow

- Consumers import packages from this workspace (currently `webdav-explorer`).
- `webdav-explorer` builds from `src/**` into `dist/**` and exposes typed ESM exports.
- UI events and filesystem operations are mediated through package APIs rather than direct host internals.

## Integration Points

- Root workspace tooling resolves this directory as part of the monorepo.
- Package consumers (the main plugin) import built artifacts via each package's `exports` field.

## Key Files

- `webdav-explorer/package.json`: package metadata and public export surface.
- `webdav-explorer/rslib.config.ts`: library build configuration.
- `webdav-explorer/codemap.md`: package-level architecture map.
