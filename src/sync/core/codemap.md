# src/sync/core

## Responsibility

Provides low-level merge/conflict primitives used by sync tasks to reconcile divergent local/remote file content safely.

## Design Patterns

- Strategy-style resolution helpers for timestamp-first vs intelligent 3-way merge behavior.
- Typed result objects representing merge outcomes (`NoChange`, choose-side, merged-content, hard-conflict).
- Fallback chain: conservative line merge first, then character-level patch attempt.

## Data & Control Flow

1. Input layer receives local/remote/base content plus metadata.
2. Fast equality and timestamp checks short-circuit when possible.
3. `node-diff3` line merge attempts deterministic auto-resolution.
4. On unresolved conflicts, fallback logic attempts patch-based convergence.
5. Caller receives typed outcome consumed by `ConflictResolveTask`.

## Integration Points

- Called from `src/sync/tasks/conflict-resolve.task.ts`.
- Uses `node-diff3` and `diff-match-patch` for merge mechanics.
- Shares equality/typing conventions with sync/task interfaces.

## Key Files

- `merge-utils.ts` — conflict resolution and merge algorithms.
- `merge-utils.test.ts` — behavior tests for merge edge cases.
