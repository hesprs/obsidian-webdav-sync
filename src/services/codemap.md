# Services Codemap

## Responsibility

The `services` directory contains the core logic for managing the plugin's lifecycle, synchronization orchestration, UI state, and external integrations.

- **Sync Orchestration**: `SyncExecutorService` acts as the primary entry point for starting a sync, coordinating between the decider and the executor. `RealtimeSyncService` and `ScheduledSyncService` provide automated triggers for sync.
- **Communication & State**: `EventsService` and `ProgressService` handle the flow of information during sync, updating the UI and internal state based on RxJS events. `StatusService` manages the Obsidian status bar.
- **Infrastructure**: `WebDAVService` manages remote connections. `CacheServiceV1` handles persistence of remote traversal data. `LoggerService` and `I18nService` provide cross-cutting concerns like logging and internationalization.
- **User Interaction**: `CommandService` registers user-facing commands to control the sync process.

## Design Patterns

- **Service Pattern**: Most classes are structured as singleton-like services injected into the main plugin instance.
- **Observer Pattern**: Extensively used via RxJS in `EventsService` and `ProgressService` to react to sync lifecycle events.
- **Factory Pattern**: `WebDAVService` acts as a factory for creating configured WebDAV clients.
- **Command Pattern**: `CommandService` encapsulates Obsidian command registration.
- **Facade/Orchestrator**: `SyncExecutorService` simplifies the complex setup required to initiate a sync.
- **Debounce/Throttle**: Used in `RealtimeSyncService` (debounce) and `ProgressService` (throttle) to manage high-frequency events.

## Data & Control Flow

1.  **Trigger**: A sync is triggered manually (`CommandService`), automatically on a timer (`ScheduledSyncService`), or by file changes (`RealtimeSyncService`).
2.  **Execution**: The trigger calls `SyncExecutorService.executeSync()`.
3.  **Preparation**: `SyncExecutorService` verifies account configuration, ensures the Obsidian config directory is excluded, and initializes `NutstoreSync` and `TwoWaySyncDecider`.
4.  **Decision**: `TwoWaySyncDecider` compares local and remote states (using `SyncRecord` and `CacheServiceV1` data) to determine necessary actions.
5.  **Sync**: `NutstoreSync.start()` is called. It emits events via `~/events`.
6.  **Feedback**: `EventsService` and `ProgressService` listen to these events to update the `StatusService` (status bar) and `SyncProgressModal`.
7.  **Completion**: Upon completion, `EventsService` updates the last sync time and shows notifications.

## Integration Points

- **Obsidian API**: Integration with `Vault` (events), `StatusBar`, `Commands`, and `Notice`.
- **WebDAV**: Communication with remote servers via the `webdav` library, managed by `WebDAVService`.
- **Local Storage**: Persistence of sync records and cache via `~/storage` (IndexedDB/KV).
- **RxJS**: Global event bus defined in `~/events` for decoupled communication.
- **i18next**: Internationalization support via `~/i18n`.
- **Superjson & Fflate**: Used by `CacheServiceV1` for efficient data serialization and compression.
