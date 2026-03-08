# Sync Module Codemap

This directory contains the core synchronization logic for the Obsidian Sync plugin. It orchestrates the process of keeping a local Obsidian vault in sync with a remote WebDAV server.

## Responsibility

The `NutstoreSync` class in `index.ts` is the central orchestrator. Its primary responsibilities include:

- **Lifecycle Management**: Managing the start, progress, completion, and error handling of sync operations.
- **Environment Initialization**: Setting up local (`LocalVaultFileSystem`) and remote (`NutstoreFileSystem`) abstractions.
- **Task Generation**: Utilizing the `decision` submodule to determine the set of actions (tasks) required to synchronize the two systems.
- **User Interaction**: Handling confirmations for potentially destructive operations (like deletions) and displaying progress/errors via modals and notices.
- **Execution & Resilience**: Running tasks in optimized chunks, handling retries for transient errors (e.g., HTTP 503), and ensuring sync records are updated correctly.

## Design Patterns

- **Facade / Orchestrator**: `NutstoreSync` provides a high-level interface for the sync process, hiding the complexity of decision-making and task execution.
- **Command Pattern**: Sync operations are encapsulated as discrete "Task" objects (implementing `BaseTask`) in the `tasks` submodule.
- **Strategy Pattern**: The synchronization logic is decoupled into "Deciders" (e.g., `TwoWaySyncDecider`), allowing for different sync strategies.
- **Observer Pattern**: Uses `rxjs` and custom event emitters to notify the rest of the application about sync progress and state changes.

## Data & Control Flow

1.  **Initialization**: `NutstoreSync` is instantiated with plugin settings and a WebDAV client.
2.  **Discovery**: The `TwoWaySyncDecider` compares the local vault state, the remote server state, and the last known sync record to generate a list of `BaseTask` objects.
3.  **Confirmation**: If required by settings or the nature of the tasks (e.g., deletions), the user is prompted for confirmation via UI modals.
4.  **Optimization**: Tasks are filtered, sorted, and merged (e.g., combining multiple directory creations) to minimize API calls.
5.  **Execution**: Tasks are executed in chunks. Each task's `exec()` method is called, with built-in retry logic for specific network errors.
6.  **Persistence**: After each chunk of tasks completes, the `SyncRecord` is updated with the new modification times (mtime) to track the synchronized state.
7.  **Completion**: Events are emitted to signal the end of the sync, and any failures are reported to the user.

## Integration Points

- **Obsidian API**: Deeply integrated with the `Vault` for local file operations and UI components (`Notice`, `Modal`) for user feedback.
- **WebDAV**: Communicates with remote servers using the `webdav` library.
- **Storage**: Uses a key-value store (`syncRecordKV`) to persist sync metadata via the `SyncRecord` class.
- **Events**: Relies on a central event system (`~/events`) to decouple sync logic from the UI.

## Submodules

- **[core](./core/codemap.md)**: Low-level utilities for merging and comparing file states.
- **[decision](./decision/codemap.md)**: Logic for determining which sync actions are necessary based on the current state.
- **[tasks](./tasks/codemap.md)**: Individual, executable units of work (e.g., Push, Pull, Delete).
- **[utils](./utils/codemap.md)**: Helper functions for task optimization and record management.
