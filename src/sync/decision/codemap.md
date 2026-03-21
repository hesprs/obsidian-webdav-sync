# src/sync/decision

## Responsibility

Converts local/remote traversal snapshots plus persisted sync records into a deterministic `BaseTask[]` plan for the sync engine.

This folder contains planning logic only: it decides which task type should run for each path transition, while task implementations own runtime side effects.

## Design patterns

- **Adapter + pure planner split**:
  - `TwoWaySyncDecider` (`two-way.decider.ts`) gathers runtime inputs from `SyncEngine` and builds planner adapters.
  - `twoWayDecider()` (`two-way.decider.function.ts`) is the branch-heavy pure planning function.
- **Factory abstraction for task construction**: `TaskFactory` (`sync-decision.interface.ts`) decouples decision branches from concrete task classes.
- **Snapshot-on-demand with caching**:
  - local/remote file snapshots are created lazily and memoized by path;
  - folder snapshots are lightweight stat/handle snapshots created when folder tasks are emitted.
- **Folder delta by descendant inspection**: `hasFolderContentChanged()` checks child items against record state and intentionally ignores folder mtime.
- **Typed planning contracts**: `sync-decision.interface.ts` defines planner input (`SyncDecisionInput`), per-task option shapes, skip reasons, and planned snapshot models.

## Data & control flow

1. `TwoWaySyncDecider.decide()` reports planning progress and loads planning inputs:
   - previous local records from `SyncRecord`,
   - previous remote traversal snapshot (stored-record walk when available),
   - current local walk,
   - current remote walk (`fresh`) or stored snapshot reuse when run kind is `SyncRunKind.NUMB`.
2. It creates a `TaskFactory` for all decision outcomes (`Pull`, `Push`, `ConflictResolve`, `RemoveLocal`, `RemoveRemote`, `MkdirLocal`, `MkdirRemote`, `CleanRecord`, `Noop`, `FilenameError`, `Skipped`).
3. It prepares planner callbacks for:
   - content-aware local comparison (`compareFileContent` against `baseText`),
   - planned snapshot creation (local/remote, file/folder).
4. `twoWayDecider()` preprocesses inputs:
   - parses max-size setting (`bytes-iec`),
   - filters ignored traversal entries,
   - builds local/remote/previous maps,
   - builds record-backed comparison map and orphan-cleanup candidate set.
5. File decision pass resolves per-path transitions from record + current existence/change state:
   - pull/push/conflict/remove/noop,
   - large-file skip handling,
   - filename validation before remote-creating operations,
   - content check fallback when local mtime changed but `baseText` exists.
6. Orphaned previous entries absent on both sides emit `CleanRecordTask`.
7. Folder decision passes run in both directions (`remote -> local`, `local -> remote`) using descendant-change detection and ignored-descendant guards:
   - create folder tasks when content changed or missing counterpart,
   - remove folder tasks only when removable,
   - emit skipped tasks for ignored-content protections,
   - emit folder noops when both folder sides exist without record pressure.
8. Folder removal tasks are sorted deepest-first, combined with mkdir/noop folder tasks, then prepended to file tasks for final deterministic ordering.

## Integration points

- **Upstream caller**: `src/sync/index.ts` (`SyncEngine.preparePlan()`) invokes `TwoWaySyncDecider.decide()`.
- **Filesystem snapshots**: consumes `FsWalkResult[]` from local and remote filesystem walkers, including `ignored` flags.
- **Persistence boundary**: reads prior local/remote state via `SyncRecord` APIs.
- **Task execution layer**: emits concrete `BaseTask` instances from `src/sync/tasks/*` through `TaskFactory`.
- **Shared utilities/platform**:
  - remote/local path conversion (`platform/path/remote-path`),
  - time comparison (`isSameTime`),
  - invalid filename check (`hasInvalidChar`),
  - ignored-folder helpers (`sync/utils/has-ignored-in-folder`),
  - debug tracing (`utils/logger`).
