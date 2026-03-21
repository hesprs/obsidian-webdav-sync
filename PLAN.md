# Sync robustness refactor plan

## Context

- Do remove the plan/execute race. The current sync pipeline decides work from one snapshot and executes later against a different reality. Local files can be renamed, edited, or deleted after planning. Remote files can also change after planning. This causes stale tasks and `file not found` failures.
- Do remove the record-update race. The current record update logic re-stats local and remote state after task execution. That second read can observe a different state than the task actually applied, so persisted records can drift from the successful mutation.
- Do make each task execute from the concrete data the decider already knows whenever that data is the source of truth.
- Do make each successful task emit the exact sync-record mutation caused by that task.
- Do not keep backward-compatibility layers, fallback update paths, or duplicate record-update logic.

## Current implementation

### Planning and execution

- `src/sync/index.ts`
  - `preparePlan()` builds a task list through `TwoWaySyncDecider`.
  - `start()` confirms, optimizes, executes task chunks, then calls `updateMtimeInRecord(taskChunk, results)`.
  - Auto-sync delete confirmation can rebuild `RemoveLocalTask` into `PushTask` / `MkdirRemoteTask` in `buildReuploadTasks()` and `ensureReuploadParentDir()`.
- `src/sync/decision/two-way.decider.ts`
  - Loads previous local records, previous remote record snapshot, current local walk, current remote walk.
  - Creates concrete task instances through a task factory.
- `src/sync/decision/two-way.decider.function.ts`
  - Compares current local, current remote, and previous record snapshots.
  - Already captures local file bytes for `PushTask` and local file bytes plus abstract file for `RemoveLocalTask`.
  - Still builds most other tasks with path-only or partially-captured data.

### Record updates

- `src/sync/utils/update-records.ts`
  - Re-reads local and remote state after task success with `statVaultItem()` and `statWebDAVItem()`.
  - Infers record mutations from task class type.
  - Handles merged mkdir and merged remote delete tasks specially.
- This centralized update path is the second race source and duplicates task knowledge.

### Task behavior today

- `PushTask` uploads captured bytes.
- `RemoveLocalTask` deletes captured `abstractFile`.
- `PullTask`, `MkdirLocalTask`, `MkdirRemoteTask`, `RemoveRemoteTask`, `RemoveRemoteRecursivelyTask`, `ConflictResolveTask`, and merged task variants still rely on centralized post-task record refresh.
- `ConflictResolveTask` can also fetch fresh local and remote stats during execution.

## Target implementation

### Architecture

- Do make every actionable task own both:
  - the filesystem mutation
  - the sync-record delta caused by that mutation
- Do make the decider pass every concrete input required for safe execution and deterministic record updates.
- Do make `SyncEngine` only plan, confirm, optimize, execute, and apply task-emitted record deltas.
- Do delete `src/sync/utils/update-records.ts` completely.

### Execution contract

- Do extend `TaskResult` so a successful task returns `recordDeltas`.
- Do define a single typed delta model in `src/sync/tasks/task.interface.ts`.
- Do apply those deltas through `SyncRecord` helpers in one place.
- Do not let the engine infer record mutations from task class names anymore.

### Delta rules

- Do return path-removal deltas directly from delete/cleanup tasks.
- Do return sync-path deltas directly from push/pull/mkdir/conflict tasks.
- Do let a task perform any unavoidable final observation immediately after its own write when final stat data cannot be known before execution.
- Do not perform any generic later restat pass.

### Preconditions

- Do make tasks validate planned preconditions before mutating when the source can disappear or change after planning.
- Do fail the task without record update if the planned source no longer matches the task's captured assumptions.
- Do not re-read source content from a path when the decider already captured that content.

## Required implementation details

### 1. Introduce task-owned record deltas

- `src/sync/tasks/task.interface.ts`
  - Do add `TaskRecordDelta` types for:
    - `sync-path`
    - `remove-path`
    - `remove-subtree`
  - Do add `recordDeltas?: TaskRecordDelta[]` to successful `TaskResult`.

- `src/storage/sync-record.ts`
  - Do add `applyDeltaInState()` and `applyDeltasInState()`.
  - Do keep all path normalization and remote/local mutation rules centralized here.
  - Do not let tasks or the engine open-code state mutation logic.

### 2. Remove centralized record refresh

- `src/sync/index.ts`
  - Do remove the `updateMtimeInRecord` import, wrapper method, and chunk call.
  - Do collect `recordDeltas` from successful results after each chunk and apply them through one `syncRecord.mutateState()` call.
  - Do leave retry, cancellation, progress, confirmation, and chunking behavior unchanged.

- `src/sync/utils/update-records.ts`
  - Do delete this file.

### 3. Enrich planner-to-task data

- `src/sync/decision/sync-decision.interface.ts`
  - Do replace path-only task option shapes with task-specific planned inputs.
  - Do add fields for the data a task actually needs, including:
    - planned local stat
    - planned remote stat
    - captured local file bytes
    - captured local abstract file
    - previous record
    - base text when needed
    - planned descendant path payloads for merged tasks
  - Do not keep redundant option types that only force tasks to refetch.

- `src/sync/decision/two-way.decider.ts`
  - Do pass the richer task options through the task factory.

- `src/sync/decision/two-way.decider.function.ts`
  - Do make this file the single place that converts snapshots into:
    - concrete task type
    - captured execution inputs
    - record-update intent
  - Do extend the existing captured-data pattern from `PushTask` and `RemoveLocalTask` to every task that needs it.
  - Do not create path-only tasks when the planning snapshot already has the needed stat or content.

### 4. Refactor each task to emit authoritative deltas

- `src/sync/tasks/push.task.ts`
  - Do keep upload-from-captured-bytes.
  - Do validate the local source still matches the planned source before upload.
  - Do return a `sync-path` delta for local and remote.
  - Do read final remote stat immediately after upload if remote metadata cannot be trusted from planning.

- `src/sync/tasks/remove-local.task.ts`
  - Do validate the captured local target still exists and still matches the planned local item before trashing.
  - Do return `remove-path` for files and `remove-subtree` for folders.

- `src/sync/tasks/pull.task.ts`
  - Do use the planned remote stat as the source contract.
  - Do validate the fetched content against the planned remote size.
  - Do read final local stat immediately after writing and return a `sync-path` delta.

- `src/sync/tasks/mkdir-local.task.ts`
  - Do create the folder.
  - Do read final local stat immediately after creation and return a `sync-path` delta.

- `src/sync/tasks/mkdir-remote.task.ts`
  - Do validate planned local existence before remote mkdir when the folder originated locally.
  - Do create the directory.
  - Do read final remote stat immediately after creation and return a `sync-path` delta.

- `src/sync/tasks/mkdirs-remote.task.ts`
  - Do carry every merged path in the task options.
  - Do return deltas for every created directory, not only the deepest path.
  - Do not lose child record semantics during optimization.

- `src/sync/tasks/remove-remote.task.ts`
  - Do delete the target.
  - Do return `remove-path` or `remove-subtree` directly from task intent.
  - Do not restat remote afterward.

- `src/sync/tasks/remove-remote-recursively.task.ts`
  - Do preserve the full subtree removal represented by merged tasks.
  - Do return `remove-subtree` deltas for all removed paths represented by the merged task.

- `src/sync/tasks/conflict-resolve.task.ts`
  - Do own the final record delta for whichever resolution path succeeds.
  - Do stop depending on centralized restat.
  - Do fetch only the data required to resolve the conflict and then emit the final delta immediately from the task.
  - Do preserve `skipRecord` behavior for explicit skip strategy.

- `src/sync/tasks/clean-record.task.ts`
  - Do return `remove-subtree` directly.

- `src/sync/tasks/noop.task.ts`
  - Do return no deltas.

- `src/sync/tasks/skipped.task.ts`
  - Do return no deltas and keep `skipRecord`.

### 5. Preserve semantics across optimizer and confirmation rebuilds

- `src/sync/utils/merge-mkdir-tasks.ts`
  - Do merge mkdir tasks without dropping per-path delta payloads.
  - Do preserve all local/remote path mappings required for record updates.

- `src/sync/utils/merge-remove-remote-tasks.ts`
  - Do merge remove tasks without dropping subtree intent for descendants.

- `src/sync/index.ts` (`buildReuploadTasks()` and `ensureReuploadParentDir()`)
  - Do rebuild re-upload tasks from already-captured task options whenever possible.
  - Do only fetch local state when constructing a brand-new task that was not present in the original plan.
  - Do attach the same planned-input and delta semantics as the decider-created tasks.
  - Do not recreate `PushTask` or `MkdirRemoteTask` from incomplete options.

## Files related and what to change

### Core orchestration

- `src/sync/index.ts`
  - Remove centralized record-update calls.
  - Apply `recordDeltas` from task results.
  - Keep chunk execution flow.
  - Fix reupload rebuilds to preserve captured task inputs.

### Decision layer

- `src/sync/decision/sync-decision.interface.ts`
  - Redefine task option contracts around planned inputs.
- `src/sync/decision/two-way.decider.ts`
  - Wire new option types into task creation.
- `src/sync/decision/two-way.decider.function.ts`
  - Capture all task execution data during planning.

### Task contracts and implementations

- `src/sync/tasks/task.interface.ts`
  - Add `TaskRecordDelta` and `recordDeltas` to `TaskResult`.
- `src/sync/tasks/push.task.ts`
  - Emit task-owned sync delta.
- `src/sync/tasks/pull.task.ts`
  - Emit task-owned sync delta.
- `src/sync/tasks/remove-local.task.ts`
  - Emit task-owned removal delta.
- `src/sync/tasks/remove-remote.task.ts`
  - Emit task-owned removal delta.
- `src/sync/tasks/remove-remote-recursively.task.ts`
  - Emit merged subtree-removal deltas.
- `src/sync/tasks/mkdir-local.task.ts`
  - Emit task-owned sync delta.
- `src/sync/tasks/mkdir-remote.task.ts`
  - Emit task-owned sync delta.
- `src/sync/tasks/mkdirs-remote.task.ts`
  - Emit all merged mkdir deltas.
- `src/sync/tasks/conflict-resolve.task.ts`
  - Emit task-owned final delta.
- `src/sync/tasks/clean-record.task.ts`
  - Emit cleanup delta.
- `src/sync/tasks/noop.task.ts`
  - Return no deltas.
- `src/sync/tasks/skipped.task.ts`
  - Return no deltas.

### State persistence

- `src/storage/sync-record.ts`
  - Add delta application helpers.
  - Keep normalization and mutation semantics centralized.

### Obsolete code to remove

- `src/sync/utils/update-records.ts`
  - Delete.

### Optimizer integration

- `src/sync/utils/merge-mkdir-tasks.ts`
  - Preserve child-path delta intent.
- `src/sync/utils/merge-remove-remote-tasks.ts`
  - Preserve subtree removal intent.

## Invariants

- Do update sync records only from successful task-owned deltas.
- Do not re-scan local or remote state in a later generic record-update phase.
- Do not let merged tasks lose the semantics of the original tasks they replace.
- Do not let the engine infer filesystem truth after the task has already finished.
- Do fail safely when a task precondition is no longer true.

## Execution order

1. Do add the delta contract and `SyncRecord` delta appliers.
2. Do update `SyncEngine` to consume task deltas.
3. Do convert simple cleanup/delete tasks first.
4. Do convert push/remove-local next, keeping captured-input validation.
5. Do convert mkdir tasks and merged-task optimizers.
6. Do convert pull and conflict resolution last, with immediate post-write observation inside the task.
7. Do delete `src/sync/utils/update-records.ts` and all references immediately after task-owned deltas are in place.

## Done criteria

- Every task that mutates sync state returns authoritative `recordDeltas` on success.
- `SyncEngine` applies only those deltas.
- No code path calls `statVaultItem()` or `statWebDAVItem()` from a generic post-task record updater.
- Reupload confirmation rebuilds preserve the same robustness guarantees as decider-created tasks.
- `src/sync/utils/update-records.ts` no longer exists.
