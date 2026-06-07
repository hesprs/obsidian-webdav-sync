# src/sync/decision/

## Responsibility

Build the sync plan from current local state, current remote state, and persisted sync records.
This folder defines the decision contract and the two-way planning implementation that turns file/folder
state differences into executable tasks.

## Design

`sync-decision.interface.ts` is the shared contract. `SyncDecisionInput` carries the stat maps,
records, remote base directory, settings, and a `TaskFactory` used to construct tasks without
coupling the decider to task classes.

`two-way.decider.function.ts` is the core strategy. It walks the union of local, remote, and record
paths, classifies each path as file, folder, file/folder conflict, or orphaned record, then maps each
case to task creation.

The strategy is mostly table-driven: each case name resolves to a small operation that pushes one or
more tasks. Conflict handling is delegated to `ConflictStrategy` and `UnmergeableStrategy`, with
merge fallback only used when paths are mergeable.

## Flow

1. `TwoWaySyncDecider.decide()` loads records, traverses local vault state, and resolves remote
   state either by fast record extraction or a full WebDAV walk.
2. It assembles `SyncDecisionInput` and a `TaskFactory` bound to concrete task classes.
3. `twoWayDecider()` compares local/remote/record presence and change status, then emits tasks such
   as pull, push, merge, mkdir, remove, add-record, or clean-record.
4. Orphaned records become clean-up tasks; file/folder type conflicts throw immediately.

## Integration

`src/sync/index.ts` instantiates `TwoWaySyncDecider` during plan preparation.
The returned task list is consumed by `SyncEngine` for confirmation, optimization, progress
reporting, and execution.

Task types used here live in `src/sync/tasks/` and all share the base task contract defined by
`task.interface.ts`.
