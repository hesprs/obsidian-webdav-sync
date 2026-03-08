## Responsibility

This directory is the workspace package boundary for distributable modules. It currently contains a single package, `webdav-explorer`, which provides a compiled SolidJS explorer UI intended to be embedded by the Obsidian plugin host.

## Design Patterns

- Monorepo package segregation: `packages/` isolates reusable module code from top-level plugin code.
- Package-as-library structure in `webdav-explorer`: source under `src/`, compiled artifacts under `dist/`, and public exports defined in `package.json` (`module`, `types`, and `exports`).
- Build configuration separation: Rslib (`rslib.config.ts`) handles library bundling and declaration generation, while UnoCSS/PostCSS config handles style and icon utility generation.
- Entry-point encapsulation: `src/index.tsx` exposes a single `mount(el, props)` API, hiding internal component composition.

## Data & Control Flow

- Host code imports the `webdav-explorer` package entry from `dist/index.js` (via package exports).
- The host calls `mount(el, props)` to render the explorer into a target DOM element.
- `App` receives an injected filesystem adapter (`ls`, `mkdirs`) and callback handlers (`onConfirm`, `onClose`) from the host.
- User actions in the component tree trigger filesystem calls and callback propagation back to the host.
- Build flow runs from `src/**` through Rslib to `dist/` with generated `.js` and `.d.ts` outputs.

## Integration Points

- Package manager/workspace integration through the `packages/` layout and `package.json` metadata.
- Runtime integration with SolidJS (`solid-js`, `solid-js/web`) for rendering and reactive state.
- Host integration contract from `webdav-explorer/src/App.tsx`:
  - `fs.ls(path)` for listing directory entries.
  - `fs.mkdirs(path)` for creating folders.
  - `onConfirm(path)` and `onClose()` for host event handling.
- Obsidian integration via `Notice` usage inside package source to report runtime errors to the user.
