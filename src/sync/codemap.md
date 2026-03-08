# src/sync

## Responsibility

Coordinates end-to-end sync runs for the plugin: initialize sync context, request a two-way task plan, apply user-facing confirmation rules, optimize task batches, execute tasks with cancellation/retry handling, and finalize record/progress updates.

## Design Patterns

- Orchestrator/Façade (`SyncEngine` in `index.ts`): central runtime coordinator for planning, confirmation, execution, and lifecycle events.
- Command pattern (`tasks/*`): each sync action is an executable task with a shared `BaseTask`/`TaskResult` contract.
- Decision engine split (`decision/*`): planning is separated from execution via `TwoWaySyncDecider` + pure decision logic.
- Optimization passes (`utils/*`): pre-execution transforms merge related mkdir/remove-remote work to reduce remote API calls.
- Resilient execution loop: per-task retry on transient 503 errors plus global cancellation subscription.

## Data & Control Flow

1. `SyncEngine.start()` normalizes remote base path, ensures remote directory exists, resets records if remote root is missing, and exits early on cancellation.
2. `TwoWaySyncDecider.decide()` reads local/remote snapshots + sync records and returns raw `BaseTask[]`.
3. Engine partitions tasks (`NoopTask`, `SkippedTask`, actionable tasks), then applies confirmation gates:
   - optional task-list confirmation for manual sync,
   - optional delete confirmation in auto-sync with reupload conversion (`RemoveLocalTask` → `PushTask`/`MkdirRemoteTask`) when selected.
4. Action list is deduplicated, optimized (`mergeMkdirTasks`, `mergeRemoveRemoteTasks`), and chunked (200 tasks/chunk).
5. `execTasks()` runs each task sequentially per chunk, emits progress for displayable tasks, and uses `executeWithRetry()` to wait/retry on 503 until success/failure/cancel.
6. After each chunk, `updateMtimeInRecord()` persists post-task state to sync records (including blob base content where applicable).
7. On completion, engine emits end/error events and surfaces failed-task details in manual sync.

## Integration Points

- `src/fs/local-vault` and `src/fs/webdav`: local and remote filesystem traversal/execution.
- `src/storage/sync-record` + `src/storage/blob`: persisted sync state and merge base blobs.
- `src/events`: sync lifecycle + progress emissions (`preparing/start/progress/update-mtime/end/error/cancel`).
- UI components (`DeleteConfirmModal`, `TaskListConfirmModal`, `FailedTasksModal`) and Obsidian `Notice` for user interaction.
- Plugin/runtime dependencies: `WebDAVSyncPlugin` settings/progress service and WebDAV client operations (`exists`, `createDirectory`, `stat`).
