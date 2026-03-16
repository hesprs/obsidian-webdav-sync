# src/sync/core

## Responsibility

Implements merge primitives used by conflict tasks: timestamp-based winner selection and text 3-way merge helpers.

## Design Patterns

- Strategy functions with explicit contracts:
  - `resolveByLatestTimestamp()` for mtime-first resolution.
  - `resolveByIntelligentMerge()` for textual merge.
- Typed outcome enums/interfaces (`LatestTimestampResolution`, `IntelligentMergeResult`) to keep task-level branching deterministic.
- Ordered fallback pipeline: `node-diff3` line merge first, then `diff-match-patch` patch application.

## Data & Control Flow

1. Conflict task supplies local/remote/base payloads.
2. Timestamp strategy compares mtime, then content equality (`isEqual`) to avoid redundant writes.
3. Intelligent strategy short-circuits identical content, then runs diff3 merge.
4. If diff3 contains unresolved regions, patch synthesis/application is attempted.
5. Result object signals success + merged payload (or unresolved failure) back to `ConflictResolveTask`.

## Integration Points

- Primary caller: `src/sync/tasks/conflict-resolve.task.ts`.
- Dependencies: `node-diff3`, `diff-match-patch`, `lodash-es/isEqual`.
- Mergeability policy is enforced by task layer (`isMergeablePath`) before calling intelligent merge.

## Key Files

- `merge-utils.ts` — exported merge strategies and result types.
