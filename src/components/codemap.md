# src/components

## Responsibility

Own Obsidian-facing sync UI controls and modals. This folder now focuses on sync execution UX and remote-directory selection:

- start/stop manual sync from ribbon (`SyncRibbonManager`),
- optionally gate manual sync with a confirmation modal (`SyncConfirmModal`),
- render live sync + sync-state-update progress (`SyncProgressModal`),
- let users inspect/confirm task subsets before execution (`TaskListConfirmModal`, `DeleteConfirmModal`),
- display failed task diagnostics (`FailedTasksModal`),
- edit include/exclude glob rules (`FilterEditorModal`),
- choose/create remote base directory via embedded explorer (`SelectRemoteBaseDirModal`),
- show/copy long text payloads (`TextAreaModal`).

Historical cache snapshot/clear modals are no longer in this directory.

## Design Patterns

- **Modal lifecycle discipline**: components extending `Modal` construct DOM in `onOpen()` and always clear `contentEl` on close.
- **UI-orchestration boundary**: components collect user intent and emit via callbacks/promises; they do not own sync planning/execution logic.
- **Promise-returning modal APIs**: selection dialogs (`TaskListConfirmModal`, `DeleteConfirmModal`) expose `open(): Promise<...>` and resolve structured decisions after close.
- **Local ephemeral state**: checkbox selections, confirmation flags, and edited filters are held in in-memory class fields until explicit confirm.
- **Event-driven progress UI**: `SyncProgressModal` subscribes to global sync events (`cancel`, `sync update mtime progress`) and unsubscribes deterministically.
- **Task-type-driven rendering**: completed-task rows infer icon/type labels from concrete task classes plus `getTaskName()`.
- **Embedded micro-frontend mount**: `SelectRemoteBaseDirModal` mounts `src/components/explorer` into a DOM node and injects a filesystem adapter.

## Data & Control Flow

1. **Ribbon -> scheduler path**
   - Start icon validates `plugin.isSyncing` and account readiness.
   - If account config is missing, it opens plugin settings and exits.
   - If enabled, `confirmBeforeSync` gates execution with `SyncConfirmModal`; otherwise it directly calls `syncSchedulerService.requestManualSync()`.
   - Stop icon emits `emitCancelSync()`.

2. **Sync progress rendering path**
   - `SyncProgressModal` reads `plugin.progressService.syncProgress` and `syncEnd`.
   - It renders progress %, completed/total counters, current file/status, and reverse-ordered completed history.
   - It separately renders sync-state update progress from `onSyncUpdateMtimeProgress()` events.

3. **Task selection/triage path**
   - `TaskListConfirmModal` returns `{ confirm, tasks }` subset for generic planned tasks.
   - `DeleteConfirmModal` splits remove-local tasks into `{ tasksToDelete, tasksToReupload }`.
   - `FailedTasksModal` is read-only inspection of failed task metadata.

4. **Filter editing path**
   - `FilterEditorModal` deep-clones incoming rules.
   - Users edit glob expression and case-sensitive option per rule.
   - Save emits updated filter list via callback.

5. **Remote base directory selection path**
   - `SelectRemoteBaseDirModal` mounts explorer with injected `fs.ls` and `fs.mkdirs` backed by plugin WebDAV APIs.
   - On confirm, selected path is normalized by `normalizeRemoteDir()` and returned.

## Integration Points

- **Plugin runtime (`WebDAVSyncPlugin`)**: ribbon APIs, app instance, settings, token access, WebDAV client creation, sync scheduler/progress services.
- **Event bus (`src/events`)**: cancel signal emission/subscription and mtime-update progress stream.
- **Sync task model (`src/sync/tasks/*`)**: task class identity drives UI labeling/icons and selection semantics.
- **Remote API/path utilities**: `getDirectoryContents`, `fileStatToStatModel`, `mkdirsWebDAV`, `normalizeRemoteDir` bridge explorer actions to WebDAV.
- **Explorer UI module (`src/components/explorer`)**: mounted as an internal component package replacement.
- **Obsidian APIs**: `Modal`, `Setting`, `Notice`, ribbon icon controls, `setIcon`.
- **Localization (`~/i18n`)**: all user-visible strings use translation keys.
