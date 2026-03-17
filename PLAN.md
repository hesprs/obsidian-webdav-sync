# Plan: move sync records out of `data.json`

## Context

The plugin currently stores sync records inside plugin settings (`data.json`). That state includes the remote traversal queue, remote directory snapshots, local records, file metadata, and `baseText` for mergeable local files.

This turns `data.json` into a large cache blob instead of a small config file. On large vaults, plugin startup must load a huge JSON payload, and every record update rewrites it again. This is the main scalability bottleneck.

Do this refactor to:

- stop loading vault-scale sync state at plugin startup
- stop rewriting vault-scale sync state through `saveSettings()`
- separate user configuration from cache/state
- keep sync behavior while removing the storage bottleneck

## Current implementation

### Settings path

- `src/index.ts`
  - `loadSettings()` loads the whole plugin data via `loadData()`
  - `saveSettings()` writes the whole plugin data via `saveData()`
- `src/settings/index.ts`
  - `PluginSettings` contains `syncStates?: Record<string, PersistedSyncStateModel>`

### State DAO

- `src/storage/sync-record.ts`
  - `SyncRecord` reads and writes `plugin.settings.syncStates`
  - `saveState()` calls `plugin.saveSettings()`
  - `mutateState()` loads, mutates, and saves the full namespace state

### Persisted data shape

- `src/model/sync-record.model.ts`
  - `RemoteRecordModel`
    - `queue: string[]`
    - `nodes: Record<string, StatModel[]>`
    - `isComplete`, `lastNormalSyncAt`, `source`
  - `LocalRecordModel`
    - `local: StatModel`
    - `baseText?: string`
  - `PersistedSyncStateModel`
    - `remoteRecord`
    - `localRecords: Record<string, LocalRecordModel>`

### Hot write paths

- `src/utils/traverse-webdav.ts`
  - BFS traversal writes `queue` and `nodes` repeatedly
- `src/sync/utils/update-records.ts`
  - post-task updates write local and remote records in batches
  - `createBaseText()` stores full text for mergeable files
- `src/sync/decision/two-way.decider.ts`
  - reads `baseText` to detect unchanged local content
- `src/sync/tasks/conflict-resolve.task.ts`
  - uses `baseText` as merge base

## Target implementation

### Core design

Do this:

1. Keep plugin settings for user configuration only.
2. Remove `syncStates` from settings.
3. Store sync state in an IndexedDB/localspace-backed storage layer.
4. Keep `SyncRecord` as the only DAO used by sync code.
5. Split persistence into per-namespace remote/local/meta entries.

Do not do this:

- do not keep any legacy settings-backed sync-state path
- do not keep migration flags or compatibility branches
- do not keep giant monolithic state blobs when remote and local state can be stored separately
- do not introduce a richer database model than the current document-style state needs

### Storage layout

Store each namespace with three keys:

- `sync-state:<namespace>:meta`
- `sync-state:<namespace>:remote`
- `sync-state:<namespace>:local`

Store:

- remote traversal queue and snapshot in `remote`
- local records and `baseText` in `local`
- small namespace state such as storage version in `meta`

This keeps the implementation simple and avoids rewriting local records when traversal only updates remote state.

### `baseText`

Keep `baseText` in the new store.

Do this:

- store `baseText` only for mergeable text files
- enforce a strict size cap when creating `baseText`
- keep conflict and decision logic working when `baseText` is absent

Do not do this:

- do not keep uncapped `baseText`
- do not remove `baseText` entirely, because that changes sync behavior instead of only fixing storage

## Files related and what to change

### `package.json`

- add `localspace` (since it's more modern, it's usage is near-identical to `localforage`, documentation: https://github.com/unadlib/localspace/raw/refs/heads/main/README.md, ask librarian if you cannot manage it)

### `src/settings/index.ts`

- remove `PersistedSyncStateModel` import
- remove `syncStates` from `PluginSettings`
- keep only actual user-facing settings

### `src/index.ts`

- keep `loadSettings()` and `saveSettings()` for config only
- initialize the external sync-state store during plugin startup
- do not load sync-state data through plugin settings

### `src/storage/sync-record.ts`

- refactor `SyncRecord` to use a storage adapter instead of `plugin.settings.syncStates`
- keep the current public API shape:
  - `getState()`
  - `setState()`
  - `mutateState()`
  - `getLocalRecords()`
  - `getRemoteRecord()`
  - `setRemoteRecord()`
  - `clearRemoteRecord()`
  - `drop()`
- keep normalization and mutation helpers inside `SyncRecord`
- remove all settings access and `plugin.saveSettings()` calls from this file

### New file: `src/storage/sync-state-store.ts`

- define the storage contract used by `SyncRecord`
- include exact methods for segmented state access:
  - `getRemote(namespace)`
  - `setRemote(namespace, remoteRecord)`
  - `clearRemote(namespace)`
  - `getLocal(namespace)`
  - `setLocal(namespace, localRecords)`
  - `delete(namespace)`

### New file: `src/storage/indexeddb-sync-state-store.ts`

- implement the storage contract with localspace
- serialize persisted DTOs only
- keep key naming stable and explicit

### `src/storage/index.ts`

- export the new store types and implementation

### `src/model/sync-record.model.ts`

- keep the domain models
- remove types that only exist because settings needed JSON-compatible state if they become redundant
- keep the persisted DTO only if the new store still needs it as a serialization boundary

### `src/utils/traverse-webdav.ts`

- keep traversal logic unchanged
- route remote snapshot writes through the new store-backed `SyncRecord`
- keep save checkpoints

### `src/sync/utils/update-records.ts`

- keep update flow unchanged
- add the strict `baseText` size cap in `createBaseText()`

### `src/sync/decision/two-way.decider.ts`

- keep decision logic unchanged
- continue reading previous records through `SyncRecord`

### `src/sync/tasks/conflict-resolve.task.ts`

- keep conflict logic unchanged
- rely on the existing fallback path when `baseText` is absent

## Refactor steps

1. Add `localspace`.
2. Add `SyncStateStore` and `IndexedDbSyncStateStore`.
3. Refactor `SyncRecord` to use the new store.
4. Remove `syncStates` from plugin settings.
5. Remove all settings-based sync-state code.
6. Add the strict `baseText` size cap.
7. Verify that traversal, planning, task execution, and conflict resolution still work through `SyncRecord`.

## Caveats

### 1. IndexedDB failure handling

The plugin must handle store initialization and write failures explicitly.

Do this:

- log storage open/read/write failures clearly
- fail the sync operation when record storage is unavailable
- keep plugin startup alive even if sync-state storage is unavailable until sync actually needs it

Do not do this:

- do not silently fall back to settings storage
- do not silently ignore failed record writes

### 2. Write size

Moving out of settings removes the worst bottleneck, but large writes still exist if state is stored carelessly.

Do this:

- store remote and local state separately
- keep traversal writes limited to remote state
- keep task-record writes limited to the parts that changed

### 3. `baseText` growth

`baseText` remains useful but must be bounded.

Do this:

- enforce a hard size cap
- keep storing only mergeable text
- let missing `baseText` use the existing fallback behavior

### 4. Simplicity rule

This refactor must remove old code instead of layering compatibility on top.

Do this:

- delete settings-backed sync-state persistence immediately
- delete legacy types, branches, and metadata that only support the old path
- keep one storage path in the codebase

Do not do this:

- do not ship dual storage backends
- do not keep dead migration helpers
- do not retain unused settings fields

## Summary

Do a hard cut:

- settings store config only
- IndexedDB/localspace stores sync records only
- `SyncRecord` remains the sync-state boundary
- remote and local state are stored separately
- old settings-backed sync-state code is deleted

This is the simplest and cleanest way to remove the bottleneck without changing the sync engine design.
