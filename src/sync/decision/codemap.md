# src/sync/decision

## Responsibility

Generates deterministic `BaseTask[]` plans from current local/remote snapshots plus persisted sync state. This layer decides *what* to do; task classes decide *how* to execute.

## Design

- `BaseSyncDecider` (`base.decider.ts`) exposes shared runtime dependencies (`vault`, `webdav`, settings, remote base dir, sync-record storage).
- `TwoWaySyncDecider` (`two-way.decider.ts`) is the adapter between runtime data sources and the pure planning function.
- `twoWayDecider()` (`two-way.decider.function.ts`) is the branch-heavy state machine for file/folder transitions.
- `TaskFactory` (`sync-decision.interface.ts`) isolates planner logic from concrete task constructors.
- `hasFolderContentChanged()` provides folder-delta detection using descendant files (folder mtime is intentionally ignored).

## Data & Control Flow

1. `TwoWaySyncDecider.decide()` loads:
   - previous local records,
   - previous remote traversal snapshot (from persisted remote record),
   - current local walk,
   - current remote walk (`fresh`) or reused snapshot for `SyncRunKind.NUMB`.
2. A task factory is assembled for all decision outcomes (`Pull/Push/Conflict/Remove/Mkdir/CleanRecord/Noop/FilenameError/Skipped`).
3. `twoWayDecider()` preprocesses inputs:
   - parses max-size policy,
   - filters ignored entries,
   - builds local/remote/previous maps and cleanup candidate set.
4. File pass resolves per-path transitions across record/local/remote presence + mtime/content-change checks:
   - conflict, pull, push, remove local/remote, no-op,
   - guarded by filename validation and large-file skip policy.
5. Orphaned records (absent in both current sides) emit `CleanRecordTask`.
6. Folder passes (`remote->local`, `local->remote`) handle mkdir/remove/noop with descendant-change detection and ignored-descendant skip reasoning.
7. Folder removals are depth-sorted (deepest first), then prepended before file tasks.

## Integration Points

- Caller: `src/sync/index.ts` (`SyncEngine`).
- Inputs: `src/fs/*` walk results (`FsWalkResult` with `ignored` flag) and `src/storage/sync-record.ts` state.
- Helpers: path conversion (`platform/path/remote-path`), time comparison (`isSameTime`), filename validation (`hasInvalidChar`), ignored-folder utilities.
- Outputs: concrete tasks in `src/sync/tasks/*` via `TaskFactory`.
