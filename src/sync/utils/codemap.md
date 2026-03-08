# src/sync/utils

## Responsibility

Provides sync-specific helper functions for task-list optimization, path eligibility checks, ignored-content handling, and post-run record updates.

## Design Patterns

- Predicate helpers for gating behavior (`is-mergeable-path`, `has-ignored-in-folder`).
- Reducer/aggregation transforms for batch optimization (`merge-mkdir-tasks`, `merge-remove-remote-tasks`).
- Stateless utility style: functions accept inputs and return transformed outputs.

## Data & Control Flow

1. Engine/planner emits raw tasks and path context.
2. Predicate utilities decide whether a path can be merged or should be skipped.
3. Merge utilities collapse redundant mkdir/remove operations.
4. `update-records` persists mtime/state changes after successful task execution.

## Integration Points

- Called by `src/sync/index.ts` during pre-exec optimization and post-exec persistence.
- Consumes task types from `src/sync/tasks/*`.
- Uses sync record storage APIs and path helpers from shared utils.

## Key Files

- `merge-mkdir-tasks.ts` — removes redundant directory creation operations.
- `merge-remove-remote-tasks.ts` — batches/optimizes remote deletions.
- `is-mergeable-path.ts` — merge eligibility gate.
- `has-ignored-in-folder.ts` — ignored-descendant detection.
- `update-records.ts` — sync record update helper.
