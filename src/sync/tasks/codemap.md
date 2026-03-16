# src/sync/tasks

## Responsibility

Defines executable sync commands and their contracts. Each task mutates one sync concern (transfer, directory creation, deletion, conflict handling, or bookkeeping signal) and returns a normalized `TaskResult`.

## Design Patterns

- Command pattern: one class per operation with `exec()`.
- Shared base abstraction (`BaseTask`) for path normalization, dependency access, JSON diagnostics, and error wrapping.
- Result contract with state-update hinting: `TaskResult` supports `skipRecord` for operations that should not mutate sync state.
- Strategy delegation in conflict handling (`ConflictStrategy`: diff/patch, latest-timestamp, skip).

## Data & Control Flow

1. Planner builds tasks with `BaseTaskOptions` (`vault`, `webdav`, `remoteBaseDir`, paths, `SyncRecord`).
2. `BaseTask` resolves relative remote paths to absolute and normalizes local vault paths before execution.
3. Task implementations perform side effects:
   - transfer: `PushTask`, `PullTask`,
   - directory: `MkdirLocalTask`, `MkdirRemoteTask`, `MkdirsRemoteTask`,
   - deletion: `RemoveLocalTask`, `RemoveRemoteTask`, `RemoveRemoteRecursivelyTask`,
   - conflict: `ConflictResolveTask`,
   - bookkeeping/policy: `NoopTask`, `SkippedTask`, `CleanRecordTask`, `FilenameErrorTask`.
4. Failures are normalized via `toTaskError`; engine aggregates results and updates records only for eligible successes.

## Integration Points

- Used by planner (`src/sync/decision/*`) through `TaskFactory`.
- Executed by orchestrator (`src/sync/index.ts`) with retry/cancel/progress logic.
- Conflict internals depend on `src/sync/core/merge-utils.ts` and `~/utils/merge-dig-in`.
- State mutation phase (`src/sync/utils/update-records.ts`) inspects task classes to derive deterministic sync-state updates.

## Key Files

- `task.interface.ts` — `BaseTask`, `TaskResult`, `TaskError`, `toTaskError`.
- `conflict-resolve.task.ts` — merge strategy dispatch + content reconciliation.
- `mkdirs-remote.task.ts` / `remove-remote-recursively.task.ts` — optimized task variants produced by sync utils.
- `skipped.task.ts` / `filename-error.task.ts` — policy-driven non-mutating outcomes.
