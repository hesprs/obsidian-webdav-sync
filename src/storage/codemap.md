# src/storage/

This directory manages local persistence for the Obsidian Sync plugin, providing an abstraction layer over IndexedDB (via localforage) for various data types.

## Responsibility

- **Persistence Abstraction**: Provides a unified `useStorage` interface to wrap storage backends, offering standard CRUD operations plus `dump` and `restore` capabilities.
- **Content-Addressable Blob Storage**: Manages file contents in `blob.ts`, using SHA-256 hashes as keys to ensure deduplication and data integrity.
- **Sync State Tracking**: Maintains synchronization metadata for files via the `SyncRecord` class, allowing the plugin to track local vs. remote changes.
- **Performance Optimization**: Caches remote WebDAV directory structures (`traverseWebDAVKV`) to minimize redundant network calls.

## Design Patterns

- **Adapter Pattern**: `useStorage.ts` adapts the `localforage` API (or any `StorageInterface`) into a simplified, consistent interface used throughout the app.
- **Data Access Object (DAO)**: `SyncRecord` and `useBlobStore` provide high-level, domain-specific methods for interacting with the underlying key-value stores.
- **Singleton Instances**: `kv.ts` defines and exports shared storage instances (`syncRecordKV`, `blobKV`, `traverseWebDAVKV`) to ensure consistent access across the plugin.
- **Content-Addressable Storage**: The blob store implements a pattern where the key is derived from the content (SHA-256), facilitating efficient storage and verification.

## Flow

### Data Flow

1. **Storage**: Data (Blobs or SyncRecords) is passed to specialized stores (`blobStore` or `SyncRecord` instance).
2. **Abstraction**: The stores call `useStorage` methods (`set`, `get`).
3. **Persistence**: `useStorage` interacts with `localforage` instances, which write to/read from the browser's IndexedDB.

### Control Flow

- **Read-Modify-Write**: `SyncRecord` methods like `updateFileRecord` handle the logic of fetching a Map from storage, updating it, and persisting it back.
- **Backup/Restore**: `useStorage` provides `dump` and `restore` functions that can serialize the entire store for debugging or migration purposes.

## Integration Points

- **External Libraries**:
  - `localforage`: Used as the underlying storage engine for IndexedDB.
- **Internal Modules**:
  - `~/model/*`: Uses `StatModel` and `SyncRecordModel` for type definitions.
  - `~/utils/sha256`: Used by `blob.ts` to generate unique keys for file contents.
- **Consumers**:
  - The Sync Engine (likely in `src/sync/`) consumes `SyncRecord` and `blobStore` to coordinate file synchronization.
