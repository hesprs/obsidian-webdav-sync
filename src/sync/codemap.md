# src/sync

## Responsibility

Owns sync-run orchestration: build a prepared plan, enforce confirmation policy, optimize tasks, execute with cancellation/retry behavior, and persist sync-state mutations after each execution batch.

## Design Patterns

- Two-phase orchestration (`SyncEngine`): `preparePlan()` computes immutable plan metadata; `start()` executes with UI gates and progress/event side effects.
- Command execution model (`tasks/*`): all operations implement `BaseTask.exec()` and return typed `TaskResult` with optional `skipRecord` semantics.
- Planner/executor split: `TwoWaySyncDecider` produces task graph; engine does not contain branch-heavy diff logic.
- Post-plan optimization passes: mkdir/remove-remote tasks are collapsed into recursive/batched variants before execution.
- Fault-tolerant loop: transient 503 handling (`executeWithRetry` + `breakableSleep`) and global cancel subscription.

## Data & Control Flow

1. `preparePlan(runKind)` creates `SyncRecord` scoped by `getSyncStateKey`, ensures remote base dir exists, and clears stale remote snapshot/records when base dir is missing.
2. `TwoWaySyncDecider.decide()` returns raw `BaseTask[]` from current snapshots + persisted state.
3. `start()` classifies tasks into noop/skipped/actionable, applies manual confirmation (`TaskListConfirmModal`), and optional auto-sync delete confirmation (`DeleteConfirmModal`) with reupload conversion (`RemoveLocalTask` -> `PushTask`/`MkdirRemoteTask`).
4. Task list is deduplicated, optimized (`mergeMkdirTasks`, `mergeRemoveRemoteTasks`), and chunked (size 200).
5. `execTasks()` runs sequentially per chunk, emits progress for displayable tasks only (excluding `NoopTask`/`CleanRecordTask`), and records per-task outcomes.
6. `updateMtimeInRecord()` applies deterministic state updates for successful tasks after each chunk.
7. Engine emits lifecycle events (`preparing`, `start`, `progress`, `update-mtime`, `end`, `error`) and surfaces failed-task details in manual mode.

## Integration Points

- Filesystem adapters: `src/fs/local-vault.ts`, `src/fs/webdav.ts`.
- State persistence: `src/storage/sync-record.ts` (local records + remote traversal snapshot).
- Traversal lifecycle: `src/utils/traverse-webdav.ts` (`ResumableWebDAVTraversal`) via state-keyed snapshot management.
- UI/event layer: modals + notices + `src/events` emitter/subscriber contracts.
- Runtime services: `WebDAVSyncPlugin` settings/progress service and WebDAV client primitives (`exists`, `createDirectory`, `stat`, content ops).
