# V3 Migration

V2 source: `/home/hesprs/Documents/Sync Engine Legacy/`
V3 source: `/home/hesprs/Documents/Sync Engine/`

## Persistent Surfaces

v2 Plugin Data:

- Location: `.obsidian/plugins/webdav-sync/data.json`
- Source: `src/index.ts` (Line 40)

v2 IndexedDB:

- Database Name: `obsidian-webdav-sync`
- Stores: `sync-state`, `base-text`, `file-chunk`
- Source: `src/storage/store.interface.ts` (Line 12)

v3 Plugin Data:

- Location: `.obsidian/plugins/sync-engine/data.json`
- Source: `packages/plugin/src/index.ts` (Line 63)

v3 IndexedDB:

- Database Name: `sync-engine`
- Stores: `sync-state`, `base-text` only
- Version Meta: `version=1`
- Source: `packages/plugin/src/storage/database.ts` (Line 17)

v3 Module Files:

- Location: `.obsidian/plugins/sync-engine/modules/<Name>~<Version>.js`
- Source: `packages/plugin/src/modules/Extensibility.ts` (Line 65)

## v2 → v3 Settings Mapping

- `serverUrl`: `WebDAV.endpoint`
- `account`: `WebDAV.username`
- `token`: `WebDAV.password`
- `remoteDir`: `WebDAV.baseDirectory`
- `exhaustiveRemoteTraversal`: `WebDAV.depthInfinity`
- `fastRealtimeSync`: `realtimeSyncFastMode`
- `showSyncStatusInNotificationOnMobile`: `noticeStatusOnMobile`
- `confirmBeforeSync`: `confirmTasksInSync`
- `confirmBeforeDeleteInAutoSync`: `confirmDeleteInAutoSync`
- `conflictStrategy`, `unmergeableStrategy`, `useGitStyle`, `realtimeSync`, `startupSync`, `scheduledSync`: Carry forward
- `skipLargeFiles`: `maxFileSize`
- `maxWebDAVConcurrency`: `maxRequestConcurrency`
- `minWebDAVRequestInterval`: `minRequestInterval`
- `customHeaders`: same name, different shape

### Removed in v3 (No Current Target)

- `maxThroughputConcurrency`
- `maxSyncTaskConcurrency`
- `v3Exists`
- `neverShowV3Migration`

### Added in v3

- `remoteFs`
- `decider`
- `moduleAutoUpdate`
- `moduleSources`
- `modules`
- `asymmetricStorage`
- `maxMemoryConsumption`

## Reproducing Old Behavior

To replicate v2 behavior in v3, the following must be set:

1. `remoteFs` must be set to `webdav`.
2. `decider` must be set to `bidirectional`.
3. `modules.WebDAV` and `modules.Encryption` must be enabled.
4. `asymmetricStorage` must be disabled.
5. `customHeaders` must all be transpiled into `{ key: string, value: string, type: 'plaintext' }`
6. Fetch module source `https://sync.consensia.cc/modules.json` and download WebDAV module. Download encryption / localization modules according to whether encryption is enabled and user locale

## Storage Migration Details

- Store name: `sync-engine`, rekey + copy store content from `obsidian-webdav-sync`. After copying, delete corresponding keys from stores in `obsidian-webdav-sync`. When all stores become empty in `obsidian-webdav-sync`, delete database `obsidian-webdav-sync`.
- `base-text`: Can be rekeyed by `namespace + path`.
- `sync-state`: Remote scanning `etag` with `mtime~size` fallback + rekey.
- `file-chunk`: Gone in v3.

## Remote Shape Migration

- Encryption not enabled: no need migration
- Encryption enabled: remind user to delete remote side then re-sync, encryption key deviation formula changed.

## Implementation

- On every startup, if `v3Exists` is false, check v3 existence by `src/utils/v3-exists.ts` with delay of 10 seconds.
- If it exists, show a modal reminding that v3 migration will start and the items will be processed, the user can select cancel, don't show again, and proceed.
- When proceeding, the modal will show a progress bar (Obsidian `ProgressBarComponent`) indicating the progress, when migration fails, revert all changes.
- When migration succeeds, remind user what to do next: download Sync Engine, disable and delete WebDAV Sync, and delete and re-sync remote when encryption is enabled
- All migration changes are directly mutated to the target place, for example, to the `sync-engine` store, and to `<configDir>/plugins/sync-engine/`.
- Migration should also be rendered in development settings as an entry if `v3Exists` is true.
