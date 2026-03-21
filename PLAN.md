# Sync robustness refactor plan

## Context

- Do turn planning into snapshotting.
- Do make execution consume only that snapshot.
- Do remove every execution-time read of local or remote state that can diverge from the plan.
- Do move sync record updates into the tasks that actually apply the change.
- Do remove centralized record refresh completely.
- Do remove redundant helpers and code paths immediately.

This refactor is required because the current design has two race windows:

- The decider snapshots state, then tasks later re-read local or remote state during execution.
- Tasks finish, then record update code re-reads local or remote state again.

Both races break determinism. The plan must be the snapshot. The task must apply that snapshot. The task must update the record from that same snapshot.

Some codemaps are stale.

## Current implementation

### Planning

- `src/sync/decision/two-way.decider.ts`
  - Loads previous local records, previous remote record snapshot, current local walk, current remote walk.
  - Builds tasks through the task factory.
- `src/sync/decision/two-way.decider.function.ts`
  - Compares current local, current remote, and previous records.
  - Decides push, pull, remove, mkdir, conflict, noop, skipped, and cleanup tasks.
  - Still constructs most tasks with path-only inputs.
- `src/sync/index.ts`, `src/events/sync-run.ts`, `src/components/SyncProgressModal.ts`
  - Expose planning only as a coarse `planning` stage.
  - Do not report remote traversal progress.
  - Do not report decider progress.
  - Do not show planning counters comparable to execution counters.

### Execution

- `src/sync/index.ts`
  - Executes planned tasks.
  - Rebuilds re-upload tasks during delete confirmation by reading current local and remote state again in `buildReuploadTasks()` and `ensureReuploadParentDir()`.
- `src/sync/tasks/push.task.ts`
  - Re-reads the local file from vault during execution.
- `src/sync/tasks/remove-local.task.ts`
  - Re-stats and re-fetches the local abstract file during execution.
- `src/sync/tasks/conflict-resolve.task.ts`
  - Falls back to re-stat and re-read local and remote content during execution.
- `src/sync/tasks/pull.task.ts`, `mkdir-local.task.ts`, `mkdir-remote.task.ts`, merged task variants
  - Still depend on later centralized record refresh.

### Record update

- `src/sync/index.ts`
  - Calls `updateMtimeInRecord(taskChunk, results)` after task execution.
- `src/sync/utils/update-records.ts`
  - Re-stats local and remote state after task success.
  - Infers record mutations from task type outside the task itself.

## Target implementation

### Core rule

- Do make the plan a complete execution snapshot.
- Do make tasks consume only planned snapshot data.
- Do make tasks write sync records directly.
- Do make planning observable with the same level of progress visibility as execution.
- Do not apply record deltas centrally.
- Do not validate current filesystem state before applying a planned change.
- Do not re-stat local or remote paths after applying a change.
- Do throw only when the actual write, delete, create, download, upload, or merge operation fails.

### Planning observability

- Do report planning progress through the main `sync-run` snapshot stream.
- Do split planning into explicit sub-stages:
  - loading_records
  - walking_local
  - walking_remote
  - deciding
- Do attach planning progress counters to the run snapshot.
- Do update planning progress during remote traversal after each processed remote directory.
- Do update planning progress during decider work after each processed candidate path or other deterministic planning work unit.
- Do show planning progress in the modal with the same bar/counter treatment used for execution.
- Do remove generic `Preparing`-only planning UI once deterministic planning progress exists.
- Do keep execution progress and planning progress in the same observable contract.
- Do not add a second planning-only progress event channel.

### Snapshot contract

Each actionable task must be created with all data it needs to execute and to update the record.

That snapshot must include, depending on task type:

- planned local stat
- planned remote stat
- local file bytes
- local abstract file reference
- remote file bytes
- previous sync record/base text
- merged child path payloads for optimized tasks
- parent directory creation payloads for re-upload flows

If a task needs data to decide what to write, the decider must fetch it during planning and store it in the task options. Execution must not fetch it again.

### Record ownership

- Do make each task call `this.syncRecord.mutateState(...)` immediately after its filesystem mutation succeeds.
- Do make each task update only the paths it owns.
- Do keep path normalization and low-level state mutation helpers inside `SyncRecord`.
- Do expose high-level `SyncRecord` methods that tasks call directly.

## Required implementation details

### 1. Replace path-only tasks with snapshot-backed tasks

- `src/sync/decision/sync-decision.interface.ts`
  - Do redesign task option types around snapshot payloads, not path-only inputs.
  - Do create explicit option types for each task family.
  - Do include the exact content and metadata needed by the task to:
    - apply the change
    - update the record deterministically

- `src/sync/decision/two-way.decider.ts`
  - Do wire the richer snapshot-backed option types through the task factory.

- `src/sync/decision/two-way.decider.function.ts`
  - Do fetch all task execution inputs during planning.
  - Do turn the planning phase into the only state-reading phase.
  - Do build every actionable task from that snapshot only.
  - Do remove any task construction that leaves execution to fetch live state later.

### 1A. Add planning progress reporting

- `src/events/sync-run.ts`
  - Do extend the run snapshot contract with planning progress data.
  - Do represent planning sub-stage, total work units, completed work units, and current planning item.
  - Do keep execution progress summary intact.

- `src/sync/index.ts`
  - Do emit planning progress snapshots while `preparePlan()` runs.
  - Do initialize planning progress before remote traversal starts.
  - Do finalize planning progress when the decider finishes building tasks.

- `src/utils/traverse-webdav.ts`
  - Do expose deterministic progress callbacks for remote traversal.
  - Do report processed directory count and known total queue size on every traversal advance.
  - Do not hide traversal progress inside internal state only.

- `src/sync/decision/two-way.decider.ts`
  - Do pass planning progress callbacks into remote traversal and decider execution.

- `src/sync/decision/two-way.decider.function.ts`
  - Do report deterministic decider progress while scanning the snapshot and creating tasks.
  - Do use a stable work-unit definition so progress is monotonic.

- `src/components/SyncProgressModal.ts`
  - Do render planning sub-stage text, current planning item, and planning counters.
  - Do reuse the main progress bar for planning before execution starts.
  - Do stop showing planning-only text once execution begins.

- `src/services/progress.service.ts`
  - Do consume the richer `sync-run` planning snapshot without separate planning state.

### 2. Make tasks update records directly

- `src/storage/sync-record.ts`
  - Do add high-level task-facing methods for direct mutation, such as:
    - write synced file record from local snapshot
    - write synced file record from remote snapshot
    - write synced folder record
    - remove local record path
    - remove remote record path
    - remove local subtree record
    - remove remote subtree record
    - clean both sides for orphaned record paths
    - write merged conflict result record
  - Do keep all normalization and in-state mutation helpers private behind these methods.
  - Do not require the engine to understand record semantics.

- `src/sync/tasks/task.interface.ts`
  - Do keep `TaskResult` minimal.
  - Do not add central delta plumbing.
  - Do keep only success/failure and `skipRecord` semantics.

### 3. Remove centralized record update completely

- `src/sync/index.ts`
  - Do remove `updateMtimeInRecord` import, method, and invocation.
  - Do leave orchestration responsible only for planning, confirmation, optimization, execution, retry, and progress.
  - Do not aggregate or apply record changes after tasks finish.

- `src/sync/utils/update-records.ts`
  - Do delete this file.

### 4. Refactor every task to execute from snapshot only

- `src/sync/tasks/push.task.ts`
  - Do accept captured local file bytes and planned local stat from the decider.
  - Do upload those bytes directly.
  - Do update `SyncRecord` directly from the planned local snapshot after successful upload.
  - Do not read the vault during execution.

- `src/sync/tasks/pull.task.ts`
  - Do accept captured remote file bytes and planned remote stat from the decider.
  - Do write those bytes to the vault directly.
  - Do update `SyncRecord` directly from the planned remote snapshot after successful write.
  - Do not fetch remote content during execution.
  - Do not stat the local file after write.

- `src/sync/tasks/remove-local.task.ts`
  - Do accept captured local abstract file and planned local stat from the decider.
  - Do trash that captured file directly.
  - Do update `SyncRecord` directly by removing the corresponding local record and preserving/removing remote record according to task meaning.
  - Do not stat or fetch the local path during execution.

- `src/sync/tasks/remove-remote.task.ts`
  - Do accept planned remote stat from the decider.
  - Do delete the remote path directly.
  - Do update `SyncRecord` directly after success.
  - Do not stat remote after deletion.

- `src/sync/tasks/remove-remote-recursively.task.ts`
  - Do carry the full merged subtree payload.
  - Do delete once.
  - Do remove all represented remote/local record paths directly.

- `src/sync/tasks/mkdir-local.task.ts`
  - Do accept planned remote folder snapshot.
  - Do create the local folder.
  - Do write the corresponding record directly from the planned remote folder snapshot.
  - Do not stat local after mkdir.

- `src/sync/tasks/mkdir-remote.task.ts`
  - Do accept planned local folder snapshot.
  - Do create the remote folder.
  - Do write the corresponding record directly from the planned local folder snapshot.
  - Do not stat remote after mkdir.

- `src/sync/tasks/mkdirs-remote.task.ts`
  - Do carry all merged directory snapshots.
  - Do create the deepest directory once.
  - Do write records for every merged directory directly from the planned local folder snapshots.
  - Do not restat any created directory.

- `src/sync/tasks/conflict-resolve.task.ts`
  - Do accept captured local bytes, remote bytes, local stat, remote stat, and previous record/base text from the decider.
  - Do resolve the conflict entirely from those captured inputs.
  - Do write the resolved result.
  - Do write the resulting sync record directly from the resolved content and chosen metadata policy.
  - Do not stat or read local or remote again during execution.
  - Do keep `skipRecord` only for explicit skip strategy.

- `src/sync/tasks/clean-record.task.ts`
  - Do directly remove the orphaned local and remote records.

- `src/sync/tasks/noop.task.ts`
  - Do nothing.

- `src/sync/tasks/skipped.task.ts`
  - Do nothing and keep `skipRecord`.

### 5. Define deterministic record-writing rules from the snapshot

The record must be written from planned data, not observed post-write metadata.

- For push:
  - Do write both sides from the planned local snapshot.
- For pull:
  - Do write both sides from the planned remote snapshot.
- For mkdir local:
  - Do write folder records from the planned remote folder snapshot.
- For mkdir remote:
  - Do write folder records from the planned local folder snapshot.
- For remove tasks:
  - Do remove the affected side directly from the record.
- For cleanup tasks:
  - Do remove both sides directly from the record.
- For conflict resolution:
  - Do define one explicit metadata policy and use it everywhere:
    - latest-timestamp resolution writes record metadata from the chosen winner snapshot
    - merge resolution writes record metadata from a deterministic synthetic sync snapshot produced by the task

Do not write records from post-write stat results.

### 6. Rebuild confirmation flows from the snapshot, not live state

- `src/sync/index.ts`
  - Do change `buildReuploadTasks()` to rebuild from task snapshot payloads already present on `RemoveLocalTask`.
  - Do remove `statVaultItem()` from re-upload rebuilding.
  - Do remove `webdav.stat()` from `ensureReuploadParentDir()`.
  - Do determine parent mkdir requirements from the original planned task set and planned remote snapshot maps.
  - Do construct replacement `PushTask` and `MkdirRemoteTask` instances from already-captured snapshot data only.

### 7. Remove obsolete snapshot-breaking helpers

- `src/utils/read-local-file.ts`
  - Do keep only if the decider uses it during planning.
  - Do not use it from task execution.

- `src/utils/stat-vault-item.ts`
  - Do keep only for planning and filesystem walking.
  - Do not use it from task execution.

- `src/utils/stat-webdav-item.ts`
  - Do keep only for planning and snapshot building.
  - Do not use it from task execution.

## Files related and what to change

### Orchestration

- `src/sync/index.ts`
  - Remove centralized record update.
  - Remove live-state reads from re-upload rebuilding.
  - Emit planning sub-stage progress.
  - Keep engine orchestration only.

### Decision layer

- `src/sync/decision/sync-decision.interface.ts`
  - Replace path-only options with snapshot-backed options.
- `src/sync/decision/two-way.decider.ts`
  - Pass snapshot-backed options into tasks.
  - Bridge planning progress callbacks.
- `src/sync/decision/two-way.decider.function.ts`
  - Fetch task inputs during planning.
  - Snapshot every actionable change completely.
  - Emit decider progress.

### Planning observability

- `src/events/sync-run.ts`
  - Add planning progress contract to the sync run snapshot.
- `src/utils/traverse-webdav.ts`
  - Emit traversal progress units during remote walk.
- `src/components/SyncProgressModal.ts`
  - Show planning sub-stage, counters, and current item.
- `src/services/progress.service.ts`
  - Keep modal state driven by the unified sync run snapshot.

### Tasks

- `src/sync/tasks/task.interface.ts`
  - Keep minimal task result contract.
- `src/sync/tasks/push.task.ts`
  - Remove vault read during execution.
  - Write record directly.
- `src/sync/tasks/pull.task.ts`
  - Remove remote fetch during execution.
  - Write record directly.
- `src/sync/tasks/remove-local.task.ts`
  - Remove stat/read during execution.
  - Write record directly.
- `src/sync/tasks/remove-remote.task.ts`
  - Write record directly.
- `src/sync/tasks/remove-remote-recursively.task.ts`
  - Write merged removal directly.
- `src/sync/tasks/mkdir-local.task.ts`
  - Write record directly.
- `src/sync/tasks/mkdir-remote.task.ts`
  - Write record directly.
- `src/sync/tasks/mkdirs-remote.task.ts`
  - Write all merged records directly.
- `src/sync/tasks/conflict-resolve.task.ts`
  - Remove live stat/read fallbacks.
  - Resolve and write record from captured snapshot only.
- `src/sync/tasks/clean-record.task.ts`
  - Remove records directly.

### State persistence

- `src/storage/sync-record.ts`
  - Add direct task-facing mutation methods.

### Optimizers

- `src/sync/utils/merge-mkdir-tasks.ts`
  - Preserve every merged directory snapshot payload.
- `src/sync/utils/merge-remove-remote-tasks.ts`
  - Preserve every merged subtree removal payload.

### Remove

- `src/sync/utils/update-records.ts`
  - Delete.

## Invariants

- Do read local and remote state only during planning.
- Do not read local or remote state during task execution except the actual content payload already captured in the task options.
- Do not stat local or remote after applying a change.
- Do not apply record changes centrally.
- Do update records only inside the task that applied the change.
- Do keep optimized tasks semantically equivalent to the original task set.
- Do rebuild confirmation replacements from the original snapshot only.

## Implementation phases

Phase 1, 2, 3 and 4 are currently implemented.

### Phase 1. Observability and contracts

- Do extend `sync-run` planning snapshots with planning sub-stage and progress counters.
- Do wire remote traversal and decider progress reporting into `preparePlan()`.
- Do update the progress modal and progress service to show planning progress from the unified run snapshot.
- Do redesign task option types around snapshot payloads.

### Phase 2. Record ownership and simple snapshot-backed tasks

- Do add direct task-facing mutation methods to `SyncRecord`.
- Do refactor cleanup and delete task families to mutate records directly.
- Do remove any central record semantics from orchestration.

### Phase 3. Snapshot-only execution for write tasks

- Do refactor push, pull, mkdir, and merged task variants to execute from captured snapshot data only.
- Do refactor re-upload confirmation rebuilding to use only original planned snapshot payloads.
- Do preserve optimizer semantics while carrying merged snapshot payloads.

### Phase 4. Conflict resolution and cleanup removal

- Do refactor conflict resolution to execute from captured bytes, stats, and base text only.
- Do delete `src/sync/utils/update-records.ts`.
- Do remove all remaining execution-time stat/read fallbacks.
- Do verify that planning is the only state-reading phase and that every successful task mutates `SyncRecord` directly.

## Done criteria

- Planning is the only phase that reads sync state from local and remote.
- Planning shows deterministic progress for remote traversal and decider work through the main sync progress UI.
- Every actionable task executes successfully from its captured snapshot or fails only because the write/delete/create operation itself failed.
- No task calls `getFileByPath`, `getAbstractFileByPath`, `statVaultItem`, `statWebDAVItem`, `webdav.stat`, or remote content reads to discover live state during execution.
- No centralized record-update phase exists.
- Every successful task updates `SyncRecord` directly.
- Re-upload confirmation does not re-read live local or remote state.
