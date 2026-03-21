# src/storage

## Responsibility

Provide sync-state persistence as an explicit storage boundary for the plugin. This directory defines the pluggable store contract (`SyncStateStore`), provides the default IndexedDB-backed implementation (`IndexedDbSyncStateStore`), and exposes `SyncRecord` as the namespace-scoped state facade used by sync/traversal runtime flows.

## Design Patterns

- **Interface-first storage boundary**: `SyncStateStore` (`initialize`, split remote/local read-write, namespace delete) decouples storage consumers from backend details.
- **Adapter implementation with readiness/error guards**: `IndexedDbSyncStateStore` wraps localspace IndexedDB with one-time initialization, operation wrapper (`run`), and centralized logging for unavailable storage / operation failures.
- **DAO/facade over split persistence**: `SyncRecord` composes `getRemote/getLocal` and `setRemote/setLocal` into unified `SyncStateModel` operations and higher-level mutation APIs.
- **Normalization boundary**: persisted local records are stored as `Record<string, LocalRecordModel>` and normalized to runtime `Map`; remote state is normalized from partial payloads to a complete `RemoteRecordModel` shape.
- **Path-canonical mutation model**: all remote/local updates normalize vault/remote paths before upsert/remove/subtree deletion, preventing key drift and duplicate logical entries.

## Data & Control Flow

1. Plugin composition creates a single `IndexedDbSyncStateStore`, initializes it, and passes it to storage consumers.
2. Runtime callers create `SyncRecord(namespace, remoteBaseDir, store)` for a specific sync namespace.
3. `SyncRecord.loadState()` reads remote and local slices in parallel, then normalizes into `SyncStateModel` (`version`, `remoteRecord`, `localRecords: Map`).
4. Read APIs return full state (`getState`) or projections (`getRemoteRecord`, `getRemoteStats`, `getLocalRecords`).
5. Mutation APIs (`mutateState` and specialized helpers for synced files/dirs, subtree cleanup, orphan cleanup) modify in-memory normalized state, then persist split slices (`setRemote` + `setLocal`).
6. Remote-only operations (`setRemoteRecord`, `clearRemoteRecord`) and namespace drop (`drop` -> `store.delete`) bypass full-state persistence when appropriate.

## Integration Points

- **Composition root** (`src/index.ts`): owns store lifecycle (`new IndexedDbSyncStateStore()`, `initialize()`).
- **Sync orchestration** (`src/sync/index.ts`): instantiates `SyncRecord` with state key and remote base directory; uses it for record reads/mutations during task execution.
- **Remote traversal stack** (`src/utils/traverse-webdav.ts`, `src/fs/webdav.ts`): consumes `SyncStateStore` for resumable/stored remote snapshots.
- **Model + path utilities**: depends on `src/model/sync-record.model.ts` and path normalization helpers (`~/platform/path/*`, `normalizeRemoteWalkPath`) to keep persisted/derived paths canonical.

## Key Files

- `index.ts`: barrel exports for `SyncRecord`, store interface types, and store implementation.
- `store.interface.ts`: `SyncStateStore` contract plus `PersistedLocalRecordsModel` persisted local-state shape.
- `store.ts`: `IndexedDbSyncStateStore` localspace IndexedDB adapter with per-namespace meta/remote/local keys and guarded operations.
- `sync-record.ts`: namespace-scoped sync-state facade with normalization, projection, and path-aware remote/local mutation helpers.
