# Sync record + remote record refactor plan

## Feasibility assessment

Feasible with one hard caveat: "numb" sync cannot be fully equivalent to a fresh two-way sync, because it intentionally skips remote traversal and therefore cannot detect remote-side changes that happened after the last normal sync. The design is still robust if that tradeoff is explicit and limited to realtime local sync-on-change when the new default-on user-configurable option is enabled. Normal sync remains the correctness anchor.

## Current implementation

### State model

- `src/storage/sync-record.ts`
  - Persists `Map<string, SyncRecordModel>` in `syncRecordKV`.
  - Each record stores `{ local, remote, base? }` for a path.
- `src/model/sync-record.model.ts`
  - `SyncRecordModel` is path-local and path-remote stat plus optional blob base key.
- `src/utils/traverse-webdav.ts`
  - Persists remote traversal cache separately in `traverseWebDAVKV` as `{ queue, nodes }`.
  - Supports resumable BFS traversal and complete-cache reuse.
- `src/services/cache.service.v1.ts` + `src/settings/cache.ts`
  - Export/import/clear UI currently targets traversal cache only.

### Planning and execution

- `src/sync/decision/two-way.decider.ts`
  - Planning reads three sources in parallel: sync records, local walk, remote walk.
- `src/sync/decision/two-way.decider.function.ts`
  - Full 3-way reconciliation: current local vs current remote vs last sync record.
  - Folder logic depends on full descendant enumeration, not folder mtime.
- `src/sync/index.ts`
  - `preparePlan()` always uses `remoteFs.walk()` defaulting to cached traversal reuse.
  - `ensureRemoteBaseDirReady()` clears sync records and traversal cache together when remote root is missing.
  - After each chunk, `updateMtimeInRecord()` re-traverses remote fresh and rewrites records from actual post-task state.
- `src/sync/utils/update-records.ts`
  - Performs an expensive full fresh remote walk after each chunk, then updates sync records.

### Triggering / scheduling

- `src/services/realtime-sync.service.ts`
  - Plain 8s debounce, then waits for idle and runs auto sync.
- `src/services/scheduled-sync.service.ts`
  - Startup sync and interval sync both trigger auto sync.
- `src/services/sync-executor.service.ts`
  - Rejects if already syncing; no request batching or mode escalation.
- `src/services/command.service.ts` and `src/components/SyncRibbonManager.ts`
  - Manual sync bypasses executor and constructs `SyncEngine` directly.

## Target implementation

### 1. Collapse traversal cache and remote record into one persisted remote record object

Replace the split model with one combined sync state object, keyed per vault + remote base dir, for example:

- `remoteRecord`
  - `queue: string[]`
  - `nodes: Record<string, StatModel[]>`
  - `isComplete: boolean`
  - `lastNormalSyncAt?: number`
  - `source?: 'normal-sync' | 'task-updated' | 'imported'`
- `localRecords: Map<string, { local: StatModel; base?: { key: string } }>`

Rules:

- `remoteRecord.nodes` is both:
  - the resumable traversal state, and
  - the last known remote snapshot used as the remote side of the last-sync record.
- `localRecords` is the local half of the last-sync record.
- The old per-path `record.remote` field is removed from the canonical store; remote last-sync state is derived from `remoteRecord`.
- Remote record export/import uses the existing remote cache flow and remote cache dir, but now exports/imports the combined remote record object rather than the old traversal-cache-only payload.

### 2. Introduce explicit sync run kind separate from manual/auto UI mode

Keep `SyncStartMode` for UI/confirmation (`MANUAL_SYNC` vs `AUTO_SYNC`), and add a second dimension for planning policy, e.g.:

- `SyncRunKind.NORMAL`
- `SyncRunKind.NUMB`

Mapping:

- manual sync: always `NORMAL`
- startup sync: `NORMAL`
- periodic sync: `NORMAL`
- realtime local sync-on-change (`create` / `delete` / `rename` / `modify`):
  - `NUMB` when new default-on setting is enabled
  - `NORMAL` when disabled

### 3. Planning rules

#### Normal sync

- Always walk local.
- Always perform exactly one fresh remote traversal.
- Save traversal result back into `remoteRecord` and mark it complete.
- Build current remote stats from the fresh traversal result.
- Build last-sync record from:
  - remote side = `remoteRecord` snapshot from before planning starts
  - local side = `localRecords`

Implementation detail: planning needs both the previous remote snapshot and the current fresh traversal during a normal sync. That means the planner should receive:

- `previousRemoteStats`
- `currentRemoteStats`
- `previousLocalRecords`
- `currentLocalStats`

instead of reading one `SyncRecordModel` map that already embeds both sides.

#### Numb sync

- Always walk local.
- Never traverse remote.
- Use `remoteRecord` as both:
  - last-sync remote record, and
  - current remote snapshot assumption.
- Run full two-way decision logic against that assumed remote state.

This preserves the user's requested behavior, but the caveat must remain documented: concurrent remote edits/deletes/renames since the last normal sync are invisible during numb sync.

### 4. Record maintenance during execution

Remove the current "fresh remote walk after each chunk" update strategy.

Replace it with task-driven updates:

- On successful remote mutation tasks (`PushTask`, `MkdirRemoteTask`, merged mkdir, remote remove tasks, conflict tasks that write remote), update `remoteRecord` immediately.
- On successful local mutation tasks (`PullTask`, `MkdirLocalTask`, `RemoveLocalTask`, conflict tasks that write local), update `localRecords` immediately.
- For tasks affecting both sides, update both halves together.
- `CleanRecordTask` becomes cleanup of stale local-record entries and remote-record paths.

Needed invariant:

- After every successful task, the persisted combined state must reflect the plugin's best known post-task state without requiring a full remote re-scan.

To keep this robust, add remote-record helper APIs for:

- upsert one remote path
- remove one remote path
- remove subtree
- expand merged mkdir updates
- rebuild flat remote-path map from `nodes` when needed

### 5. Request batching / post-calling throttler

Replace the current realtime debounce + executor early-return behavior with a request aggregator service.

Behavior:

- Every trigger submits a request `{ startMode, runKind, requestedAt, source }`.
- Requests accumulate while:
  - the debounce window has not yet elapsed since the latest request, or
  - a sync is currently running.
- The next batch starts only when:
  1. at least debounce time has passed since the latest request
  2. no sync is currently running
- Batch reduction:
  - if any pending request is `NORMAL`, run one `NORMAL` batch
  - else run one `NUMB` batch
- Manual sync should bypass batching or force immediate `NORMAL` execution after the current run finishes.

This scheduler should become the single fan-in point for:

- realtime triggers
- startup sync
- periodic sync
- manual command/ribbon triggers

## Files related and what to change

### Storage / models

- `src/model/sync-record.model.ts`
  - Replace current embedded `{ local, remote, base }` shape with local-only record pieces and add new combined-state model(s).
- `src/storage/kv.ts`
  - Remove separate traversal-cache KV or migrate it to the new combined-state store.
  - Keep one persisted object that contains `remoteRecord` resumable traversal state plus `localRecords`.
- `src/storage/sync-record.ts`
  - Replace with a higher-level state DAO, e.g. still named `SyncRecord` or renamed `SyncStateStore`.
  - Add APIs for reading/writing:
    - whole combined state
    - remote record traversal state
    - local record entries
    - per-task path mutations

### Remote traversal / filesystem

- `src/utils/traverse-webdav.ts`
  - Stop persisting to a standalone traversal cache store.
  - Read/write traversal `queue` and `nodes` through the combined remote record object.
  - Keep resumable BFS semantics intact.
- `src/fs/webdav.ts`
  - Support two sources for remote stats:
    - fresh traversal
    - remote record snapshot only
  - Add an explicit option for numb mode instead of overloading current freshness flag.
- `src/utils/get-db-key.ts`
  - Unify sync-state keying so the combined object is keyed consistently.
  - Decide whether account/token changes should invalidate only remote record or the whole combined state; document the rule in code.

### Decision engine

- `src/sync/decision/two-way.decider.ts`
  - Stop assuming one map already contains both previous local and previous remote state.
  - Load combined state and pass separated previous/current snapshots to the pure decider.
- `src/sync/decision/two-way.decider.function.ts`
  - Refactor input shape from `syncRecords` to explicit previous-local / previous-remote state.
  - Keep current conflict logic, folder logic, and skipped-task logic unchanged as much as possible.
  - Rework orphan-record cleanup to operate on combined-state leftovers.

### Sync engine / task updates

- `src/sync/index.ts`
  - Add run-kind parameter (`NORMAL` / `NUMB`) alongside start mode.
  - `preparePlan()` should choose remote source based on run kind.
  - `ensureRemoteBaseDirReady()` should clear/reset the combined state instead of two stores.
  - Replace chunk-end full re-scan updates with task-driven combined-state updates.
- `src/sync/utils/update-records.ts`
  - Either remove entirely or repurpose into synchronous task-result application helpers.
- `src/sync/tasks/*.ts`
  - Audit all tasks that mutate remote or local state.
  - Ensure task results carry enough info for deterministic combined-state updates, especially:
    - push/pull
    - mkdir remote / merged mkdir
    - remove remote / recursive remove remote
    - remove local
    - conflict resolution tasks
    - clean record

### Triggering / scheduling / settings

- `src/services/realtime-sync.service.ts`
  - Stop owning the debounce logic directly.
  - Submit requests for local `create` / `delete` / `rename` / `modify` events.
  - Use `NUMB` when the new default-on fast-sync setting is enabled; otherwise use `NORMAL`.
- `src/services/scheduled-sync.service.ts`
  - Submit `NORMAL` requests instead of directly executing.
- `src/services/sync-executor.service.ts`
  - Either become the aggregator or be wrapped by a new `SyncRequestService` / `SyncSchedulerService`.
  - Accept both start mode and run kind.
- `src/services/command.service.ts`
  - Route manual command through the common scheduling/execution path with forced `NORMAL`.
- `src/components/SyncRibbonManager.ts`
  - Same as command service.
- `src/settings/index.ts`
  - Add new setting, default on, e.g. `useFastSyncOnLocalChange: boolean`.
- `src/settings/common.ts`
  - Add UI toggle and localized copy explaining the tradeoff.
  - Toggle behavior: if enabled, local sync-on-change events use `NUMB`; if disabled, they use `NORMAL`.
- `src/i18n/locales/en.ts` and `src/i18n/locales/zh.ts`
  - Add strings for the new option and update cache wording from traversal-cache-centric to remote-record-centric.

### Cache export/import / clearing

- `src/services/cache.service.v1.ts`
  - Export/import the new combined remote record object format.
  - Version the payload so old traversal-cache exports can either be migrated or rejected cleanly.
- `src/settings/cache.ts`
  - Rename user-facing wording from traversal cache to remote record where appropriate.
- `src/components/CacheClearModal.ts`
  - Clear combined state pieces coherently; no more separate traversal-cache clear path if stores are collapsed.

## Phased refactor progress

Phase 1 is currently done.

### Phase 1: State-model consolidation

- Introduce combined sync-state schema and DAO.
- Move traversal `queue` + `nodes` into the combined remote record object.
- Add migration path from old `syncRecordKV` + `traverseWebDAVKV` data.
- Update cache export/import and clear/reset flows to use the new remote record object.

### Phase 2: Decider and engine split by run kind

- Refactor planning inputs to separate previous remote snapshot, previous local snapshot, current local stats, and current remote stats.
- Add `NORMAL` vs `NUMB` run kind.
- Keep normal sync behavior equivalent to current full two-way sync.
- Implement numb sync by sourcing current remote stats from remote record only.

### Phase 3: Task-driven state updates

- Remove the post-chunk fresh remote re-traversal in `updateMtimeInRecord()`.
- Add deterministic helpers to mutate combined state after successful task execution.
- Audit all tasks and merged-task cases to keep remote record and local records aligned after success.

### Phase 4: Request batching and trigger integration

- Add a single post-calling throttler / request aggregator.
- Route realtime, startup, periodic, and manual triggers through it.
- Implement batch reduction: `NORMAL` wins over `NUMB`.
- Add the default-on fast-sync-on-local-change setting and update related UI text.

## Caveats

- Numb sync is intentionally optimistic. It cannot see remote changes since the last normal sync, so it can overwrite unseen remote edits or miss remote deletes/renames until the next normal sync.
- Folder semantics are the riskiest part, because current folder decisions rely on descendant enumeration. The implementation will work, but numb mode must accept that folder reconciliation is based on stale remote knowledge.
- Manual/startup/periodic sync should stay normal-only; they are the correctness reset points.
- The combined state store needs careful migration and invalidation rules when vault name, remote base dir, or account identity changes.
- Export/import becomes more sensitive than today's traversal cache export because the payload now influences sync decisions, not just performance. Version the format and validate aggressively.
- Removing the post-task fresh re-traversal cuts a major cost, but task-result updates must be comprehensive; missing even one remote mutation path will poison future numb syncs.
