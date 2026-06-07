# src/

## Responsibility

Application root for the Obsidian WebDAV Sync plugin. This folder boots the plugin, owns long-lived runtime services and stores, and bridges Obsidian lifecycle events to the sync engine, settings UI, and WebDAV transport.

## Design

- `src/index.ts` is the composition root: it creates the plugin instance state, initializes persistence, starts orchestration services, and patches WebDAV request handling.
- The codebase is layered around a sync core in `sync/`, service orchestration in `services/`, UI composition in `components/`, persisted configuration in `settings/`, and shared infrastructure in `storage/`, `events/`, `utils/`, `platform/`, and `fs/`.
- Runtime state is centralized on the plugin instance and shared event/store objects rather than passed through deep call chains.
- `webdav-patch.ts` adapts the WebDAV client to Obsidian’s request API so the rest of the sync stack can use a consistent transport path.

## Flow

1. `WebDAVSyncPlugin.onload()` loads saved settings, initializes IndexedDB stores, registers the settings tab, exposes the plugin instance, registers commands, starts the sync scheduler, and patches WebDAV requests.
2. User actions, vault events, or timers enter through `services/` and update shared sync events/state.
3. `SyncExecutorService` prepares encryption context, creates the WebDAV client, and launches the sync engine.
4. `src/sync/` walks local and remote trees through `fs/`, compares them against cached records in `storage/`, and produces/executess tasks.
5. Progress and terminal snapshots flow back through `events/` to `services/observability.service.ts`, `components/`, and the plugin ribbon/UI.
6. `onunload()` stops scheduled work, cancels active syncs, and unloads persistent stores and observability hooks.

## Integration

- `settings/` defines the persisted schema and editor UI consumed by `src/index.ts`.
- `services/` coordinates scheduling, execution, observability, commands, and WebDAV client setup.
- `sync/` is the engine boundary; it depends on `fs/`, `storage/`, `events/`, and `utils/` to plan and run sync tasks.
- `components/` provides the ribbon, modals, explorer, and file-tree UI used by settings and sync flows.
- `fs/` hides vault/WebDAV traversal details, while `platform/` provides path, binary, and crypto adapters shared across the stack.
- `storage/` persists sync records and cached content; `events/` carries sync run and cancellation state; `utils/` supplies shared helpers; `webdav-patch.ts` installs the request bridge used by remote operations.
