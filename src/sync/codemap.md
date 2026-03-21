# src/sync

## Responsibility

Implements the sync domain runtime: produce a deterministic task plan from local/remote/state snapshots, run the plan with confirmation/retry/cancel controls, and publish lifecycle/progress/result snapshots for services/UI.

Primary responsibilities in this folder:

- Orchestrate plan preparation and execution (`SyncEngine` in `index.ts`).
- Convert snapshots + records into concrete task commands (`decision/*`).
- Execute atomic sync commands (`tasks/*`) where each task owns its own storage mutation behavior.
- Optimize task lists before execution (`utils/merge-mkdir-tasks.ts`, `utils/merge-remove-remote-tasks.ts`).
- Centralize sync-specific error taxonomy (`errors.ts`) and merge policies (`utils/merge.ts`).

## Design Patterns

- **Two-phase orchestration**: `preparePlan()` builds immutable plan data (`tasks`, `hasActionableTasks`); `start()` runs execution and updates run snapshots.
- **Planner/runner separation**: `TwoWaySyncDecider` + `twoWayDecider()` handle branch-heavy state transitions; `SyncEngine` handles execution lifecycle and policy gates.
- **Command pattern for operations**: all task classes extend `BaseTask` and return `TaskResult` (`success | failure`, optional `skipRecord`).
- **Task-local state mutation**: sync-record updates now happen inside task `exec()` implementations (upsert/remove/clean/merged updates), with `skipRecord` signaling non-mutating follow-up behavior.
- **Pre-execution rewrite passes**: mkdir/remove-remote tasks are collapsed into recursive/batched variants to reduce remote API calls.
- **Resilient execution loop**: retryable WebDAV/task failures are retried with `breakableSleep`; cancellation propagates through `SyncCancelledError`.

## Data & Control Flow

1. `SyncEngine.preparePlan(runKind)` builds a state-keyed `SyncRecord`, ensures remote base directory exists, and drops stale records + stored remote snapshot when the base directory is missing.
2. `TwoWaySyncDecider.decide()` loads previous records, local walk, and remote walk (fresh or stored for `SyncRunKind.NUMB`), then delegates to `twoWayDecider()`.
3. `twoWayDecider()` generates `BaseTask[]` using `TaskFactory`:
   - file transitions (push/pull/remove/conflict/noop/skipped/filename-error),
   - orphaned-record cleanup (`CleanRecordTask`),
   - folder transitions using descendant-change checks (`hasFolderContentChanged`) and ignored-item guards (`hasIgnoredInFolder`).
4. `SyncEngine.start()` emits plan summary, applies manual confirmation (`TaskListConfirmModal`) and optional auto-delete confirmation (`DeleteConfirmModal`), including reupload conversion for selected `RemoveLocalTask`s.
5. Confirmed tasks are deduplicated, optimized (`mergeMkdirTasks`, `mergeRemoveRemoteTasks`), chunked (200), then executed sequentially with per-task retry (`executeWithRetry`).
6. Progress snapshots include displayable tasks only (exclude `NoopTask` and `CleanRecordTask`); failures are aggregated into `resultSummary.failed`.
7. Engine finalizes run state (`completed`, `completed_noop`, `failed`, `cancelled`) and maps cancellation/retry exhaustion via `isSyncCancelledError`, `SyncCancelledError`, and `SyncRetryExhaustedError`.

## Integration Points

- **Filesystem boundaries**: `LocalVaultFileSystem` and `RemoteWebDAVFileSystem` provide walk snapshots used by decision logic.
- **Persistence boundary**: `SyncRecord` (`src/storage`) stores local/remote records, subtree removals, merged conflict snapshots, and remote traversal metadata.
- **Traversal snapshot lifecycle**: `ResumableWebDAVTraversal` is used to clear stored remote snapshots when base-dir state is reset.
- **Services/event pipeline**: scheduler/executor services provide run requests; `emitSyncRun`/`updateSyncRunSnapshot`/`finalizeSyncRun` expose lifecycle and progress to UI.
- **UI confirmation modals**: `TaskListConfirmModal` and `DeleteConfirmModal` gate destructive/manual execution paths.
- **Platform/util dependencies**: path normalization/conversion helpers, retryability checks, i18n, and logger are shared across engine, planner, and tasks.
