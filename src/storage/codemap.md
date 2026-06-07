# src/storage/

## Responsibility

Owns the plugin’s persistent sync cache in IndexedDB. It stores per-path sync state, cached base text for merge resolution, and temporary file-chunk payloads used during ranged downloads.

## Design

- `store.interface.ts` defines the persistence foundation.
- `BaseStore` wraps `localspace` with a shared database name, store name, lazy `ready()` initialization, error normalization, and bulk removal helpers.
- Keys are namespaced as `storeName:namespace:path`; chunk keys add `size:start:end` so stale chunks can be detected.
- `IndexedDbSyncStateStore` and `IndexedDbBaseTextStore` use the shared base abstraction.
- `IndexedDbFileChunkStore` is separate because it stores binary `ArrayBuffer` data and applies TTL eviction to chunk records.

## Flow

1. Sync execution creates a `SyncRecord` for the active namespace.
2. Planning reads all stored record stats via `getRecords()`; fast remote walks can reconstruct remote state from cached records.
3. Merge and pull tasks read `baseText` and chunk metadata from storage before deciding how to resolve content.
4. Pulling large files writes ranged chunks with `setFileChunk()`, then re-reads the chunk keys, streams chunks in order, and deletes the chunk entries after assembly.
5. Tasks update sync state with `upsertRecords()` after successful local/remote writes, or remove entries/subtrees when files and folders are deleted.

## Integration

- `src/sync/index.ts` creates `SyncRecord` and clears storage when the remote base directory must be recreated.
- `src/sync/decision/two-way.decider.ts` consumes stored records as the sync snapshot.
- `src/sync/tasks/pull.task.ts` and `src/sync/tasks/merge.task.ts` depend on cached base text and file chunks to complete downloads and conflict resolution.
- `src/storage/index.ts` re-exports the storage API for the rest of the app.
