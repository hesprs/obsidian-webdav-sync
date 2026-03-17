# src/storage

## Responsibility

Provide the sync-state persistence boundary for the plugin. This directory no longer persists via plugin settings; it defines and consumes a dedicated store abstraction (`SyncStateStore`) and exposes `SyncRecord` as the runtime-facing DAO/facade for sync state.

## Design Patterns

- **Storage abstraction boundary (`SyncStateStore`)**: interface-first contract for lifecycle and CRUD split by state slice (`initialize`, `get/set/clearRemote`, `get/setLocal`, `delete`).
- **Default adapter implementation (`IndexedDbSyncStateStore`)**: localspace-backed IndexedDB adapter with readiness gating (`initialize`/`ensureReady`) and guarded execution (`run`) that logs failures and surfaces storage-unavailable errors.
- **DAO/facade (`SyncRecord`)**: namespace-scoped state API that coordinates remote and local persistence independently while presenting unified `SyncStateModel` operations to sync runtime callers.
- **Normalization boundary**: persisted local records (`Record<string, LocalRecordModel>`) are normalized to runtime `Map`; partial/legacy remote payloads are normalized into a complete `RemoteRecordModel` shape.
- **Path-aware mutation helpers**: remote/local upsert/remove/subtree operations canonicalize paths before mutating in-memory state.

## Data & Control Flow

1. Composition root creates a `SyncStateStore` (typically `IndexedDbSyncStateStore`) and injects it into `SyncRecord(namespace, remoteBaseDir, store)`.
2. Store initialization is explicit (`initialize()`), then each operation is executed through adapter guards (`ensureReady` + `run`).
3. `SyncRecord.loadState()` reads remote and local slices independently (`getRemote` + `getLocal`) and normalizes to runtime `SyncStateModel` (`{ version, remoteRecord, localRecords: Map }`).
4. Reads return full state or projections (`getState`, `getRemoteRecord`, `getRemoteStats`, `getLocalRecords`).
5. Writes are split by concern:
   - full-state write: `setRemote` + `setLocal`
   - remote-only write/clear: `setRemoteRecord` / `clearRemoteRecord`
   - delete namespace: `delete`
6. Mutation flows use path-aware helpers (`upsert/remove remote`, `upsert/remove local`, subtree removals) then persist via split remote/local writes.

## Integration Points

- **Model contracts**: `SyncStateModel` (`version`, `remoteRecord`, `localRecords`) and related record models from `src/model/sync-record.model.ts`.
- **Sync runtime consumers**: sync orchestration/task flows depend on `SyncRecord` for state reads, mutation staging, and persistence.
- **Path/platform utilities**: remote/vault normalization and remote-walk normalization are used to keep stored keys and stat paths canonical.
- **Decoupling note**: plugin settings singleton coupling was removed from this directory; storage no longer depends on `plugin.settings.syncStates` or `plugin.saveSettings()`.

## Key Files

- `index.ts`: barrel exports (`indexeddb-sync-state-store`, `sync-record`, `sync-state-store`).
- `sync-state-store.ts`: `SyncStateStore` contract and `PersistedLocalRecordsModel` persisted shape.
- `indexeddb-sync-state-store.ts`: IndexedDB/localspace store adapter with per-namespace meta/remote/local keys and guarded operations.
- `sync-record.ts`: namespace-scoped DAO/facade that normalizes state, performs path-aware mutation, and persists remote/local slices independently.
