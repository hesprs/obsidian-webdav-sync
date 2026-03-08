# packages

## Responsibility

Top-level workspace for reusable packages consumed by the main plugin.

## Package Topology

- `webdav-explorer/`: standalone UI/library package for WebDAV file exploration features.

## Architecture Conventions

- Each package is self-contained under `packages/<name>/`.
- Package internals are documented in a local `codemap.md` inside each package.
- Cross-package usage happens through each package's published/exported API surface.

## Package Sub-Maps

- [`webdav-explorer/codemap.md`](./webdav-explorer/codemap.md)
