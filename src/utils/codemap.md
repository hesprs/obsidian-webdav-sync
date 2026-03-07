# src/utils/

## Responsibility

Shared low-level primitives for sync, traversal, path handling, hashing, logging, and defensive runtime checks.

Major responsibilities are:
- Local/remote filesystem normalization and conversion (`std-remote-path.ts`, `remote-path-to-absolute.ts`, `remote-path-to-local-path.ts`, `is-sub.ts`, `get-root-folder-name.ts`)
- File metadata acquisition and projection into `StatModel` (`stat-vault-item.ts`, `stat-webdav-item.ts`, `file-stat-to-stat-model.ts`, `apply-deltas-to-stats.ts`)
- Full and incremental WebDAV traversal with resumable cache (`traverse-webdav.ts`)
- Local vault traversal with ignore filtering (`traverse-local-vault.ts`)
- API throttling and wrappers (`api-limiter.ts`, `rate-limited-client.ts`, `request-url.ts`)
- Sync-adjacent helpers for task labels, conflict merge, timing, sleep/wait, and serialization (`get-task-name.ts`, `merge-dig-in.ts`, `format-relative-time.ts`, `sleep.ts`, `breakable-sleep.ts`, `wait-until.ts`, `logs-stringify.ts`, `deep-stringify.ts`)

## Design Patterns

- Functional utility style: most files export one pure or mostly-pure function with narrow scope.
- Adapter pattern for external data models:
  - `FileStat -> StatModel` conversion isolates WebDAV schema from internal sync model.
  - Obsidian `TFile`/`TFolder` mapped to the same `StatModel` contract.
- Proxy-based rate limiting:
  - `createRateLimitedWebDAVClient` wraps all client methods and schedules calls through a shared `Bottleneck` limiter.
- Resumable state machine for remote traversal:
  - `ResumableWebDAVTraversal` keeps `cursor`, BFS `queue`, and `nodes` cache in KV storage.
  - Supports initial BFS scan, incremental delta replay, and reset fallback to full scan.
- Retry loop for transient infrastructure errors:
  - `executeWithRetry` loops on 503-only failures with fixed backoff.
- Rule engine for include/exclude matching:
  - `GlobMatch` compiles path-aware regex semantics (`rooted`, `dir-only`, `segment/path modes`) and `needIncludeFromGlobRules` enforces inclusion precedence.

## Data & Control Flow

- Remote traversal (`traverse-webdav.ts`):
  1. Acquire per-`kvKey` mutex.
  2. Load persisted traversal state from `traverseWebDAVKV`.
  3. If cache is complete, run incremental delta fetch from stored cursor; else continue/initialize BFS queue.
  4. During BFS, request directory contents via rate-limited API wrapper, transform each entry to `StatModel`, enqueue child directories, and periodically persist state.
  5. Compare start/end delta cursors; if drift detected, replay deltas into cached node graph.
  6. On delta reset, clear cache and restart full scan.
- Local traversal (`traverse-local-vault.ts`): BFS over `TFolder` graph, filter ignored paths (plugin `node_modules`), stat files/folders via `statVaultItem`, aggregate `StatModel[]`.
- Delta projection (`apply-deltas-to-stats.ts`): merge base `StatModel[]` with delta entries through maps keyed by `path`.
- Request and logging path:
  - `request-url.ts` forces non-throwing Obsidian requests, logs 4xx/5xx responses, rethrows conditionally via custom `RequestUrlError`.
  - `logs-stringify.ts` attempts `JSON.stringify`, then falls back to cycle-aware `deepStringify`.
- Time and async controls:
  - `sleep`, `breakable-sleep`, and `wait-until` provide polling and interruptible waiting primitives.

## Integration Points

- Obsidian API:
  - `Vault`, `TFile`, `TFolder`, `normalizePath`, `requestUrl` are used for local FS traversal, folder creation, and HTTP requests.
- WebDAV and sync API surface:
  - `webdav` client/stat types, `getDirectoryContents`, `getDelta`, `getLatestDeltaCursor`, and Nutstore endpoint builder `NSAPI`.
- Storage:
  - `traverseWebDAVKV` persists traversal checkpoints (`rootCursor`, `queue`, `nodes`).
- Sync domain model:
  - `StatModel`, `DeltaEntry`, and task classes from `~/sync/tasks/*` for user-visible task naming.
- Third-party runtime libraries:
  - `bottleneck` for throttling, `async-mutex` for per-key exclusivity, `glob-to-regexp` for glob semantics, `node-diff3` for content merge, `hash-wasm`/Web Crypto for hashing, `consola` for logging, and `lodash-es`/`ramda` helpers.
