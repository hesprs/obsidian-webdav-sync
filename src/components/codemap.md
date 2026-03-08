# src/components

## Responsibility

Provide user-facing sync UI components (ribbon control + modal dialogs) for confirmation, progress visibility, task review, cache operations, and advanced setting interactions.

## Design Patterns

- Obsidian `Modal` lifecycle pattern (`onOpen`/`onClose`) for isolated dialog rendering and cleanup.
- Callback-first UI pattern (`onConfirm`, `onSave`, `onSuccess`) to keep business logic in services/plugin core.
- Event-driven progress updates in `SyncProgressModal` via sync/cancel/cache event subscriptions.
- Local mutable view-state for checkbox selections, toggle confirmations, and staged form edits.
- i18n boundary pattern: display text resolves through translation keys instead of hardcoded labels.

## Data & Control Flow

1. `SyncRibbonManager` handles manual sync start/stop from the ribbon and gates execution on account/config state.
2. Sync progress events update `SyncProgressModal`, which maps task types to status rows and iconized actions.
3. Selection modals (`TaskListConfirmModal`, `DeleteConfirmModal`) return filtered user choices through async `open()` flows.
4. Cache dialogs (`CacheSaveModal`, `CacheRestoreModal`, `CacheClearModal`) route save/restore/delete/clear actions to cache and KV services.
5. Configuration helper modals (`FilterEditorModal`, `SelectRemoteBaseDirModal`) collect structured input and return normalized values to settings pages.

## Integration Points

- Plugin runtime: `WebDAVSyncPlugin` state (`settings`, `isSyncing`, services) and `SyncEngine` startup hooks.
- Sync domain: task classes/utilities from `sync/tasks/*` and sync event emitters/listeners.
- Storage/cache: `CacheService` plus KV stores (`syncRecordKV`, `blobKV`, `traverseWebDAVKV`).
- Remote FS: WebDAV explorer/listing/mkdir helpers and remote-path normalization utilities.
- Obsidian UI API: `Modal`, `Setting`, `Notice`, ribbon icon state updates.

## Key Files

- `SyncRibbonManager.ts` — ribbon icon state, manual sync trigger/cancel orchestration.
- `SyncProgressModal.ts` — live progress rendering, completed-task classification, cancel wiring.
- `SyncConfirmModal.ts` — pre-sync confirmation UX.
- `TaskListConfirmModal.ts` — selectable task list confirmation.
- `DeleteConfirmModal.ts` — targeted delete confirmation table.
- `FailedTasksModal.ts` — failure inspection view.
- `CacheSaveModal.ts` — cache snapshot naming and save action.
- `CacheRestoreModal.ts` — remote cache list, restore/delete actions.
- `CacheClearModal.ts` — local cache clearing option matrix.
- `FilterEditorModal.ts` — include/exclude rule editor modal.
- `SelectRemoteBaseDirModal.ts` — remote directory picker/creator.
- `TextAreaModal.ts` — generic multiline text input modal.
