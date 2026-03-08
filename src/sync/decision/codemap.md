# src/sync/decision

## Responsibility

Builds the sync execution plan (`BaseTask[]`) from three snapshots: local FS state, remote FS state, and persisted sync records. This folder owns decision-making only (what should happen), not execution (how tasks run).

## Design

- **Entry abstraction**: `base.decider.ts`
  - `BaseSyncDecider` defines `decide(): MaybePromise<BaseTask[]>` and exposes `sync` dependencies (`webdav`, `vault`, `settings`, `remoteBaseDir`, sync record storage) to concrete deciders.

- **Concrete two-way decider wrapper**: `two-way.decider.ts`
  - `TwoWaySyncDecider.decide()` loads inputs in parallel:
    - `syncRecordStorage.getRecords()`
    - `this.sync.localFS.walk()`
    - `this.sync.remoteFs.walk()`
  - Builds a `TaskFactory` that maps decision outcomes to task classes:
    `PullTask`, `PushTask`, `ConflictResolveTask`, `NoopTask`, `RemoveLocalTask`, `RemoveRemoteTask`, `MkdirLocalTask`, `MkdirRemoteTask`, `CleanRecordTask`, `FilenameErrorTask`, `SkippedTask`.
  - Injects helpers for base-version reconciliation:
    - `getBaseContent(key)` via `blobStore`
    - `compareFileContent(filePath, baseContent)` via `vault.readBinary` + `isEqual`
  - Delegates all branching logic to pure function `twoWayDecider(input)`.

- **Decision contracts**: `sync-decision.interface.ts`
  - Defines input/state and output construction contracts:
    - `SyncDecisionSettings` (`skipLargeFiles`, `conflictStrategy`, `useGitStyle`, `syncMode`)
    - `SyncRecordItem` (`local`, `remote`, optional `base.key`)
    - typed task option shapes and `TaskFactory`
    - `SyncDecisionInput` (all dependencies passed explicitly)

- **Folder-change primitive**: `has-folder-content-changed.ts`
  - Detects folder state transitions by scanning descendants (`isSub`) and comparing descendant file mtimes against sync-record mtimes (`isSameTime`), ignoring folder mtime itself.

## Flow

1. **Preprocessing** (`twoWayDecider` in `two-way.decider.function.ts`)
   - Parses max file size (`bytes-iec`), defaults to `Infinity`.
   - Removes ignored walk entries (`item.ignored`).
   - Builds `localStatsMap`, `remoteStatsMap`, and `mixedPath` (union of paths).

2. **File decision state machine** (per path in `mixedPath`, non-directory only)
   - **State dimensions**:
     - record exists / not exists
     - local exists / not exists
     - remote exists / not exists
     - localChanged / remoteChanged (mtime vs record; local can be revalidated against `record.base.key` content)
   - **Transitions/outcomes**:
     - both changed -> `ConflictResolveTask` (or `FilenameErrorTask` / `SkippedTask(FileTooLarge)` guards)
     - remote changed only -> `PullTask` (or skip large)
     - local changed only -> `PushTask` (or filename error / skip large)
     - deleted on one side without change on other -> `RemoveRemoteTask` or `RemoveLocalTask`
     - no record + both exist -> `ConflictResolveTask` (or in `SyncMode.LOOSE` and equal size -> `NoopTask`)
     - no record + only one side exists -> `PullTask` / `PushTask` (with size and filename guards)

3. **Orphaned record cleanup**
   - For every sync record absent from both maps -> `CleanRecordTask`.

4. **Folder decision pass: remote -> local**
   - Iterates remote directories:
     - remote dir exists locally and no record -> `NoopTask`
     - record exists but local missing:
       - if folder content changed (`hasFolderContentChanged(..., 'remote')`) -> `MkdirLocalTask`
       - else if ignored descendants exist -> `SkippedTask(FolderContainsIgnoredItems)`
       - else -> deferred `RemoveRemoteTask`
     - no local and no record -> `MkdirLocalTask`
     - type mismatch (remote dir vs local file) -> throw error

5. **Folder decision pass: local -> remote**
   - Iterates local directories:
     - local dir exists remotely and no record -> `NoopTask`
     - record exists but remote missing:
       - if folder content changed (`hasFolderContentChanged(..., 'local')`) -> `MkdirRemoteTask` (or `FilenameErrorTask`)
       - else if ignored descendants exist -> `SkippedTask(FolderContainsIgnoredItems)`
       - else -> deferred `RemoveLocalTask`
     - no remote and no record -> `MkdirRemoteTask` (or `FilenameErrorTask`)
     - type mismatch (local dir vs remote file) -> throw error

6. **Task ordering / final plan assembly**
   - Folder removals are sorted deepest-first:
     - `removeRemoteFolderTasks` by `remotePath.length` desc
     - `removeLocalFolderTasks` by `localPath.length` desc
   - Final order prepends folder tasks before file tasks:
     - remove folders -> mkdir folders -> folder noops -> existing file task list.

## Integration

- **Primary caller**
  - `SyncEngine` instantiates/uses `TwoWaySyncDecider` (folder-external caller).

- **Internal call chain**
  - `TwoWaySyncDecider.decide()` -> `twoWayDecider(input)`
  - `twoWayDecider()` -> `hasFolderContentChanged()` for folder existence/change transitions.

- **Task construction boundary (callee relationships)**
  - Decision layer calls `TaskFactory.create*` methods.
  - Factory returns concrete task instances from `src/sync/tasks/*`, isolating branching logic from constructor details.

- **External dependencies used by decision logic**
  - FS snapshots: `localFS.walk()`, `remoteFs.walk()`
  - Sync records: `SyncRecord.getRecords()`
  - Base-content compare path: `blobStore.get(key)` + `vault.readBinary(file)`
  - Path/time/validation helpers: `remotePathToAbsolute`, `remotePathToLocalPath`, `isSameTime`, `hasInvalidChar`, ignored-item utilities.
