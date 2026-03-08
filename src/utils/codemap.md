# src/utils

## Responsibility

Hosts shared, cross-cutting utilities for path normalization, stat conversion, local/remote traversal, request throttling, retries, logging, and general async helpers.

## Design Patterns

- Functional utility modules with small, focused exports.
- Adapter conversions from Obsidian/WebDAV types to internal sync models.
- Proxy/wrapper patterns for rate-limited WebDAV and guarded request handling.
- Stateful traversal helper with resumable checkpoints for remote scans.

## Data & Control Flow

1. Traversal helpers produce normalized `StatModel` snapshots from vault/WebDAV.
2. Path/time utilities normalize and compare sync-relevant values.
3. API wrappers route calls through limiter/retry/error-shaping layers.
4. Task naming/formatting/logging helpers provide human-readable diagnostics.
5. Sleep/wait helpers coordinate polling and interruptible async flows.

## Integration Points

- Obsidian APIs (`Vault`, `TFile/TFolder`, `requestUrl`).
- WebDAV client/types and directory listing operations.
- Storage KV for resumable traversal checkpoints.
- Sync engine/tasks consuming stat/path/name/retry helpers.
- Third-party libs (`bottleneck`, `async-mutex`, `glob-to-regexp`, hashing/logging deps).

## Key Files

- `traverse-webdav.ts`, `traverse-local-vault.ts` — snapshot builders.
- `rate-limited-client.ts`, `api-limiter.ts`, `request-url.ts` — request control layer.
- `stat-vault-item.ts`, `stat-webdav-item.ts`, `file-stat-to-stat-model.ts` — stat adapters.
- `std-remote-path.ts`, `remote-path-to-local-path.ts`, `remote-path-to-absolute.ts` — path conversion.
- `is-same-time.ts`, `is-503-error.ts`, `wait-until.ts`, `sleep.ts`, `breakable-sleep.ts` — sync/runtime guards.
