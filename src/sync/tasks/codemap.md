# src/sync/tasks/

## Responsibility

Task implementations for sync actions between the vault and WebDAV remote.
Each task performs one file-level operation and returns a `TaskResult` for the sync engine.

## Design

- `BaseTask<T>` is the shared abstract base.
  - Carries `vault`, `webdav`, `syncRecord`, `localPath`, `remotePath`, and optional stat payloads.
  - Subclasses declare a translated `name` and implement `exec()`.
- `TaskError` wraps task failures with the originating task for reporting and retries.
- Task option types in `sync-decision.interface.ts` form the hierarchy:
  - `TaskOptions` → path pair plus optional stats.
  - Narrower variants add required `local`/`remote` file or folder stats.
  - `TaskFactory` creates concrete task instances used by the decision layer.
- Task types:
  - `push` / `pull` transfer file contents and refresh sync records.
  - `merge` resolves conflicting file edits and may update both sides.
  - `remove*` delete local/remote items, recursively when a subtree is detected.
  - `mkdir*` create missing folders and persist directory records.
  - `add-record` / `clean-record` only update the record store.

## Flow

1. The sync decider creates task instances from current local/remote/record state.
2. `SyncEngine` groups and orders them through `optimizeTasks()`:
   - deduplicates tasks,
   - merges nested remove tasks into recursive remove tasks,
   - sorts mkdir tasks by depth,
   - batches push/pull work by chunk and throughput limits.
3. `SyncEngine.start()` executes each group with retry handling.
4. Each task:
   - reads current file content/stat when needed,
   - performs the vault or WebDAV operation,
   - updates `SyncRecord` with fresh stats/base text/chunk data,
   - returns `{ success: true }` or `{ success: false, error }`.
5. `push`, `pull`, and `merge` also handle encryption-aware content transforms and re-stat the written target to keep records in sync.

## Integration

- Called only from `src/sync/index.ts` during plan preparation and execution.
- Depends on vault helpers, WebDAV helpers, encryption utilities, binary conversion, and `SyncRecord` persistence.
- Emits failures as `TaskError` so the engine can retry transient errors, log task metadata, and build run summaries.
- `SyncEngine` filters out `add-record` and `clean-record` from user-facing progress, but still executes them as part of the plan.
