# src/

## Responsibility

-`src/index.ts` defines `NutstorePlugin`, initializes default `NutstoreSettings`, and wires core services (`SyncExecutorService`, `WebDAVService`, `ScheduledSyncService`, `RealtimeSyncService`, `ProgressService`, `StatusService`).
-The source tree provides the full sync stack: filesystem abstraction in `src/fs`, decision and execution engine in `src/sync`, persistence in `src/storage`, runtime configuration in `src/settings`, and shared helpers in `src/utils`.
-It owns plugin lifecycle hooks (`onload`, `onunload`), account/token handling (`getToken`, `getDecryptedOAuthInfo`, `isAccountConfigured`), and sync root normalization (`remoteBaseDir`).

## Design Patterns

-Facade and service composition: `NutstorePlugin` acts as the composition root and delegates behavior to focused services instead of embedding sync logic directly.
-Strategy via filesystem abstraction: `IFileSystem` with `LocalVaultFileSystem` and `NutstoreFileSystem` allows the sync engine to operate over local vault and WebDAV using the same walk/stat contract.
-Command-based execution: `src/sync/tasks/*.task.ts` encapsulates concrete operations (`PushTask`, `PullTask`, `RemoveLocalTask`, `RemoveRemoteTask`, `MkdirLocalTask`, `MkdirRemoteTask`, `ConflictResolveTask`).
-Event-driven coordination: `src/events/*` exposes emitters/subscriptions used by sync runtime and UI (`emitStartSync`, `emitSyncProgress`, `emitSyncError`, `emitCancelSync`).
-Persistence adapter pattern: `src/storage/use-storage.ts` standardizes key-value access, while `SyncRecord` and `blobStore` provide domain-level APIs.

## Data & Control Flow

1. Plugin boot: `NutstorePlugin.onload()` calls `loadSettings()`, registers settings UI (`NutstoreSettingTab`), protocol handler, then starts `ScheduledSyncService.start()`.
2. Triggering sync: user command, schedule, or vault events call `SyncExecutorService.executeSync()` with `SyncStartMode`.
3. Pre-check and setup: executor validates account config, ensures exclusion rules, builds `NutstoreSync` with `WebDAVService.createWebDAVClient()` and `remoteBaseDir`.
4. Planning: `TwoWaySyncDecider.decide()` walks both filesystems (`localFS.walk()`, `remoteFs.walk()`), loads records from `SyncRecord.getRecords()`, and invokes `twoWayDecider()`.
5. Decision output: `twoWayDecider()` maps states to task instances using `TaskFactory`, including skip/clean/conflict handling.
6. Execution: `NutstoreSync.start()` confirms actions when required, optimizes task list (`mergeMkdirTasks`, `mergeRemoveRemoteTasks`), executes tasks in chunks through `execTasks()` and `executeWithRetry()`.
7. Persistence and feedback: `updateMtimeInRecord()` writes record updates, events update UI/progress, and final status is emitted by `emitEndSync` or `emitSyncError`.

## Integration Points

-Obsidian runtime: `Plugin`, `Vault`, protocol handlers, ribbon/status/progress UI components, notices, and settings tab APIs.
-Remote protocol: `webdav` client wrapped by `createRateLimitedWebDAVClient` in `src/utils/rate-limited-client.ts` and consumed by `NutstoreFileSystem` and task executors.
-Storage backend: IndexedDB through `localforage` wrappers in `src/storage/kv.ts`; sync metadata via `SyncRecord`, base-content blobs via `blobStore`.
-Configuration and localization: settings model and UI in `src/settings`, language switching through `I18nService`, string resources via `src/i18n`.
-Cross-module contracts: path/time/filter utilities (`stdRemotePath`, `remotePathToLocalPath`, `isSameTime`, glob matching) are shared across fs, decision, and task layers.
