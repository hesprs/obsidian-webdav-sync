# src/sync/utils

## Responsibility

Holds sync-runtime helper logic for task optimization, merge eligibility/ignored-path predicates, and deterministic post-task sync-state mutation.

## Design Patterns

- Pure predicates (`is-mergeable-path`, `has-ignored-in-folder`).
- Task-list rewrite passes:
  - `mergeMkdirTasks`: `MkdirRemoteTask[]` -> `MkdirsRemoteTask[]` by hierarchy grouping.
  - `mergeRemoveRemoteTasks`: collapse nested remote deletes into top-level `RemoveRemoteRecursivelyTask`.
- Task-driven state mutation pipeline in `update-records.ts` using explicit `TaskStateUpdate` variants.

## Data & Control Flow

1. Planner/engine produce raw task list.
2. Optimization helpers rewrite redundant mkdir/remove task sequences.
3. After execution, `updateMtimeInRecord()` filters successful non-`skipRecord` tasks.
4. Each task type is mapped to one or more state updates:
   - subtree removal,
   - path sync (stat local/remote, optionally capture `baseText` for mergeable files).
5. Updates are applied in `SyncRecord.mutateState()` batches, with progress events emitted per chunk.

## Integration Points

- Called by `SyncEngine` (`src/sync/index.ts`) before execution and after each chunk.
- Relies on task class taxonomy in `src/sync/tasks/*`.
- Uses storage mutation primitives from `src/storage/sync-record.ts` (`upsert/remove path`, subtree removal).
- Uses shared stat/path helpers from `src/utils/*` and markdown mergeability policy (`src/utils/mime`).

## Key Files

- `update-records.ts` — canonical record update application logic.
- `merge-mkdir-tasks.ts` / `merge-remove-remote-tasks.ts` — pre-execution optimization passes.
- `has-ignored-in-folder.ts` / `is-mergeable-path.ts` — planning predicates.
