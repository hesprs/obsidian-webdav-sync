# src/components/

## Responsibility

Host UI interaction components for sync operations and settings actions. The directory is modal-centric and provides user confirmations, progress views, task/error lists, cache management dialogs, and ribbon button control.

Primary component groups:

- Sync execution UX: `SyncRibbonManager`, `SyncConfirmModal`, `SyncProgressModal`, `TaskListConfirmModal`, `DeleteConfirmModal`, `FailedTasksModal`.
- Cache UX: `CacheSaveModal`, `CacheRestoreModal`, `CacheClearModal`.
- Utility dialogs: `TextAreaModal`, `LogoutConfirmModal`, `FilterEditorModal`, `SelectRemoteBaseDirModal`.

## Design Patterns

- Obsidian modal pattern: nearly all files define classes extending `Modal` with `onOpen`/`onClose` lifecycle cleanup.
- Callback-driven actions: confirmation modals receive function callbacks (`onConfirm`, `onSuccess`, `onSave`) to keep business logic outside UI classes.
- Local transient state inside components:
  - selection arrays for checkbox tables,
  - confirmation toggles for destructive actions,
  - mutable filter lists and cache file lists.
- Service delegation pattern: cache and remote operations are delegated to service/util modules (`CacheService`, WebDAV helpers, KV stores) instead of embedding IO logic in UI rendering.
- Event-subscription UI updates: `SyncProgressModal` subscribes to sync events and updates progress/cancel state reactively.
- Consistent localization usage: all user-facing strings are pulled from `i18n.t(...)` keys.

## Data & Control Flow

- Manual sync trigger flow (`SyncRibbonManager`):
  1. Start ribbon click checks `plugin.isSyncing` and account configuration.
  2. If account missing, shows `Notice` and opens plugin settings tab.
  3. Creates `NutstoreSync` with WebDAV client, vault, token, and remote base dir.
  4. Starts sync in manual mode directly or behind `SyncConfirmModal` based on settings.
  5. Stop ribbon emits cancel event; `update()` toggles icon states/spinner/visibility.

- Progress reporting flow (`SyncProgressModal`):
  1. Subscribes to cancel and cache-update events on construction.
  2. `update()` reads `plugin.progressService.syncProgress` and refreshes percent, counts, current item, and completed task list.
  3. Completed tasks are classified by task class (`PushTask`, `PullTask`, mkdir/remove/conflict/skip variants) to render icon + localized action label.
  4. Cache progress section is shown and updated through `updateCacheProgress(total, completed)`.
  5. On close, unsubscribes and optionally invokes external close callback.

- Selection/confirmation modal flow:
  - `TaskListConfirmModal` and `DeleteConfirmModal` render task tables with row-level checkbox toggling and return filtered selections through Promise-based `open()`.
  - `FailedTasksModal` renders read-only task failure table.
  - `LogoutConfirmModal` and `SyncConfirmModal` provide two-button cancel/confirm decisions.

- Cache modal flow:
  - `CacheSaveModal` builds default filename from vault name + timestamp, appends `.v1` if missing, then calls `cacheService.saveCache`.
  - `CacheRestoreModal` fetches remote cache file list, renders per-file restore/delete actions, supports refresh and inline delete confirmation.
  - `CacheClearModal` collects toggle options and exposes static `clearSelectedCaches` to clear selected KV stores.

- Configuration editing flow:
  - `FilterEditorModal` clones initial filter definitions, supports add/edit/delete and case-sensitivity toggle per entry, then saves all entries via callback.
  - `SelectRemoteBaseDirModal` mounts WebDAV explorer, lists directories using API listing + model conversion, creates directories via WebDAV mkdirs helper, and returns normalized path on confirm.

## Integration Points

- Plugin core integration:
  - Imports `NutstorePlugin` for app context, settings, token, WebDAV service, progress service, and manifest id.
  - Creates and starts `NutstoreSync` from UI triggers.
- Sync/task integration:
  - Uses task class types from `sync/tasks/*` for rendering labels/icons and selection payloads.
  - Uses `getTaskName` utility for user-facing action names.
- Event bus integration:
  - Emits and subscribes to sync events (`emitCancelSync`, `onCancelSync`, `onSyncUpdateMtimeProgress`).
- Storage/service integration:
  - Uses `CacheService` for cache save/restore/delete/list.
  - Uses KV stores (`syncRecordKV`, `blobKV`, `traverseWebDAVKV`) for targeted cache clearing.
- Remote filesystem integration:
  - `SelectRemoteBaseDirModal` integrates `webdav-explorer`, `getDirectoryContents`, `fileStatToStatModel`, `mkdirsWebDAV`, and `stdRemotePath`.
- Obsidian UI integration:
  - Uses `Modal`, `Setting`, `Notice`, ribbon icons, icon rendering, and DOM helpers from Obsidian API.
