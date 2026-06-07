# src/fs/vault/

Vault-facing filesystem adapters for local Obsidian storage.
This folder wraps `vault.adapter` operations, normalizes vault paths, and exposes traversal and file helpers used by sync tasks.

## Responsibility

- `index.ts` re-exports the utility helpers and the vault traversal entrypoint.
- `traverse.ts` performs a breadth-first walk from `vault.getRoot().path`, listing each directory, stat-ing every file and folder, and storing normalized `StatModel` entries in a `Map`.
- `utils.ts` keeps small adapter helpers: stat conversion, binary reads, trashing, temp download paths, rename finalization, and recursive directory creation.
- File metadata is normalized into `StatModel`: files keep `mtime` and `size`; directories only keep `path` plus `isDir`.

## Design

1. Traversal starts at the vault root and expands folder-by-folder through `vault.adapter.list()`.
2. Each listed path is stat-ed through the adapter, normalized with `normalizeVaultPath()`, converted with `toStatModel()`, and inserted into the result map.
3. After the walk, `postTraversal()` applies inclusion/exclusion rules and large-file limits, then restores any missing parent directories for retained files.
4. Sync tasks call the helpers directly:
   - `getContent()` reads local file contents for upload/merge.
   - `statItem()` refreshes local metadata after writes.
   - `trashFile()` removes local files through the user’s trash preference.
   - `prepareRangedDownloadTempPath()` and `finalizeRangedDownloadTempPath()` manage chunked pull writes.

## Flow

- `sync/decision/two-way.decider.ts` uses `traverseVault()` to build the local snapshot for sync planning.
- `sync/tasks/push.task.ts`, `pull.task.ts`, and `merge.task.ts` consume `getContent()` and `statItem()` to read and verify local state.
- `sync/tasks/remove-local*.task.ts` use `trashFile()` to delete local entries while keeping Obsidian-safe behavior.
- `sync/index.ts` also uses `statItem()` when converting delete operations into re-uploads.

## Integration

- `traverseVault()` feeds the local side of two-way sync decisions.
- `statItem()` is reused anywhere sync needs fresh local metadata after write/delete operations.
- `getContent()` is the local read path for upload and merge tasks.
- `trashFile()` and the temp-path helpers keep local mutations compatible with Obsidian and chunked downloads.
