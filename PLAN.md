## Problem

After the recent optimization, every sync can propose deleting local notes as "deleted remotely" even when the remote copy still exists.

## What was broken

The optimization removed the post-sync full remote refresh from `src/sync/utils/update-records.ts`, but that refresh was also acting as the only implicit invalidation/refresh of the cached WebDAV traversal.

Current behavior now looks like this:

1. `TwoWaySyncDecider` plans from `this.sync.remoteFs.walk()`.
2. `RemoteWebDAVFileSystem.walk()` uses traversal freshness `cached-ok` by default.
3. Successful remote-mutating tasks (`PushTask`, `MkdirRemoteTask`, `MkdirsRemoteTask`, `RemoveRemoteTask`, `RemoveRemoteRecursivelyTask`, and some `ConflictResolveTask` paths) change the remote state.
4. `updateMtimeInRecord()` now updates sync records via per-path `stat`, but it does **not** refresh or invalidate the traversal cache.
5. On the next sync, planning can read a stale remote snapshot and conclude that many local files are missing remotely.
6. With existing records, `twoWayDecider` interprets `local exists + remote missing + local unchanged` as `RemoveLocalTask`, which is exactly the bad prompt the user sees.

So the regression is not mainly in record-writing correctness. It is in **breaking the contract between remote mutations and the cached remote snapshot used by the planner**.

## Root cause

We accidentally coupled two responsibilities before:

- **record finalization**
- **remote traversal cache refresh**

The old expensive `walk({ freshness: 'fresh' })` handled both at once.
The new implementation kept the first responsibility and dropped the second one.

## Elegant fix direction

Do **not** restore the expensive end-of-sync full remote walk.

Instead, make cache coherence explicit:

### Phase 1: Safe immediate fix

Invalidate the traversal cache whenever a sync chunk contains a successful task that mutates the remote side.

Implementation direction:

1. Add a small helper in `src/sync/index.ts` (or a nearby sync utility) that detects whether successful results include a remote mutation.
2. Treat these task types as remote-mutating:
   - `PushTask`
   - `MkdirRemoteTask`
   - `MkdirsRemoteTask`
   - `RemoveRemoteTask`
   - `RemoveRemoteRecursivelyTask`
   - `ConflictResolveTask` **only when it actually wrote to remote**
3. After `updateMtimeInRecord(tasks, results)` for a chunk, call `clearTraversalCache()` once if that chunk mutated remote state.
4. Keep the new per-path record update logic; do not reintroduce the full fresh traversal.

Why this is the right immediate fix:

- cheap: cache invalidation is much cheaper than a full remote walk
- safe: next planning pass is forced to rebuild remote truth
- minimal: preserves the latency win from removing the end-of-sync traversal
- understandable: fixes the actual stale-cache contract instead of masking symptoms

## Required refactor for correctness and clarity

The current codebase does not expose whether a task mutated remote state. That should be made explicit.

### Phase 2: Make mutation effects explicit

Refactor task results so cache invalidation is driven by facts, not `instanceof` guesses.

Suggested shape:

- extend `TaskResult` with sync-side effects metadata, e.g.
  - `mutatedRemote?: boolean`
  - `mutatedLocal?: boolean`
  - optionally `remoteWriteConfirmed?: boolean`

Then:

1. each task reports its effects in `exec()`
2. `SyncEngine` aggregates effects per chunk
3. record updating, cache invalidation, and later optimizations all consume the same effect metadata

This is cleaner than encoding behavior in orchestration with repeated task-type checks.

Special note on `ConflictResolveTask`:

- some successful resolutions only update local
- some update both local and remote
- some are no-op

That makes it the strongest reason to prefer explicit effect metadata over `instanceof ConflictResolveTask`.

## Simplification / cleanup opportunities

Once Phase 1 is in place, simplify around it:

1. Move remote-cache maintenance out of `update-records.ts` entirely.
   - That file should only finalize sync records.
   - Traversal cache lifecycle belongs to sync orchestration / remote snapshot management.
2. Introduce a tiny sync utility such as `didMutateRemote(tasks, results)` or, after refactor, `chunkEffects.mutatedRemote`.
3. Keep the single final `syncRecord.setRecords(records)` write; that simplification was good and should remain.
4. Keep per-path remote `stat` for touched paths; that is still the right replacement for the old full-vault walk.

## Validation plan

1. Reproduce with an existing synced vault:
   - run sync once after a push-heavy sync
   - run sync again immediately
   - verify no mass `RemoveLocalTask` proposals appear
2. Add focused tests around planning + stale cache behavior:
   - cached remote snapshot missing a file that was just pushed
   - next sync must not interpret it as remote deletion after cache invalidation
3. Add a test for remote deletions still working correctly:
   - actual remote removal should still produce `RemoveLocalTask` when local is unchanged
4. Run:
   - `pnpm lint`
   - `pnpm check`
   - relevant sync tests if present

## Proposed implementation order

1. Add immediate traversal cache invalidation after successful remote-mutating chunks.
2. Add regression coverage for the stale-cache false-deletion scenario.
3. Refactor task effects into explicit metadata.
4. Replace orchestration-side task-type detection with effect-based invalidation.

## Summary

The performance optimization was directionally correct, but it removed an implicit cache-refresh side effect that the planner was relying on. The elegant fix is to keep the fast per-path record update and make remote traversal cache invalidation an explicit, cheap, post-mutation step.
