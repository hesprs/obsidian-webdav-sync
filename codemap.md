# Repository Atlas: Obsidian Sync

## Project Responsibility

Obsidian Sync is a WebDAV-first Obsidian plugin that performs two-way synchronization between vault content and remote storage. The repository is organized around deterministic sync planning/execution, persistent sync state, and UI/service layers that make WebDAV sync operable as a general-purpose plugin (not Nutstore-specific).

## Root Assets

- `package.json` — workspace manifest, scripts, dependency graph, and build/test orchestration.
- `manifest.json` — Obsidian plugin metadata consumed at runtime.
- `tsdown.config.ts` / `uno.config.ts` — bundling and CSS/utility build configuration.

## System Entry Points

- `src/index.ts` — plugin composition root (`WebDAVSyncPlugin`), lifecycle hooks, service wiring.
- `src/services/sync-executor.service.ts` — canonical runtime entry for validated sync execution.
- `src/sync/index.ts` — sync engine orchestration (plan, optimize, execute, update records).
- `src/sync/decision/two-way.decider.ts` — task-plan generation from local/remote/record snapshots.
- `src/services/webdav.service.ts` and `src/api.ts` — WebDAV client setup and remote PROPFIND listing/protocol handling.

## Directory Map (Aggregated)

| Directory           | Responsibility Summary                                                                                        | Codemap                                                        |
| :------------------ | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| `src`               | Plugin source composition root connecting settings, services, sync engine, fs adapters, and storage.          | [src/codemap.md](./src/codemap.md)                             |
| `src/components`    | Obsidian UI components for sync controls, confirmations, progress, cache flows, and settings helpers.         | [src/components/codemap.md](./src/components/codemap.md)       |
| `src/events`        | RxJS event bus for sync lifecycle/progress/error/cancel and vault-level notifications.                        | [src/events/codemap.md](./src/events/codemap.md)               |
| `src/fs`            | Unified local-vault and remote-WebDAV filesystem walk abstraction with shared filtering/completion.           | [src/fs/codemap.md](./src/fs/codemap.md)                       |
| `src/fs/utils`      | Filesystem utility helpers for root checks and parent-directory completion after filtering.                   | [src/fs/utils/codemap.md](./src/fs/utils/codemap.md)           |
| `src/model`         | Core sync data models representing path metadata and cross-state record comparisons.                          | [src/model/codemap.md](./src/model/codemap.md)                 |
| `src/services`      | Operational service layer for sync execution, scheduling, progress/status, commands, i18n, and WebDAV access. | [src/services/codemap.md](./src/services/codemap.md)           |
| `src/settings`      | Settings schema and modular configuration UI with validation and runtime setting propagation.                 | [src/settings/codemap.md](./src/settings/codemap.md)           |
| `src/storage`       | Persistent KV-backed stores for sync records, blob snapshots, and WebDAV traversal cache state.               | [src/storage/codemap.md](./src/storage/codemap.md)             |
| `src/sync`          | End-to-end sync orchestration from decisioning to task execution, retries, events, and record updates.        | [src/sync/codemap.md](./src/sync/codemap.md)                   |
| `src/sync/core`     | Merge/conflict primitives used by sync tasks for timestamp-aware and content-aware reconciliation.            | [src/sync/core/codemap.md](./src/sync/core/codemap.md)         |
| `src/sync/decision` | Deterministic rule engine that converts local/remote/base snapshots into ordered sync task plans.             | [src/sync/decision/codemap.md](./src/sync/decision/codemap.md) |
| `src/sync/tasks`    | Atomic executable sync commands (push/pull/mkdir/remove/conflict resolution) with typed results.              | [src/sync/tasks/codemap.md](./src/sync/tasks/codemap.md)       |
| `src/sync/utils`    | Sync-specific utilities for task-list optimization, path gating, ignored checks, and record updates.          | [src/sync/utils/codemap.md](./src/sync/utils/codemap.md)       |
| `src/types`         | TypeScript augmentations for internal/undocumented Obsidian APIs used by plugin runtime/UI code.              | [src/types/codemap.md](./src/types/codemap.md)                 |
| `src/utils`         | Cross-cutting utilities for traversal, path/stat adapters, retries, request throttling, and diagnostics.      | [src/utils/codemap.md](./src/utils/codemap.md)                 |
| `src/utils/mime`    | Minimal path-based markdown-type detection helper scope for sync/filter decisions.                            | [src/utils/mime/codemap.md](./src/utils/mime/codemap.md)       |
| `src/explorer`      | Self-contained WebDAV file explorer UI for remote directory selection.                                        | [src/explorer/codemap.md](./src/explorer/codemap.md)           |

## Mechanisms

### Remote Cache

It helps “trivially” in steady-state sync, but it helps a lot in cold-start sync.

It’s not part of normal sync correctness logic. It’s a bootstrap optimization.

- The expensive part is remote tree traversal (ResumableWebDAVTraversal), especially with big vaults/rate-limited WebDAV.
- That traversal cache lives in local IndexedDB (traverseWebDAVKV) and is device-local.
- New device = no local cache, so first sync must re-scan everything.
- Export/import just copies that local traversal cache through WebDAV so another device can skip the first heavy scan.

So it exists for:

1. faster onboarding on new devices,
2. less API pressure/rate-limit pain on first run,
3. manual recovery after cache loss.

Not for automatic sync behavior.

### Remote/Local Presence Resolution

This plugin is doing a 3-way heuristic per path using:

1. local stat list,
2. remote stat list,
3. previous sync record (syncRecord: last known local+remote state + optional base blob).
   Core rule: compare current local/remote against last synced record.
   File presence matrix (simplified)

**With existing record**:

- local exists + remote exists
  - both changed since record → conflict task (merge/latest timestamp/skip per setting)
  - only local changed → push
  - only remote changed → pull
  - neither changed → noop

- remote exists + local missing
  - remote changed since record → pull (local was likely stale/missing)
  - remote unchanged → remove remote (propagate local deletion)

- local exists + remote missing
  - local changed since record → push
  - local unchanged → remove local (propagate remote deletion)

**No record**:

- both exist → conflict resolve (or noop in loose mode if same size)
- only local → push
- only remote → pull

Folders are similar but based on child-content change detection (not folder mtime, since folder mtime is unreliable).
After execution it updates records by re-reading local+remote state; orphan records are cleaned.
