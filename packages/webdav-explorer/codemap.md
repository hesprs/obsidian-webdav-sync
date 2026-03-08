# packages/webdav-explorer

## Responsibility

Provide an embeddable SolidJS folder picker for WebDAV-backed flows: browse directories, create a folder in the current location, and return the selected path to a host application.

## Package Structure (current)

- `src/` — source code for runtime UI and public mount API.
  - `src/index.tsx` — package entrypoint (`mount(el, props)`) and stylesheet import.
  - `src/App.tsx` — top-level state and actions (navigation stack, create-folder flow, host callbacks).
  - `src/components/` — presentational and list components (`FileList`, `Folder`, `File`, `NewFolder`).
    - See `src/components/codemap.md` for component-level details.
  - `src/i18n/` — locale selection signal + translation adapter used by UI.
- `rslib.config.ts` — build pipeline configuration (ESM lib + declarations).
- `unocss.config.ts` / `postcss.config.mjs` — utility CSS and icon rules consumed by source styles.
- `dist/` — generated build output published by the package.
- `node_modules/` — local dependencies (environment-specific, not source-of-truth).

## Design

- Public API is intentionally narrow: `mount` is the only entry exposed by source.
- Filesystem operations are injected (`fs.ls`, `fs.mkdirs`) via `AppProps`, keeping backend logic outside this package.
- UI behavior is reactive through Solid signals/effects:
  - path stack (`/` root + enter/back)
  - new-folder visibility
  - list refresh trigger
- Component boundaries separate orchestration (`App`) from rendering/interactions (`components/*`).
- Errors from async filesystem actions are surfaced through Obsidian `Notice`.

## Flow

1. Host imports package and calls `mount(element, props)`.
2. `App` initializes current directory stack at `/` and renders list + actions.
3. `FileList` loads `fs.ls(currentPath)`, sorts directories before files, and renders rows.
4. Clicking a folder pushes its path onto the stack; Go Back pops one level.
5. New Folder opens inline input; confirm resolves target path and calls `fs.mkdirs`.
6. On successful folder creation, list refresh is triggered.
7. Confirm returns the current path through `onConfirm`; Cancel calls `onClose`.

## Integration

- **Host contract** (`AppProps` in `src/App.tsx`):
  - `fs.ls(path) => FileStat[] | Promise<FileStat[]>`
  - `fs.mkdirs(path) => void | Promise<void>`
  - `onConfirm(path)` and `onClose()` callbacks
- **Published entrypoints** (`package.json`):
  - `.` -> `dist/index.js` + `dist/index.d.ts`
  - `./css` -> `dist/assets/global.css`
- **Framework/runtime dependencies**: SolidJS rendering and Obsidian `Notice` for user-facing errors.
- **Build/styling toolchain**: Rslib + Solid/Babel plugins, UnoCSS + PostCSS.
