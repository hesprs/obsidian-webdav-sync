# src/components/explorer

## Responsibility

In-repo SolidJS explorer module used by sync settings/modals to select a remote base directory. This replaces the previously separate `webdav-explorer` package and now lives under plugin component code.

It provides:

- mountable explorer entrypoint for host DOM nodes,
- navigation over remote paths with folder-first listing,
- inline folder creation in current directory,
- confirm/cancel callbacks to the hosting modal,
- localized labels scoped to explorer UI.

## Design Patterns

- **Mount API boundary** (`index.tsx`): exports `mount(el, props)` so Obsidian modal code can embed explorer without Solid-specific wiring.
- **Injected filesystem adapter** (`AppProps.fs`): explorer never imports WebDAV service directly; host provides `ls` and `mkdirs`.
- **Signal-based navigation state** (`App.tsx`): path stack (`['/']` root seed) models breadcrumb depth; top-of-stack is `cwd`.
- **Factory-owned list controller** (`createFileList()`): returns both render component and imperative `refresh()` trigger for post-create refetch.
- **Error-to-notice conversion**: `ls`/`mkdirs` failures are surfaced through Obsidian `Notice` rather than thrown upward.
- **Path utility normalization**: folder creation uses `joinRemotePath()` to compose valid remote paths.

## Data & Control Flow

1. **Embedding path**
   - Host modal calls `mount(containerEl, { fs, onConfirm, onClose })`.
   - Explorer renders `App` and owns local navigation state.

2. **Directory listing path**
   - `FileList` requests `props.fs.ls(cwd)`.
   - Entries are sorted with directories first, then `basename.localeCompare(..., ['zh'])`.
   - Rows render as `Folder` (interactive) or `File` (display-only).

3. **Navigation path**
   - Folder click pushes `path` into `stack`.
   - Go Back pops one level (root-protected).
   - `cwd` change drives list refresh.

4. **New folder path**
   - “New Folder” toggles inline `NewFolder` editor.
   - Confirm computes `target = joinRemotePath(cwd, name)` and calls `fs.mkdirs(target)`.
   - On success: hide editor + call `list.refresh()`.

5. **Selection completion path**
   - Confirm emits current `cwd` to host via `onConfirm`.
   - Cancel delegates to host `onClose`.

## Integration Points

- **Upstream host (`SelectRemoteBaseDirModal`)**: provides concrete `ls`/`mkdirs` implementations and consumes selected path.
- **Explorer subcomponents (`./components`)**: `FileList`, `Folder`, `File`, `NewFolder` implement rendering and input primitives.
- **Explorer i18n (`./i18n`)**: `t()` translator and local dictionaries provide explorer-scoped strings.
- **Shared style pipeline**: imports `~/assets/global.css` to enable UnoCSS utility classes/icons.
- **Obsidian runtime**: `Notice` is used for user-visible operational errors.
