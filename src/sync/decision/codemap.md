# src/sync/decision/

## Responsibility

-Define how local vault state, remote WebDAV state, and persisted sync records are translated into executable sync tasks.
-Provide the decider abstraction (`BaseSyncDecider`) and the concrete two-way implementation (`TwoWaySyncDecider`).
-Contain the pure decision engine (`twoWayDecider`) and helper logic for folder-change detection (`hasFolderContentChanged`).
-Define typed decision contracts and task-construction interfaces in `sync-decision.interface.ts`.

## Design Patterns

-Template method and base abstraction: `BaseSyncDecider` centralizes shared dependencies (`sync`, `syncRecordStorage`) and exposes abstract `decide()`.
-Class-to-function split for testable core logic: `TwoWaySyncDecider.decide()` handles environment wiring, while `twoWayDecider(input)` performs deterministic rule evaluation.
-Factory pattern: `TaskFactory` decouples decision rules from concrete task constructors (`createPullTask`, `createPushTask`, `createConflictResolveTask`, `createSkippedTask`, and others).
-Rule-based state machine behavior: branches in `twoWayDecider` classify each path by presence, record existence, mtime/content changes, size limits, and filename validity.

## Data & Control Flow

1. `NutstoreSync.start()` creates `TwoWaySyncDecider` and calls `decide()`.
2. `TwoWaySyncDecider.decide()` loads inputs concurrently: `SyncRecord.getRecords()`, `localFS.walk()`, `remoteFs.walk()`.
3. It builds shared options and a `TaskFactory`, plus content comparators (`getBaseContent` using `blobStore.get`, `compareFileContent` using `vault.readBinary` and `isEqual`).
4. `twoWayDecider()` parses size limit (`bytesParse`), filters ignored entries, builds local/remote path maps, then iterates the unified path set.
5. For files, it decides among `PullTask`, `PushTask`, `ConflictResolveTask`, `RemoveLocalTask`, `RemoveRemoteTask`, `NoopTask`, `CleanRecordTask`, `FilenameErrorTask`, and `SkippedTask`.
6. For folders, it uses `hasFolderContentChanged` and `hasIgnoredInFolder` to choose create/remove/noop/skip actions, then sorts remove tasks deepest-first before prepending folder tasks.
7. The ordered `BaseTask[]` is returned to `NutstoreSync` for confirmation, optimization, and execution.

## Integration Points

-Upstream caller: `src/sync/index.ts` (`NutstoreSync`) depends on this directory for planning.
-Task layer coupling: produces task instances from `src/sync/tasks/*.task.ts` and uses enums/constants like `ConflictStrategy` and `SkipReason`.
-Filesystem and records: consumes `FsWalkResult` from `src/fs/fs.interface.ts` and sync record shapes from `SyncRecord` storage.
-Utility dependencies: `isSameTime`, `hasInvalidChar`, `remotePathToAbsolute`, `remotePathToLocalPath`, `isSub`, and ignored-item helpers in `src/sync/utils/has-ignored-in-folder.ts`.
-Settings contract: consumes `SyncDecisionSettings` (`skipLargeFiles`, `conflictStrategy`, `useGitStyle`, `syncMode`) to drive decision branches.
