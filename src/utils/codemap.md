# src/utils

## Responsibility

Provides cross-cutting runtime primitives used by sync/fs/services: traversal, sync-state identity keys, locking, stat adapters, request wrappers, hashing, path relation checks, and async timing helpers.

## Design Patterns

- Focused utility modules with explicit platform adapters (`Vault`/WebDAV -> `StatModel`).
- Stateful resumable traversal object (`ResumableWebDAVTraversal`) backed by persisted queue+node snapshots.
- Concurrency controls:
  - global API limiter (`api-limiter.ts`) for WebDAV directory listing pressure,
  - keyed mutex (`mutex.ts`) to serialize traversal operations per sync-state key.
- Guarded request wrapper (`request-url.ts`) that normalizes Obsidian request behavior and error semantics.

## Data & Control Flow

1. `getSyncStateKey()` hashes `{vaultName, normalized remoteBaseDir, serverUrl, account}` to create per-target state namespace.
2. `ResumableWebDAVTraversal` acquires per-key mutex, loads persisted remote snapshot (`SyncRecord.remoteRecord`), optionally clears stale/incompatible state, and performs BFS traversal.
3. Traversal fetches directory contents through `apiLimiter.wrap(getDirectoryContents)`, retries on 503, periodically persists queue/nodes, and can resume after interruption.
4. Stat adapters (`stat-vault-item`, `stat-webdav-item`, `file-stat-to-stat-model`) normalize external metadata for planner/task logic.
5. Helper layer provides hashing (`sha256*`), path relation tests (`isSub`), timing/retry utilities (`sleep`, `waitUntil`, `breakableSleep`), and diagnostics/log formatting.

## Integration Points

- Sync and FS layers (`src/sync/*`, `src/fs/*`) are primary consumers.
- Persistence integration via `src/storage/sync-record.ts` for traversal snapshots/state mutation.
- Path normalization delegates to `src/platform/path/*` (remote/vault path policies).
- Obsidian integrations: `Vault`, filesystem objects, `requestUrl`.
- WebDAV integrations: directory content API + stat/content operations.

## Key Files

- `traverse-webdav.ts` — resumable remote BFS traversal with mutex + persisted checkpoints.
- `get-sync-state-key.ts` — deterministic sync namespace key derivation.
- `mutex.ts`, `api-limiter.ts` — concurrency/throttling primitives.
- `request-url.ts` — normalized HTTP wrapper around Obsidian `requestUrl`.
- `traverse-local-vault.ts` — local vault BFS traversal with ignore filtering.
- `stat-vault-item.ts`, `stat-webdav-item.ts`, `file-stat-to-stat-model.ts` — stat normalization.
- `sha256.ts`, `is-sub.ts`, `is-same-time.ts`, `is-503-error.ts` — shared decision/runtime helpers.
