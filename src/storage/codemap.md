# src/storage

## Responsibility

Persist and mutate per-sync-state records only. Storage in this directory is now scoped to `SyncRecord` state management backed by plugin settings (`plugin.settings.syncStates`).

## Design Patterns

- **State DAO (`SyncRecord`)**: encapsulates state load/normalize/mutate/save for a namespace (`stateKey`) and remote base directory.
- **Persistence through settings**: read/write uses plugin-instance accessors (`waitUntilPluginInstance`, `getPluginInstance`) and `plugin.saveSettings()`.
- **In-memory/runtime normalization boundary**: persisted `localRecords` (`Record`) are converted to runtime `Map`, and partial/legacy remote-record shapes are normalized before use.
- **Path canonicalization on all mutations**: vault and remote paths are normalized (`normalizeVaultPath`, `normalizeRemotePath`, `remotePathToAbsolute`) before update/remove operations.

## Data & Control Flow

1. Callers construct `new SyncRecord(namespace, remoteBaseDir)`.
2. `loadState()` reads `plugin.settings.syncStates[namespace]` (or creates empty state), then normalizes into runtime `SyncStateModel`.
3. Read APIs expose either full state (`getState`) or projections (`getRemoteRecord`, `getRemoteStats`, `getLocalRecords`).
4. Mutations run through `mutateState()` / helper methods (`upsertRemotePathInState`, `removeRemoteSubtreeInState`, `upsertLocalRecordInState`, etc.).
5. `saveState()` serializes runtime `Map` back to persisted `Record`, writes to `syncStates`, and persists via `plugin.saveSettings()`.
6. `drop()` removes a namespaced state entry from settings.

## Integration Points

- **Consumed by sync runtime**: `SyncEngine`, deciders, task layer, local FS adapter, and resumable WebDAV traversal build/use `SyncRecord`.
- **Model contracts**: `StatModel`, `LocalRecordModel`, `RemoteRecordModel`, `SyncStateModel`, `PersistedSyncStateModel`.
- **Path utilities**: remote/vault normalization and remote walk-path canonicalization.
- **Settings module coupling**: depends on plugin singleton accessors from `src/settings/index.ts`.

## Key Files

- `index.ts`: storage barrel export.
- `sync-record.ts`: namespaced sync-state DAO with read APIs and path-aware mutation helpers.
