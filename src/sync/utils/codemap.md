# src/sync/utils/

## Responsibility

Utility layer for sync planning and execution. It contains small pure helpers, file/chunk comparison helpers, and task-organization utilities used to decide, merge, batch, and order sync work.

## Design

- Most helpers are pure and side-effect free.
- `array-utils.ts` provides tiny array primitives (`getLast`, `getAndDeleteAt`) used by batching code.
- `is-same-time.ts`, `is-mergeable-path.ts`, and `is-changed.ts` encapsulate sync comparisons.
- `merge.ts` resolves content conflicts by timestamp or diff3 merge.
- `split-chunks.ts` builds ranged-download chunks while skipping cached ranges.
- `merge-remove-tasks.ts`, `sort-mkdir-tasks.ts`, `limit-push-pull-tasks.ts`, and `optimize-tasks.ts` transform task lists into efficient execution groups.

## Flow

1. Decision code classifies local/remote records and calls helpers like `isChanged` and `isMergeablePath` to choose task types.
2. Merge/pull/push tasks use `resolveByLatestTimestamp`, `resolveByIntelligentMerge`, and `splitChunks` to resolve content and download large files.
3. `optimizeTasks` deduplicates tasks, groups them by type, merges delete tasks into recursive deletes, orders mkdir work by depth, and batches push/pull tasks under chunk/throughput limits.
4. `sync/index.ts` consumes the optimized task groups and executes them batch by batch.

## Integration

- Consumed by `src/sync/decision/two-way.decider.function.ts` for change detection and mergeability checks.
- Consumed by `src/sync/tasks/merge.task.ts`, `pull.task.ts`, and `push.task.ts` for merge resolution and chunked downloads.
- Consumed by `src/sync/index.ts` through `optimize-tasks.ts` to build the final execution plan.
- Depends on task classes and shared sync types, but keeps the transformation logic isolated from task execution.
