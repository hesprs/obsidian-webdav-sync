# Repository Atlas: Obsidian WebDAV Sync

## Project Responsibility

Obsidian plugin for bidirectional WebDAV sync. Bootstraps stores, services, UI, and sync engine around a WebDAV/vault abstraction.

## System Entry Points

- `src/index.ts`: Plugin bootstrap, service wiring, sync lifecycle.
- `manifest.json`: Obsidian plugin metadata.
- `package.json`: scripts, dependencies, build/test/lint entrypoints.
- `tsdown.config.ts`, `tsconfig.json`, `vitest.config.ts`, `uno.config.ts`: toolchain config.
- `scripts/version-bump.ts`, `scripts/release-notes.ts`: release automation.

## Repository Directory Map

| Directory                             | Responsibility Summary                                                              | Detailed Map                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/`                                | Root source tree; wires plugin lifecycle, stores, services, and sync orchestration. | [View Map](src/codemap.md)                                |
| `src/components/`                     | UI layer for modals, ribbon controls, explorer, and file tree surfaces.             | [View Map](src/components/codemap.md)                     |
| `src/components/explorer/`            | Explorer UI composition and action propagation.                                     | [View Map](src/components/explorer/codemap.md)            |
| `src/components/explorer/components/` | File list, folder, file, and new-folder primitives.                                 | [View Map](src/components/explorer/components/codemap.md) |
| `src/components/fileTree/`            | Tree model construction, selection handling, and tree app surface.                  | [View Map](src/components/fileTree/codemap.md)            |
| `src/composable/`                     | Shared composable abstractions and state helpers.                                   | [View Map](src/composable/codemap.md)                     |
| `src/events/`                         | Sync-run and terminate event contracts.                                             | [View Map](src/events/codemap.md)                         |
| `src/fs/`                             | Filesystem abstraction layer for vault and WebDAV adapters.                         | [View Map](src/fs/codemap.md)                             |
| `src/fs/vault/`                       | Vault traversal and metadata normalization.                                         | [View Map](src/fs/vault/codemap.md)                       |
| `src/fs/webdav/`                      | WebDAV request construction, traversal, and helpers.                                | [View Map](src/fs/webdav/codemap.md)                      |
| `src/platform/`                       | Cross-platform path, binary, and crypto helpers.                                    | [View Map](src/platform/codemap.md)                       |
| `src/services/`                       | Scheduler, executor, WebDAV client, observability, and commands.                    | [View Map](src/services/codemap.md)                       |
| `src/settings/`                       | Settings schema, controls, and settings tab.                                        | [View Map](src/settings/codemap.md)                       |
| `src/storage/`                        | IndexedDB-backed sync state and chunk persistence.                                  | [View Map](src/storage/codemap.md)                        |
| `src/sync/`                           | Sync engine coordination and optimization pipeline.                                 | [View Map](src/sync/codemap.md)                           |
| `src/sync/decision/`                  | Decision interface and two-way strategy.                                            | [View Map](src/sync/decision/codemap.md)                  |
| `src/sync/tasks/`                     | Task hierarchy for push/pull/remove/mkdir/merge execution.                          | [View Map](src/sync/tasks/codemap.md)                     |
| `src/sync/utils/`                     | Pure helpers for merge, chunking, ordering, and optimization.                       | [View Map](src/sync/utils/codemap.md)                     |
| `src/utils/`                          | Generic helpers shared across modules.                                              | [View Map](src/utils/codemap.md)                          |
| `scripts/`                            | Release/version automation scripts.                                                 | [View Map](scripts/codemap.md)                            |

## Notes

- Tests, docs, build output, and translations stay excluded from codemap scope.
- `blueprint/codemap.json` stores codemap state for change detection.
