# packages/webdav-explorer

## Responsibility

Embeddable SolidJS directory picker UI that lists folders/files, allows creating folders, and returns a selected path through host callbacks.

## Design Patterns

- Single public mount API (`src/index.tsx`) wrapping internal component tree.
- Dependency injection for filesystem access via `fs` interface (`ls`, `mkdirs`) in `AppProps`.
- Reactive state via Solid signals/effects for navigation stack, refresh triggering, and modal visibility.
- View decomposition into focused components (`FileList`, `Folder`, `File`, `NewFolder`).
- Lightweight i18n layer (`src/i18n`) with locale detection from `navigator.language`.

## Data & Control Flow

- Host calls `mount(el, props)` to render `App` into a DOM node.
- `App` tracks current path with a stack (start at `/`), supports enter/back navigation.
- `createFileList().FileList` fetches `fs.ls(path)`, sorts dirs before files, and renders items.
- `NewFolder` emits folder name; `App` resolves target path and calls `fs.mkdirs(target)`.
- On create/list failures, UI surfaces errors through `obsidian.Notice`.
- Confirm emits current path with `onConfirm`; cancel triggers `onClose`.

## Integration Points

- Public package export: `dist/index.js` + `dist/index.d.ts` (`package.json` exports).
- Host contract (`AppProps`): `fs`, `onConfirm(path)`, `onClose()`.
- Runtime dependencies: `solid-js`, `solid-js/web`, `path-browserify`, and Obsidian `Notice`.
- Build/style toolchain: Rslib (`rslib.config.ts`) + UnoCSS/PostCSS (`unocss.config.ts`, `postcss.config.mjs`).

## Key Files

- `src/index.tsx`: `mount` entrypoint.
- `src/App.tsx`: navigation, actions, host callback wiring.
- `src/components/FileList.tsx`: listing, sorting, refresh behavior.
- `src/components/NewFolder.tsx`: create-folder input/actions.
- `src/i18n/index.ts`: locale resolution and translator setup.
- `rslib.config.ts`: library build output configuration.
