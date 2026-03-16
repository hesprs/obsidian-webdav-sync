# src/services

## Responsibility

Provide runtime orchestration around sync triggering, request scheduling, sync execution, UI/event state projection, and WebDAV client access.

Primary responsibilities in this folder:

- Funnel all sync requests (manual/startup/interval/realtime) through a single scheduler.
- Batch/debounce automatic sync requests and serialize execution around plugin busy state.
- Build and run `SyncEngine` plans through a guarded executor boundary.
- Project sync lifecycle events into status bar text, notices, and progress modal state.
- Build validated/rate-limited WebDAV clients and perform connection probes.
- Manage runtime i18n selection and in-memory log capture.

## Design Patterns

- **Central request queue (`SyncSchedulerService`)**: every trigger submits a `SyncRequest`; scheduler coalesces pending requests into one `SyncOptions` batch.
- **Priority reduction**: batched mode resolves to `MANUAL_SYNC` if any request is manual; run kind resolves to `NORMAL` if any request needs full sync, otherwise `NUMB`.
- **Debounced auto-sync, immediate manual sync**: autos are delayed by `AUTO_SYNC_DEBOUNCE_MS`; manual requests flush immediately.
- **Executor as sync gate**: `SyncExecutorService` enforces account-configured + idle preconditions, injects required exclusion rules, prepares plan, and skips empty plans.
- **Reactive projection layer**: `EventsService`/`ProgressService` subscribe to RxJS sync events and update UI state with throttled modal refresh.
- **Factory + proxy wrapper**: `WebDAVService` validates URL, creates `webdav` client, and wraps function calls in `apiLimiter.schedule` via `Proxy`.
- **Lifecycle teardown**: services with timers/subscriptions expose `unload()` to clear timers, flush pending requests, close modal, and unsubscribe.

## Data & Control Flow

1. **Sync request producers**
   - `CommandService.start-sync` -> `syncSchedulerService.requestManualSync()`.
   - `ScheduledSyncService` startup timer and interval timer -> `requestSync({ source: 'startup' | 'interval' })`.
   - `RealtimeSyncService` vault create/delete/modify/rename handlers -> `requestSync({ source: 'realtime' })`, gated by `settings.realtimeSync` and fast/full run-kind setting.

2. **Queueing and batching (`SyncSchedulerService`)**
   - Enqueue request with timestamp + promise resolvers.
   - Compute next flush delay (`0` for any manual request, else debounce from latest request time).
   - On flush, if plugin is syncing, poll with `SYNC_IDLE_POLL_MS`; otherwise drain queue, reduce batch, execute once via executor, and resolve/reject all batch promises.

3. **Execution boundary (`SyncExecutorService`)**
   - Return `false` when currently syncing or account config is incomplete.
   - Wait until idle, enforce vault `configDir` exclusion rule, and persist if injected.
   - Create `SyncEngine` using vault/token/remote settings and `WebDAVService` client.
   - Call `preparePlan(runKind)` and short-circuit when `plan.hasActionableTasks === false`.
   - Start engine with `{ mode, plan, runKind }` and return execution result boolean.

4. **Lifecycle/UI propagation**
   - Event stream updates status (`preparing`, `start`, percentage progress, `complete/failed`).
   - `StatusService` stores last-complete baseline and refreshes relative time every minute.
   - `ProgressService` tracks `UpdateSyncProgress`, resets on start, marks sync end, and updates modal with throttling.
   - Errors map 503 to localized “requests too frequent” messaging.

## Integration Points

- **Plugin composition root**: `src/index.ts` instantiates and wires scheduler/executor/realtime/scheduled/command services.
- **Sync engine/domain**: `SyncEngine`, `SyncStartMode`, `SyncRunKind`, and sync event emitters/observers.
- **Settings runtime**: `plugin.settings`, `useSettings()`, and `saveSettings()` (including interval updates from settings UI).
- **Obsidian runtime APIs**: command registration, vault event hooks, status bar, notices, timer APIs.
- **WebDAV transport**: `webdav` package client creation and method-level rate limiting.
- **Cross-cutting utilities**: `waitUntil`, `apiLimiter`, i18n namespace, logger.
