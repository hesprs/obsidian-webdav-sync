# src/storage

## Responsibility

Provide persistent key-value storage primitives and domain stores for sync records, blob content, and WebDAV traversal cache.

## Design Patterns

- Storage adapter wrapper (`useStorage`) over a generic async key-value interface.
- Shared singleton KV instances (`kv.ts`) for consistent store access.
- DAO-style domain layer (`SyncRecord`, `blobStore`) on top of raw KV operations.
- Content-addressable blob storage using SHA-256 hash keys.

## Data & Control Flow

1. `kv.ts` creates `localforage` instances (`syncRecordKV`, `blobKV`, `traverseWebDAVKV`).
2. `useStorage` standardizes operations: `set/get/unset/clear/dump/restore`.
3. `SyncRecord` performs read-modify-write updates on namespaced maps of sync metadata.
4. `blobStore.store` hashes bytes, stores blob by hash key, and returns `{ key, value }`.
5. Sync/traversal logic consumes these stores to persist state across runs.

## Integration Points

- External: `localforage` (IndexedDB-backed persistence).
- Internal models/types: `StatModel`, `SyncRecordModel`.
- Internal utilities: `sha256Base64` for blob key derivation.
- Consumed by sync orchestration and WebDAV traversal persistence logic.

## Key Files

- `index.ts`: storage barrel export.
- `kv.ts`: initializes named storage instances and cache types.
- `use-storage.ts`: generic storage adapter with dump/restore utilities.
- `sync-record.ts`: namespaced sync-record DAO.
- `blob.ts`: content-addressable blob store API.
