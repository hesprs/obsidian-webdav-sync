# src/services/

## Responsibility

Service-layer orchestration for sync lifecycle, scheduling, WebDAV client creation, runtime observability, and command registration.

## Design

- `SyncSchedulerService` batches sync requests, deduplicates triggers, and delays execution until the plugin is idle.
- `SyncExecutorService` owns the actual sync run: prepare keys, build `SyncEngine`, plan tasks, update run snapshots, and finalize outcomes.
- `ObservabilityService` subscribes to `syncRun` state and reflects it in status bar, notices, and the progress modal.
- `WebDAVService` creates authenticated WebDAV clients and wraps them with a rate-limited proxy.
- `command.setup.ts` registers Obsidian commands that delegate to the sync workflow.

## Flow

1. Startup enables vault change listeners and optional startup/interval sync timers in the scheduler.
2. File events are filtered by glob rules; matching changes enqueue a sync request.
3. Pending requests are flushed into a single execution request with merged trigger/source metadata.
4. The executor waits for the plugin to be idle, then creates the WebDAV client, prepares encryption keys, and starts `SyncEngine` planning/execution.
5. Planning and execution publish incremental snapshots through the shared sync event store.
6. Observability reacts to each snapshot to update UI state, progress modal content, and mobile/desktop notifications.
7. Commands trigger manual sync, cancel an active run, or open the progress modal.

## Integration

- Depends on plugin state/settings, vault/workspace events, and Obsidian UI primitives (`Notice`, status bar, modal lifecycle).
- Uses shared sync events (`syncRun`, snapshot builders, cancellation/finalization helpers) as the coordination channel between scheduler, executor, and observability.
- Delegates file synchronization to `SyncEngine` and WebDAV transport to `webdav` via `createClient`.
- Uses shared utilities for logging, i18n, credential access, timing, glob matching, manual sync launch, and API rate limiting.
