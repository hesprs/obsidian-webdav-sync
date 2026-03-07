# Events Codemap

The `src/events` directory manages application-wide events using RxJS, providing a centralized event bus for synchronization, authentication, and vault operations.

## Responsibility
- Centralize event definitions and streams.
- Provide a consistent API for emitting and subscribing to events.
- Decouple event producers (e.g., sync engine) from event consumers (e.g., UI notices, progress bars).

## Design Patterns
- **Observer Pattern**: Leverages RxJS `Subject` and `Observable` to handle asynchronous event streams.
- **Pub/Sub (Publisher/Subscriber)**: Each module provides `emitX` (publisher) and `onX` (subscriber) functions.
- **Encapsulation**: The underlying `Subject` is kept private to the module, exposing only the `Observable` and a controlled emission function.

## Data & Control Flow
1. **Trigger**: An action (like starting a sync or receiving an SSO token) calls an `emit` function.
2. **Stream**: The data is pushed into a private RxJS `Subject`.
3. **Notification**: All components subscribed to the corresponding `onX` observable receive the update.
4. **Reaction**: Subscribers perform side effects, such as updating the UI or logging errors.

## Integration Points
- **Sync Engine**: Emits lifecycle events (`sync-start`, `sync-progress`, `sync-end`, etc.) to report status.
- **Authentication**: `sso-receive.ts` handles incoming SSO tokens.
- **UI Layer**: Subscribes to progress and error events to provide user feedback via notices and status bars.
- **Vault**: `vault.ts` tracks changes or actions within the Obsidian vault.

## File Map

| File | Description |
| :--- | :--- |
| `index.ts` | Central export point for all event modules. |
| `sso-receive.ts` | Handles SSO token reception events. |
| `sync-cancel.ts` | Signals that a synchronization process has been cancelled. |
| `sync-end.ts` | Signals sync completion, including success/failure statistics. |
| `sync-error.ts` | Broadcasts errors encountered during synchronization. |
| `sync-preparing.ts` | Signals the start of the preparation phase before actual syncing. |
| `sync-progress.ts` | Provides granular updates on sync progress (tasks completed vs total). |
| `sync-start.ts` | Signals the beginning of a synchronization process. |
| `sync-update-mtime-progress.ts` | Tracks progress of file modification time updates. |
| `vault.ts` | General purpose events related to vault state or actions. |
