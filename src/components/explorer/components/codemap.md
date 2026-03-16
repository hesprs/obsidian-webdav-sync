# src/components/explorer/components

## Responsibility

Provide explorer-internal view primitives and list controller logic:

- render remote entry list (`FileList`),
- render clickable directory rows (`Folder`),
- render non-selectable file rows (`File`),
- collect inline new-folder input (`NewFolder`).

## Design Patterns

- **Functional Solid components + typed props** for all leaves.
- **Factory controller pattern** in `createFileList()` exposing:
  - `FileList` render component,
  - imperative `refresh()` trigger managed by version signal.
- **Dependency injection over concrete IO**: `FileList` consumes `fs` from parent props and never imports WebDAV/network code.
- **Reactive rendering**:
  - `items` signal stores latest listing,
  - sorted projection enforces directory-first ordering,
  - version signal controls explicit refetch cycles.
- **Intent delegation**: `Folder` and `NewFolder` only emit callbacks; parent decides navigation and mkdir behavior.

## Data & Control Flow

1. `App` constructs `const list = createFileList()` and renders `<list.FileList path={cwd()} fs={...} onClick={...} />`.
2. `FileList` calls `props.fs.ls(props.path)` in `refresh()` and stores the result.
3. `sortedItems()` orders by:
   - directories before files,
   - then `basename.localeCompare(..., ['zh'])` within same type.
4. Render loop:
   - `isDir` => `Folder` row with upward click callback,
   - otherwise => dimmed `File` row.
5. Parent-triggered refetch:
   - `list.refresh()` increments internal `version`,
   - effect observes version and performs next fetch cycle.
6. `NewFolder` maintains local `name` signal and emits confirm/cancel actions.

## Integration Points

- `FileList.tsx` imports `type fs` from `../App` (shared filesystem contract).
- `NewFolder.tsx` uses explorer-local translator `t` from `../i18n`.
- `FileList.tsx` depends on Obsidian `Notice` for error surfacing.
- Utility-class styling/icons (`i-custom:*`, layout classes) rely on project UnoCSS configuration.
