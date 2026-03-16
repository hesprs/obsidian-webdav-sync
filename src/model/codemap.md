# src/model/

## Responsibility

Define shared sync domain data contracts: file/dir metadata (`StatModel`) and persisted/runtime sync-state schemas used by scheduler, engine, decision, tasks, and storage layers.

## Design Patterns

- **Typed DTO boundary**: interfaces/enums only; behavior lives in services/storage/sync modules.
- **Discriminated union for file stats**: `StatModel` branches on `isDir`, making `size`/`mtime` required only for files.
- **Runtime vs persisted representation split**:
  - `SyncStateModel.localRecords` uses `Map<string, LocalRecordModel>` for mutation efficiency.
  - `PersistedSyncStateModel.localRecords` uses `Record<string, LocalRecordModel>` for JSON/settings persistence.
- **Run-strategy enum**: `SyncRunKind` (`NORMAL` | `NUMB`) allows trigger/scheduler/executor code to request full or reduced planning.

## Data & Control Flow

1. Local/remote filesystem adapters produce `StatModel` values.
2. `SyncRecord` assembles those into `SyncStateModel` (`remoteRecord` + `localRecords`).
3. Sync planner/decider consumes these models to produce task plans.
4. Task execution updates sync state; storage serializes it as `PersistedSyncStateModel`.

## Integration Points

- **Services**: scheduler/realtime/scheduled/executor services pass `SyncRunKind` through the execution pipeline.
- **Storage**: `src/storage/sync-record.ts` depends on `createEmptySyncState`, `createEmptyRemoteRecord`, and state interfaces.
- **Sync engine/decision/tasks**: consume `StatModel`, `LocalRecordModel`, and `RemoteRecordModel` for diffing and state updates.

## Key Files

- `stat.model.ts` — canonical metadata shape for files and directories.
- `sync-record.model.ts` — sync-run kind, local/remote record contracts, persisted/runtime state models, and empty-state factories.
