# src/sync

## Responsibility

Owns end-to-end sync execution: convert vault/server state into ordered tasks, execute with retry/confirmation rules, and publish sync outcomes.

## Design Patterns

- Orchestrator/Façade: `SyncEngine` centralizes planning, optimization, execution, and reporting.
- Command pattern: `tasks/*` classes encapsulate one executable sync action each.
- Strategy split: `decision/*` computes task plans independently from execution.
- Pipeline optimization: utility passes merge/reorder task lists before execution.

## Data & Control Flow

1. `SyncEngine.start()` builds runtime context (local fs, remote fs, records, settings).
2. `TwoWaySyncDecider.decide()` generates raw `BaseTask[]` from local/remote/record snapshots.
3. Engine prompts user when destructive actions require confirmation.
4. Task list is optimized (`mergeMkdirTasks`, `mergeRemoveRemoteTasks`) and chunked.
5. Tasks execute with retry guards; results are collected and failures surfaced.
6. Successful task outcomes update sync records and emit progress/end events.

## Integration Points

- `src/fs/*` for local and WebDAV filesystem operations.
- `src/storage/sync-record.ts` and blob storage for stateful conflict handling.
- `src/events/*` for sync lifecycle emission.
- Obsidian UI APIs for notices/modals around errors and confirmations.

## Key Files

- `index.ts` — `SyncEngine` orchestration and execution loop.
- `decision/two-way.decider.ts` — planner entrypoint.
- `decision/two-way.decider.function.ts` — deterministic decision rules.
- `tasks/task.interface.ts` — task contracts/result types.
- `utils/update-records.ts` — post-task record persistence.
