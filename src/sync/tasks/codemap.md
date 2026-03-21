# src/sync/tasks

## Responsibility

Defines atomic executable sync commands and the shared task contract used by the sync engine. Each task performs one concrete filesystem/state action (or policy outcome) and returns a normalized `TaskResult`.

## Design Patterns

- Command pattern: one class per action, all exposing `exec()`.
- Shared task runtime (`BaseTask`) for dependency access (`vault`, `webdav`, `syncRecord`), path normalization, and JSON diagnostics.
- Unified error envelope (`TaskError`, `toTaskError`) so the engine can handle failures consistently.
- Task-local record mutation: successful tasks update or prune `SyncRecord` directly; `skipRecord` marks outcomes that should not trigger additional record updates.
- Strategy-based conflict resolution (`ConflictStrategy`): intelligent merge, latest timestamp winner, or skip.

## Data & Control Flow

1. Planner (`twoWayDecider` via `TaskFactory`) creates tasks with `BaseTaskOptions` and operation-specific snapshots/options.
2. `BaseTask` normalizes paths at read time:
   - `localPath` via vault path normalization,
   - `remotePath` resolved against `remoteBaseDir` unless already absolute.
3. `exec()` performs side effects and sync-record updates by operation type:
   - transfer: `PushTask`, `PullTask`,
   - directory creation: `MkdirLocalTask`, `MkdirRemoteTask`, batched `MkdirsRemoteTask`,
   - deletion: `RemoveLocalTask`, `RemoveRemoteTask`, batched `RemoveRemoteRecursivelyTask`,
   - reconciliation: `ConflictResolveTask`,
   - policy/bookkeeping: `NoopTask`, `SkippedTask`, `CleanRecordTask`, `FilenameErrorTask`.
4. Exceptions are logged in-task and converted to `TaskError`; the engine aggregates `TaskResult` and applies retry/cancel/progress behavior.

## Integration Points

- **Decision layer** (`src/sync/decision/*`): constructs task instances through `TaskFactory` and passes planned local/remote snapshots.
- **Execution layer** (`src/sync/index.ts`): executes task list, filters display-only task classes (`NoopTask`, `SkippedTask`, `CleanRecordTask` in specific contexts), and handles retry/cancel policy.
- **Task optimization passes** (`src/sync/utils/merge-mkdir-tasks.ts`, `src/sync/utils/merge-remove-remote-tasks.ts`): replace many single-path tasks with `MkdirsRemoteTask` / `RemoveRemoteRecursivelyTask`.
- **Merge utilities** (`src/sync/utils/merge.ts`, `~/utils/merge-dig-in`, `src/sync/utils/is-mergeable-path.ts`): used by `ConflictResolveTask` for timestamp and text-merge conflict paths.
- **Storage boundary** (`src/storage` `SyncRecord`): upsert/remove/clean/merge APIs are invoked directly from task implementations.

## Key Files

- `task.interface.ts` — `BaseTaskOptions`, `BaseTask`, `TaskResult`, `TaskError`, and `toTaskError`.
- `push.task.ts` / `pull.task.ts` — file transfer tasks with snapshot validation and sync-record upserts.
- `mkdir-local.task.ts` / `mkdir-remote.task.ts` / `mkdirs-remote.task.ts` — local/remote directory creation (including batched recursive variant).
- `remove-local.task.ts` / `remove-remote.task.ts` / `remove-remote-recursively.task.ts` — deletion tasks and subtree/path record pruning.
- `conflict-resolve.task.ts` — merge strategy dispatch, content reconciliation, and merged/latest snapshot record updates.
- `noop.task.ts` / `skipped.task.ts` / `clean-record.task.ts` / `filename-error.task.ts` — non-transfer control tasks for noop/skip/bookkeeping/validation outcomes.
