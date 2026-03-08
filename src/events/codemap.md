# src/events

## Responsibility

Expose a lightweight RxJS event bus for sync lifecycle, sync progress/error, cancellation, and vault-level signals.

## Design Patterns

- Observer/pub-sub with per-event `Subject` instances.
- Encapsulated emit/subscribe API pair per event module (`emitX` + `onX`).
- Barrel export (`index.ts`) to provide a single import surface.

## Data & Control Flow

1. Producer code calls an `emit*` function.
2. The module pushes payload into its private `Subject`.
3. Consumers subscribed via `on*()` receive observable updates.
4. UI/sync orchestration reacts to state changes (start, preparing, progress, errors, end, cancel).

## Integration Points

- Sync runtime publishes lifecycle and progress events.
- UI components subscribe for notices/progress rendering.
- Vault-related workflows publish/consume generic vault events.
- Shared task typing from sync task interfaces is used in progress payloads.

## Key Files

- `index.ts`: re-exports all event modules.
- `sync-start.ts`: sync start event stream.
- `sync-preparing.ts`: pre-sync preparation event stream.
- `sync-progress.ts`: sync task progress payload stream.
- `sync-update-mtime-progress.ts`: mtime-update progress stream.
- `sync-error.ts`: sync error event stream.
- `sync-end.ts`: sync completion event stream.
- `sync-cancel.ts`: sync cancellation event stream.
- `vault.ts`: generic vault event stream.
