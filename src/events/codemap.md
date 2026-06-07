# src/events/

## Responsibility

Shared reactive state for sync lifecycle and cancellation. This folder defines the sync run snapshot model, the mutable `syncRun` store, the `syncCancel` broadcast hook, and helpers for creating, updating, and finalizing runs.

## Design

- `ref<T>()` is a tiny observable value with getter/setter call syntax plus subscribe/unsubscribe.
- `hook<Args>()` is a fire-and-forget event channel with no payload storage.
- `syncRun` is the central `Ref<SyncRunSnapshot | undefined>`; consumers read current state via `syncRun()` and subscribe for updates.
- `sync-terminate.ts` is the terminal transition helper: it normalizes error info, stamps end time/duration, writes the final snapshot back through `syncRun`, and logs the outcome.
- The sync snapshot is stage-based (`queued` → planning/confirmation/executing → terminal), and terminal stages are handled consistently by services and UI.

## Flow

- `createQueuedSyncRunSnapshot()` seeds a new run with queued timestamps and empty progress state.
- `updateSyncRunSnapshot()` patches the current run immutably and refreshes `timestamps.updatedAt`; `endedAt` also computes `durationMs`.
- `SyncExecutorService` creates the queued snapshot, publishes planning updates, and hands execution to `SyncEngine`.
- `SyncEngine` keeps publishing incremental progress with `syncRun(...)`, then calls `finalizeSyncRun()` when the run completes, fails, or is cancelled.
- `syncCancel()` is emitted from UI/commands during unload; `SyncEngine` subscribes to it and flips `isCancelled`, while waits use `breakableSleep(syncCancel, ...)`.

## Integration

- `src/services/sync-executor.service.ts` is the main publisher: it emits run snapshots during planning and on terminal transitions.
- `src/sync/index.ts` is both publisher and subscriber: it listens to `syncCancel`, updates `syncRun` throughout execution, and delegates termination to `finalizeSyncRun()`.
- `src/services/observability.service.ts` and `src/utils/logger.ts` subscribe to `syncRun` to keep the status bar, modal/notice UI, and run logs aligned with the latest snapshot.
- `src/services/sync-scheduler.service.ts` reads `syncRun()?.stage` to avoid scheduling realtime work while a run is executing.
- `src/components/SyncProgressModal.ts`, `src/components/SyncRibbonManager.ts`, `src/services/command.setup.ts`, and `src/index.ts` emit `syncCancel()` to stop an active sync.
