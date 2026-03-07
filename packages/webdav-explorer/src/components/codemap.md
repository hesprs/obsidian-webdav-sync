## Responsibility
This directory contains all presentational and interaction components used by the explorer UI: listing entries, rendering folder/file rows, and collecting a new-folder name. It is the UI layer between `App.tsx` state orchestration and the injected filesystem operations.

## Design Patterns
- Functional SolidJS components with typed props (`File`, `Folder`, `NewFolder`).
- Factory pattern in `createFileList()`:
  - Returns `refresh()` as an external trigger.
  - Returns an inner `FileList` component that owns list state.
- Dependency injection via props:
  - `FileList` receives `fs` and `path` instead of importing a concrete backend.
  - `Folder`/`NewFolder` emit events through callbacks.
- Reactive state and effects:
  - Signals for list versioning and item storage.
  - Signal for controlled input value in `NewFolder`.
  - Effect-based refresh in `FileList`.
- Stateless leaf rendering:
  - `File` is display-only and intentionally non-interactive.
  - `Folder` is clickable and delegates navigation intent upward.

## Data & Control Flow
- `App.tsx` calls `createFileList()` and renders `<list.FileList fs={props.fs} path={cwd()} .../>`.
- Inside `FileList`:
  - `refresh()` calls `props.fs.ls(props.path)` and stores results in `items`.
  - `sortedItems()` orders entries with directories first, then locale-aware name sort (`localeCompare(..., ['zh'])`).
  - Render loop maps each entry:
    - `isDir === true` -> `Folder` with click callback.
    - `isDir === false` -> `File` visual row.
- External refresh path:
  - Parent invokes `list.refresh()` after folder creation.
  - Version signal change retriggers list effect and fetch cycle.
- `NewFolder` flow:
  - User input updates `name` signal.
  - Confirm button calls `onConfirm(name())`.
  - Cancel button calls `onCancel()`.
- Error path:
  - `fs.ls` failures are surfaced with Obsidian `Notice`.

## Integration Points
- `FileList.tsx` imports `type fs` from `../App`, binding component contract to app-level filesystem abstraction.
- `NewFolder.tsx` imports `t` from `../i18n` to localize button labels.
- `FileList.tsx` imports `Notice` from `obsidian` for runtime error display.
- Styling and icons rely on utility classes configured in UnoCSS (`i-custom:folder`, `i-custom:file`, `scrollbar-hide`, layout utility classes).
- Components are consumed by `src/App.tsx`, which provides navigation and folder-creation orchestration.
