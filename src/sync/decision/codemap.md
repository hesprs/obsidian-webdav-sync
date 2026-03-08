# src/sync/decision

## Responsibility

Transforms local/remote/record snapshots into a deterministic, ordered task plan for two-way sync.

## Design Patterns

- Abstract decider contract in `BaseSyncDecider`.
- Class-wrapper + pure-function split (`TwoWaySyncDecider` + `twoWayDecider`) for testability.
- Factory-based task construction to keep branch rules independent from task class details.
- Rule-engine style branching by path state, mtimes, content deltas, limits, and policy settings.

## Data & Control Flow

1. `TwoWaySyncDecider.decide()` loads local walk, remote walk, and sync records.
2. Builds lookup maps and comparators (base-content fetch + content equality checks).
3. `twoWayDecider()` evaluates every unified path under ignore/filter rules.
4. Produces file actions (pull/push/remove/conflict/noop/skip/clean-record/filename-error).
5. Produces folder actions using descendant-change and ignored-content checks.
6. Returns ordered `BaseTask[]` to `SyncEngine`.

## Integration Points

- Upstream: `src/sync/index.ts` planner call site.
- Downstream: `src/sync/tasks/*.task.ts` via task factory callbacks.
- Inputs: fs walk outputs, sync records, blob store base versions.
- Utilities: path conversion/time comparison/ignore helpers.
- Settings: conflict strategy, size limits, sync mode toggles.

## Key Files

- `two-way.decider.ts` — decider class and input preparation.
- `two-way.decider.function.ts` — core decision rules.
- `base.decider.ts` — abstract planner base.
- `sync-decision.interface.ts` — contracts/options/factory types.
- `has-folder-content-changed.ts` — folder-delta helper.
