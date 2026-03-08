# src

## Responsibility

Top-level plugin composition root: bootstraps settings/services, owns lifecycle, and connects fs/decision/task/storage modules into one sync runtime.

## Design Patterns

- Composition root via `WebDAVSyncPlugin` (`src/index.ts`) wiring services instead of embedding sync logic.
- Service-oriented split (`services/*`) for scheduling, realtime triggers, execution, progress, and status.
- Adapter boundaries around filesystem (`fs/*`), storage (`storage/*`), and remote client setup.
- Event-driven updates through `events/*` to decouple engine state from UI/reporting.

## Data & Control Flow

1. `onload()` loads persisted settings and registers UI/commands.
2. Trigger sources (manual command, schedule, vault events) call the sync executor service.
3. Executor validates configuration, prepares WebDAV client, and creates sync engine context.
4. `src/sync` decides and executes tasks against local + remote filesystems.
5. Storage/event services persist records and emit progress/completion/error states.

## Integration Points

- Obsidian plugin API (`Plugin`, `Vault`, settings tab, notices, status UI).
- WebDAV client lifecycle and patched request behavior.
- Persistent metadata via localforage-backed storage wrappers.
- Cross-module contracts from `model/*`, `types/*`, and shared utilities.

## Key Files

- `index.ts` — plugin entrypoint and service wiring.
- `sync/index.ts` — sync engine orchestration.
- `fs/local-vault.ts`, `fs/webdav.ts` — local/remote filesystem adapters.
- `storage/sync-record.ts`, `storage/blob.ts` — sync metadata and base-content persistence.
- `services/scheduled-sync.service.ts`, `services/realtime-sync.service.ts` — sync triggers.
