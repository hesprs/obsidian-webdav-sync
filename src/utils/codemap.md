# src/utils/

## Responsibility

Shared utility layer for sync, settings, services, storage, and WebDAV plumbing. It hosts small pure helpers, browser-safe timing helpers, request/logging wrappers, path and encryption adapters, and UI-facing formatting/lookup helpers.

## Design

- Mostly stateless, single-purpose functions with no local module state.
- Pure helpers cover array/path/time/string transforms: `fns.ts`, `format-date.ts`, `format-relative-time.ts`, `glob-match.ts`, `get-sync-state-key.ts`, `is-retryable-error.ts`, `is-sub.ts`.
- Async/browser helpers use `window` timers only: `sleep.ts`, `wait-until.ts`, `breakable-sleep.ts`.
- Integration wrappers centralize side effects: `request-url.ts` normalizes Obsidian requests and logs failures; `logger.ts` sanitizes metadata and exports sync reports.
- Adapter utilities bridge higher-level domains without duplicating logic: `encryption.ts`, `get-credential.ts`, `launch-manual-sync.ts`, `handle-input.ts`, `input-converters.ts`, `get-task-info.ts`, `merge-dig-in.ts`.

## Flow

- Settings and sync services call `handle-input`, `input-converters`, `get-sync-state-key`, `glob-match`, and `get-credential` to normalize user input and derive stable keys.
- Sync execution uses `encryption.ts` for remote path/content transforms, `breakable-sleep.ts` and `wait-until.ts` for cancellation-aware waiting, and `is-retryable-error.ts`/`request-url.ts` for WebDAV retry handling.
- UI and observability paths use `launch-manual-sync`, `get-task-info`, `format-relative-time`, and `logger` to render labels, icons, timestamps, and debug/report output.
- Storage and traversal code reuse `fns.ts` and `is-sub.ts` for null checks, chunking, merge helpers, and path containment checks.

## Integration

- `src/sync/*`: task execution, retry logic, merge handling, and encryption-aware remote path resolution.
- `src/services/*`: scheduler batching, observability status updates, WebDAV client creation, and manual sync entry points.
- `src/settings/*`: input parsing, validation, and sync-state key generation.
- `src/fs/*` and `src/webdav-patch.ts`: traversal filtering, request wrapper, retry detection, and WebDAV API calls.
- `src/components/*`: progress, confirmation, and ribbon actions consume task labels and manual-sync helpers.
