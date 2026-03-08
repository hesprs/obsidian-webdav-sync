# src/sync/tasks

## Responsibility

Implements executable sync commands (file transfer, mkdir/remove, conflict handling, bookkeeping) as atomic units consumed by the sync engine.

## Design Patterns

- Command pattern: one class per operation with `exec()`.
- Shared base contract via task interfaces/result objects.
- Template-style common behavior in base task helpers (path/context access).
- Policy strategy in conflict task (merge strategy selected from settings).

## Data & Control Flow

1. Planner instantiates task objects with context (`vault`, `webdav`, records, paths, settings).
2. Task validates current state (existence/stat/content where required).
3. Task performs local/remote mutation or produces noop/skip outcome.
4. Returns typed `TaskResult` with success/failure and record-update hints.
5. Engine aggregates results and persists mtime updates for eligible tasks.

## Integration Points

- Obsidian `Vault` API for local read/write/trash/folder ops.
- WebDAV client for remote upload/download/delete/mkdir calls.
- `src/sync/core/merge-utils.ts` for conflict resolution internals.
- `src/storage/sync-record.ts` + blob store for record/base-content interactions.
- Shared path/stat utilities from `src/utils/*`.

## Key Files

- `task.interface.ts` — base types and task contracts.
- `push.task.ts`, `pull.task.ts` — file sync transfer actions.
- `remove-local.task.ts`, `remove-remote.task.ts`, `remove-remote-recursively.task.ts` — deletion actions.
- `mkdir-local.task.ts`, `mkdir-remote.task.ts`, `mkdirs-remote.task.ts` — directory creation actions.
- `conflict-resolve.task.ts` — conflict merge and resolution handling.
