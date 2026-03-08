# WebDAV Explorer `src` Code Map

Scope: `packages/webdav-explorer/src/` only (runtime source). Tests/docs/translation dictionaries are intentionally excluded.

## Responsibility

This folder implements a small SolidJS explorer UI that lets users browse remote WebDAV directories and choose a target path.

Primary responsibilities:

- Render a navigable directory view with folder-first sorting.
- Allow creating a folder in the current directory.
- Return the selected path to host code (`onConfirm`) or close the dialog (`onClose`).
- Keep backend access abstract through an injected `fs` contract (`ls`, `mkdirs`).
- Provide localized labels through a shared `t()` translator.

## Design

### Entry and composition

- `index.tsx`
  - Imports global styles.
  - Exposes `mount(el, props)` that renders `<App {...props} />` into a host element.

- `App.tsx`
  - Owns top-level explorer state and actions.
  - Defines integration contract:
    - `fs.ls(path) => FileStat[] | Promise<FileStat[]>`
    - `fs.mkdirs(path) => void | Promise<void>`
  - Maintains:
    - `stack` (path history), initialized to `['/']`
    - `showNewFolder` (toggle for inline folder-creation row)
  - Derives `cwd` from the top of `stack`.

### List rendering model

- `components/FileList.tsx`
  - Exposes `createFileList()` factory returning:
    - `FileList` component
    - `refresh()` trigger
  - `FileList` keeps `items` signal and computes `sortedItems()`:
    - directories before files
    - same-type items sorted by `basename.localeCompare(..., ['zh'])`
  - Fetches list data via `props.fs.ls(props.path)` and shows Obsidian `Notice` on failure.
  - Re-runs fetch when path/reactive dependencies change and when `refresh()` bumps `version`.

### Leaf UI components

- `components/Folder.tsx`
  - Clickable row with folder icon.
  - Emits selected path via `onClick(path)`.

- `components/File.tsx`
  - Non-interactive file row (dimmed + not-allowed cursor).
  - Used as fallback when an entry is not a directory.

- `components/NewFolder.tsx`
  - Inline input row with local `name` signal.
  - Emits `onConfirm(name)` / `onCancel()`.
  - Uses localized button labels.

- `assets/global.css`
  - Enables UnoCSS generation (`@unocss`).

## Flow (UI + data)

1. Host calls `mount(...)` with `AppProps`.
2. `App` starts at `/`, creates a local file-list instance (`createFileList`).
3. `FileList` fetches entries from `fs.ls(cwd)` and renders:
   - `Folder` rows for directories
   - `File` rows for files
4. User clicks a folder:
   - `Folder` -> `App.enter(path)` -> push onto `stack`
   - `cwd` changes -> list refetches for new directory
5. User clicks “Go Back”:
   - `App.pop()` removes one level (never below root)
   - `cwd` changes -> list refetches
6. User clicks “New Folder”:
   - `showNewFolder = true` displays `NewFolder`
   - Confirm builds `target = path.join(cwd, name)` and calls `fs.mkdirs(target)`
   - on success: hides input + `list.refresh()`
   - on error: shows `Notice(error.message)`
7. User clicks “Confirm” / “Cancel”:
   - confirm sends current path through `onConfirm(cwd)`
   - cancel calls `onClose()`

## Integration details

- **Host/plugin boundary**: `AppProps` is the full integration API for external callers.
- **Backend boundary**: all filesystem operations are delegated to injected `fs`; no direct WebDAV client usage in UI code.
- **Obsidian UI feedback**: operational failures are surfaced with `Notice` in both folder listing and folder creation flows.
- **Localization usage**: UI strings are retrieved via `t(...)` from `src/i18n/index.ts`; locale dictionary files are outside this codemap scope.
