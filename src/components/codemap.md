# src/components/

## Responsibility

UI-only composition for the plugin: modal dialogs, the remote-path explorer, the task file-tree selector, the sync ribbon controls, and small render helpers.
It owns user interaction state, but not sync logic, storage, or WebDAV transport.

## Design

- Stateless entry points with plugin/app references injected at construction time.
- Modal subclasses are one-shot surfaces that render, collect input, then close and clear DOM state.
- `explorer/` is a SolidJS remote directory picker backed by abstract `fs.ls` / `fs.mkdirs` callbacks.
- `fileTree/` is a SolidJS task tree built from `BaseTask[]`; `FileTreeSelectionController` enforces parent/child selection rules and exposes snapshots.
- `SyncRibbonManager` owns the start/stop ribbon icons and toggles visual state from `plugin.isSyncing`.

## Flow

- `SelectRemoteBaseDirModal` mounts the explorer with a WebDAV adapter, normalizes the confirmed remote path, and returns it to the caller.
- `DeleteConfirmModal`, `SyncProgressModal`, and the sync confirmation path mount the file tree to let users choose which tasks stay selected.
- `SyncProgressModal` switches between walking, confirmation, syncing, terminal, and idle stages, reusing the file tree for manual confirmation and `render-failed-tasks` for failures.
- `FilterEditorModal` and `EncryptionReminderModal` are simple settings dialogs that edit in-memory state and commit on save/acknowledge.
- `render-failed-tasks` formats failed task rows with task icon, local path, and error text.

## Integration

- `src/index.ts` instantiates `SyncRibbonManager` as part of plugin setup and keeps it in sync through `toggleSyncUI(isSyncing)`, which flips the ribbon between refresh and stop controls.
- The plugin lifecycle also provides the `app`/plugin context that the modals need for Obsidian APIs, settings access, and WebDAV client creation.
- Higher-level services and settings screens consume these components directly; this folder is the UI boundary between those callers and the sync/task layers.
