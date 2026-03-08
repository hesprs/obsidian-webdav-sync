# src/components

## Responsibility

Provide interactive Obsidian UI components for manual sync operations and sync-adjacent maintenance tasks. This folder owns ribbon controls and modal dialogs that let users:

- start/stop sync and optionally confirm before starting,
- monitor live sync/cache-update progress and cancellation state,
- review/select task lists before execution,
- inspect failed tasks,
- edit include/exclude glob filters,
- choose/create a remote base directory,
- save/restore/delete remote cache snapshots and clear local cache stores,
- view/copy large text payloads.

## Design Patterns

- **Obsidian modal lifecycle**: nearly all components extend `Modal` and build UI in `onOpen`, then clear DOM in `onClose`.
- **Callback-driven handoff**: modals emit results via callbacks (`onConfirm`, `onSave`, `onSuccess`) or Promise-based `open()` wrappers (`TaskListConfirmModal`, `DeleteConfirmModal`) rather than executing broader orchestration directly.
- **Optimistic local UI state**: transient state is held in class fields (`selectedTasks`, `confirmed`, `filters`, cache-clear toggles) and applied immediately to UI interactions.
- **Two-step destructive confirmation**: delete/clear actions use click-to-arm + blur-to-reset confirmation patterns to reduce accidental destructive operations.
- **Event subscription pattern for long-running flows**: `SyncProgressModal` subscribes to sync cancellation and cache-mtime update streams, updates UI incrementally, and unsubscribes on close.
- **Task-type polymorphism for presentation**: progress rows choose icons and labels by checking concrete sync task classes and `getTaskName()`.
- **i18n-first rendering**: all visible labels/messages are sourced through translation keys.

## Data & Control Flow

1. **Ribbon trigger path** (`SyncRibbonManager`):
   - Start ribbon click checks `plugin.isSyncing` and account configuration.
   - If configuration is missing, it raises a notice and attempts to open the plugin settings tab.
   - If sync is allowed, it builds a `SyncEngine` with WebDAV client, vault, token, and remote base dir, then starts manual sync.
   - If `confirmBeforeSync` is enabled, execution is gated by `SyncConfirmModal`; otherwise sync starts immediately.
   - Stop ribbon emits global cancel event.

2. **Progress visualization path** (`SyncProgressModal`):
   - Reads progress from `plugin.progressService.syncProgress`.
   - Calculates percent/statistics, updates progress bars/text, and renders reversed completed-task history.
   - Maps completed task types to icons; displays current status for active/completed/cancelled states.
   - Receives cache-update progress events and updates a dedicated secondary progress section.
   - On close, unsubscribes from all subscriptions and invokes optional close callback.

3. **User selection/confirmation path**:
   - `TaskListConfirmModal` and `DeleteConfirmModal` render checkbox tables with row-click toggling.
   - Their async `open()` methods resolve structured selections after close (`confirm + selected tasks`, or `tasksToDelete/tasksToReupload`).
   - `FailedTasksModal` provides read-only inspection of task name/path/error rows.

4. **Filter editing path** (`FilterEditorModal`):
   - Clones incoming filter rules to avoid mutating caller state.
   - Supports add/remove/edit of glob expressions and case-sensitivity toggling (`getUserOptions`).
   - Saves edited rules through callback only when user confirms.

5. **Cache management path**:
   - `CacheSaveModal` composes default snapshot filename, normalizes `.v1` suffix, and delegates save to `CacheService`.
   - `CacheRestoreModal` loads remote cache file list via `CacheService`, supports restore/delete per file, refreshes list, and renders empty/error states.
   - `CacheClearModal` collects toggles for KV stores and exposes static `clearSelectedCaches()` to clear `syncRecordKV`, `blobKV`, and `traverseWebDAVKV`.

6. **Remote directory selection path** (`SelectRemoteBaseDirModal`):
   - Mounts `webdav-explorer` with custom `ls`/`mkdirs` adapters.
   - `ls` fetches directory contents via API + token and maps stats to explorer models.
   - Confirmation normalizes the selected path and returns it through callback.

## Integration Points

- **Plugin core (`WebDAVSyncPlugin`)**: provides app context, settings, sync flags, token retrieval, progress service, remote base dir, and WebDAV service client creation.
- **Sync engine & tasks**: `SyncEngine` / `SyncStartMode` start orchestration; task classes from `sync/tasks/*` drive progress classification and task-table rendering.
- **Event bus**: `emitCancelSync`, `onCancelSync`, and `onSyncUpdateMtimeProgress` connect UI controls with runtime sync state changes.
- **Storage/cache services**: `CacheService` handles remote cache snapshot lifecycle; KV stores (`syncRecordKV`, `blobKV`, `traverseWebDAVKV`) are cleared via cache-clear flow.
- **Remote filesystem helpers**: directory listing (`getDirectoryContents`), stat conversion (`fileStatToStatModel`), recursive mkdir (`mkdirsWebDAV`), and path normalization (`stdRemotePath`).
- **Obsidian UI/runtime APIs**: `Modal`, `Setting`, `Notice`, ribbon icons, and icon rendering (`setIcon`) underpin all component UX.
- **Localization layer**: all user-facing strings route through `i18n.t(...)` keys shared with the broader plugin.
