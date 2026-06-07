# src/components/explorer/

## Responsibility

Directory picker UI for WebDAV-backed note storage. It lets the user browse remote folders, create a new folder, and confirm or cancel the selected path.

## Design

- `App.tsx` is the stateful container.
- `FileList.tsx` owns remote listing, sorting, and refresh signaling.
- `Folder.tsx`, `File.tsx`, and `NewFolder.tsx` are presentational row components.
- Path handling is normalized with `normalizeRemotePath` before remote folder creation.

`App` composes a single list view plus optional new-folder input, then renders the current path and action bar below it.

## Flow

1. `index.tsx` mounts `App` into a DOM element with the caller-provided `fs`, `onConfirm`, and `onClose` handlers.
2. `App` tracks a folder stack and derives the current working directory from the last entry.
3. `FileList` calls `fs.ls(path)` on first render and whenever its internal refresh signal changes.
4. Clicking a folder row bubbles up through `FileList.onClick` to `App.enter`, which pushes the path onto the stack.
5. Back button pops the stack; confirm button sends the current path to `onConfirm`; cancel button calls `onClose`.
6. New-folder flow toggles `NewFolder`, then `App.createFolder` calls `fs.mkdirs`, hides the editor, and triggers a list refresh.

Errors from remote operations are surfaced as Obsidian notices.

## Integration

- Exports from this directory:
  - `index.tsx` default export: `mount(el, props)`
  - `App.tsx` default export: `App`
  - `App.tsx` types: `fs`, `AppProps`
  - `FileList.tsx` exports: `FileStat`, `FileListProps`, `createFileList`
- Depends on SolidJS for rendering/state and Obsidian `Notice` for user-facing errors.
- Uses the shared i18n helper for button labels and `~/platform/path` for remote path normalization.
- Consumes a minimal `fs` contract from the parent: `ls(path)` and `mkdirs(path)`.
