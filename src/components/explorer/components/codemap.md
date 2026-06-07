# src/components/explorer/components/

## Responsibility

Directory-level Solid UI primitives for the WebDAV explorer: render the current folder contents, represent individual entries, and provide the inline new-folder editor.

## Design

- `FileList` is the only stateful composition root in this folder. `createFileList()` closes over a `version` signal to trigger refreshes without remounting.
- `FileList` normalizes server data into a sorted view: directories first, then locale-aware basename ordering.
- `Folder` and `File` are presentational row components with no local state.
- `NewFolder` is a controlled input row with local `name` signal and confirm/cancel actions.

## Flow

- `App.tsx` creates one `FileList` instance and passes `fs`, `path`, and `onClick` into `<list.FileList />`.
- `FileList` calls `fs.ls(path)` on initial render and when `refresh()` increments `version`.
- Each entry is rendered as `Folder` when `isDir` is true, otherwise `File`.
- `Folder` forwards its `path` through `onClick`; `App` consumes that callback to push the directory onto the navigation stack.
- `NewFolder` is mounted by `App` when the create-folder affordance is active; its `onConfirm` callback feeds `App.createFolder()`, which calls `fs.mkdirs()` and then `list.refresh()`.

## Integration

- Consumed by `src/components/explorer/App.tsx` for directory navigation and folder creation.
- Depends on the explorer filesystem contract (`fs.ls`, `fs.mkdirs`) and Obsidian `Notice` for async error reporting.
- Uses `solid-js` control flow (`For`, `Show`, signals, effects) and the shared i18n helper from `~/i18n`.
