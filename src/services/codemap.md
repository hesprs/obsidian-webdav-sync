# src/services

## Responsibility

Implement operational service layer for sync execution, automation triggers, event/progress state, infrastructure clients, and shared cross-cutting concerns.

## Design Patterns

- Service-per-domain organization (`sync`, `events`, `progress`, `status`, `webdav`, `cache`, `i18n`, `logging`, `commands`).
- Orchestrator/facade role in `SyncExecutorService` to prepare and launch sync with consistent prechecks.
- Observer/reactive pattern with RxJS-backed events and throttled progress propagation.
- Factory-like client construction in `WebDAVService` for authenticated remote access.
- Trigger abstraction: manual command, interval scheduler, and realtime debounce listener all converge on shared execution flow.

## Data & Control Flow

1. Sync starts from `CommandService`, `ScheduledSyncService`, or `RealtimeSyncService`.
2. `SyncExecutorService.executeSync()` validates settings/context and constructs runtime sync dependencies.
3. Decider + engine compute and execute pull/push/delete task sets against local vault + remote WebDAV state.
4. Engine events are consumed by `EventsService`/`ProgressService` to update status bar, notices, and progress consumers.
5. Completion handlers persist sync metadata, refresh last-sync indicators, and reset runtime status.

## Integration Points

- Obsidian platform APIs: vault file events, commands, status bar items, user notices.
- Sync core modules: `SyncEngine`, `TwoWaySyncDecider`, task and sync-record models.
- Remote transport: `webdav` client wrappers in `WebDAVService`.
- Local persistence: KV/indexed storage for sync records and cached remote traversal snapshots.
- Shared app services: i18n provider, logger, and global event streams.

## Key Files

- `sync-executor.service.ts` — canonical entrypoint for safe sync execution.
- `realtime-sync.service.ts` — file-change driven sync trigger with debounce control.
- `scheduled-sync.service.ts` — interval/startup sync scheduling lifecycle.
- `events.service.ts` — sync lifecycle event handling and user notification updates.
- `progress.service.ts` — progress state aggregation/throttled publication.
- `status.service.ts` — status bar rendering and state transitions.
- `webdav.service.ts` — configured WebDAV client creation and connection utilities.
- `cache.service.v1.ts` — serialized/compressed cache persistence for traversal metadata.
- `command.service.ts` — Obsidian command registration and handler binding.
- `i18n.service.ts` — language initialization/switch logic.
- `logger.service.ts` — logging setup, storage, and export helpers.
