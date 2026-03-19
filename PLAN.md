# Offline planning status bug fix plan

## Investigation result

- The stale status comes from `SyncExecutorService.executeSync()` emitting `queued` -> `planning` and then awaiting `sync.preparePlan()` without a catch.
- When the app is offline, `preparePlan()` fails inside `SyncEngine.ensureRemoteBaseDirReady()` through `retryWebDAVCall()`.
- That failure escapes before `SyncEngine.start()` runs, so no terminal `SyncRunSnapshot` is emitted.
- `ObservabilityService` keeps the UI in the last non-terminal stage, so the status bar stays on “Preparing sync” and `plugin.isSyncing` stays true.
- `retryWebDAVCall()` currently throws `new Error('Sync Aborted')` for both real cancellation and retry exhaustion, so cancellation and failure are incorrectly merged.

## Fix plan

1. **Do make the executor close the planning phase.**
   - Add one terminal-run finalization path in `src/services/sync-executor.service.ts` around the entire pre-`sync.start()` flow.
   - Do emit `cancelled` when planning is cancelled.
   - Do emit `failed` when planning throws any real error.
   - Do not allow `preparePlan()` errors to escape without emitting a terminal snapshot.

2. **Do separate cancellation from failure with explicit error types.**
   - Introduce dedicated sync errors for cancellation and retry exhaustion.
   - Do throw a cancellation error when the user aborts during planning.
   - Do throw a retry-exhausted failure error when WebDAV retries are exhausted offline.
   - Do preserve the original error as the cause for failure cases.
   - Do not keep using `Error('Sync Aborted')` for multiple meanings.

3. **Do make planning cancellation use one mechanism only.**
   - Update `SyncEngine.preparePlan()` and `ensureRemoteBaseDirReady()` to terminate planning by throwing the cancellation error.
   - Do not mix “return empty plan”, “return early”, and “throw generic abort error” for the same cancellation path.
   - Remove the executor-side `if (sync.isCancelled)` branch after `preparePlan()`, because consistent cancellation exceptions make that branch redundant.

4. **Do simplify `retryWebDAVCall()` into a strict contract.**
   - Do rethrow non-retryable errors immediately.
   - Do throw the cancellation error when cancellation is observed.
   - Do throw the retry-exhausted error after the final retry fails.
   - Do not `break` and fall through without returning or throwing.

5. **Do centralize terminal snapshot construction.**
   - Extract the current terminal snapshot update logic into one shared helper used by both executor planning failures and engine execution failures.
   - Do keep lifecycle ownership simple: executor owns `queued` and `planning`; engine owns `awaiting_confirmation` and `executing`.
   - Do not duplicate terminal-state shaping and logging logic in multiple places.

6. **Do keep the UI contract unchanged and let it recover automatically.**
   - Keep `ObservabilityService` driven only by `SyncRunSnapshot.stage`.
   - Once terminal snapshots are emitted correctly, the status bar, ribbon state, modal state, and `plugin.isSyncing` will recover without extra UI-specific patches.
   - Do not add special offline UI resets; fix the lifecycle source instead.

## Result after the refactor

- Offline failure during planning ends as `failed`, not a stuck “Preparing sync” state.
- User cancellation during planning ends as `cancelled`.
- Status bar and sync controls always leave the active-sync state.
- Cancellation and network failure are represented cleanly and no redundant planning branches remain.
