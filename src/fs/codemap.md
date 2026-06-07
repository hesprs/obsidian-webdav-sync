# src/fs/

## Responsibility

Filesystem boundary for the sync engine. It hides whether data comes from Obsidian's vault adapter or from WebDAV, and normalizes both sides into shared `StatModel`/`StatsMap` shapes.

## Design

- Adapter pattern: `vault/` wraps Obsidian `Vault.adapter`, `webdav/` wraps WebDAV client + DAV XML parsing.
- Shared contract: `fs.interface.ts` only exposes traversal progress callbacks.
- Traversal is split from filtering: raw tree walk first, then `post-traversal.ts` applies include/exclude and size rules and restores missing parent folders.
- WebDAV traversal supports breadth-first walking, optional exhaustive remote listing, retry backoff, cancellation hooks, and encrypted-path normalization.

## Flow

1. `traverseVault()` walks local folders via `adapter.list()` and `adapter.stat()`.
2. `traverseWebDAV()` walks remote folders via `PROPFIND`, converts DAV items to stats, decrypts remote paths when needed, and reports progress.
3. Both traversals emit `StatsMap` keyed by vault-relative paths.
4. `postTraversal()` filters the map and re-adds any parent directories needed to keep the tree connected.

## Integration

- `src/sync/decision/two-way.decider.ts` consumes `traverseVault()` and `traverseWebDAV()` to build sync decisions.
- Sync tasks use the helper layer directly: `vault/utils.ts` and `webdav/utils.ts` provide `getContent()`, `statItem()`, `trashFile()`, `mkdirsWebDAV()`, and temp-path helpers.
- UI flows such as `SelectRemoteBaseDirModal` use `webdav/api.ts` for directory listing and `webdav/utils.ts` for remote folder creation.
