# src/services

## Responsibility

Provide runtime service-layer behavior for sync triggering/execution, sync UI state propagation, infrastructure client creation, and operational utilities used by the plugin.

Primary responsibilities in this folder:

- Triggering sync from commands, startup delay, interval timer, and vault file events.
- Guarding and launching automatic sync execution (`SyncExecutorService`).
- Reacting to sync lifecycle events to drive status text, notices, and progress modal updates.
- Creating validated/rate-limited WebDAV clients and connection checks.
- Managing cache export/import/delete/list operations for traversal cache snapshots.
- Managing runtime language selection and in-memory log collection.

## Design Patterns

- **Service-per-capability split**: each file owns one domain (`command`, `scheduled`, `realtime`, `executor`, `events`, `progress`, `status`, `webdav`, `cache`, `i18n`, `logger`).
- **Reactive observer pattern**: `EventsService` and `ProgressService` subscribe to RxJS event streams (`onPreparingSync`, `onStartSync`, `onSyncProgress`, `onEndSync`, `onSyncError`).
- **Trigger fan-in to executor**: auto sync triggers (`ScheduledSyncService`, `RealtimeSyncService`) route through `SyncExecutorService`; manual command currently constructs and starts `SyncEngine` directly.
- **Factory/wrapper composition**: `WebDAVService.createWebDAVClient()` validates URL, builds `webdav` client, then wraps it with rate limiting.
- **Time-based control patterns**: debounce for realtime file-change bursts, throttle for progress modal redraw, and interval/timer scheduling for auto sync and status age updates.
- **Lifecycle cleanup pattern**: services expose `unload()` to cancel timers, cancel debounce, close modal, and unsubscribe observers.

## Data & Control Flow

1. **Entry points**
   - Manual sync command (`CommandService`) checks account config, optionally shows confirm modal, then creates `SyncEngine` and starts with `MANUAL_SYNC`.
   - Startup/interval sync (`ScheduledSyncService`) uses configured delays/intervals and calls `syncExecutor.executeSync(AUTO_SYNC)`.
   - Vault create/delete/modify/rename (`RealtimeSyncService`) checks `realtimeSync`, debounces, waits for non-syncing state, then calls executor with `AUTO_SYNC`.

2. **Automatic sync execution (`SyncExecutorService`)**
   - Returns early when already syncing or account is not configured.
   - Waits for sync idle state (`waitUntil`).
   - Ensures vault `configDir` is always present in exclusion rules and persists settings if injected.
   - Builds `SyncEngine` with vault, token, server URL/base dir, and WebDAV client.
   - Builds `SyncRecord` (KV-backed, db key from vault + remote base dir) and runs `TwoWaySyncDecider.decide()`.
   - If no decided tasks, returns `false`; otherwise starts engine and returns `true`.

3. **Runtime event/UI propagation**
   - Sync lifecycle events update plugin UI state (`toggleSyncUI`) and status text/notices (`StatusService`).
   - `StatusService.setLastSyncTime()` stores completion baseline text and updates relative-time suffix every minute.
   - `ProgressService` resets progress on start, tracks updates from progress events, and throttles modal refresh.
   - Sync errors map 503 cases to localized message and surface as notice + failed status.

4. **Support flows**
   - `CacheServiceV1` serializes cache (`superjson`) -> compresses (`deflate`) for save; restore does inflate + parse + validation before KV write.
   - `I18nService` selects language from settings fallback to browser locale.
   - `LoggerService` captures logs in memory with different reporter wiring for dev vs production.

## Integration Points

- **Obsidian APIs**: command registration, vault file events, status bar item updates, notices, timers.
- **Sync domain**: `SyncEngine`, `SyncStartMode`, `TwoWaySyncDecider`, sync event bus, sync record model.
- **Settings/config**: `useSettings()`, persisted plugin settings mutations (`saveSettings`).
- **Storage/KV**: `syncRecordKV`, `traverseWebDAVKV`, traversal/sync DB key helpers.
- **WebDAV transport**: `webdav` client package, server URL/account/credential from settings, rate-limited client wrapper.
- **Utilities/shared modules**: i18n translation namespace, logger utility, path/date/time helpers, directory listing API.
