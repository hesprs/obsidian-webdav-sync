# Codemap: Sync Tasks

This directory contains the implementation of individual synchronization tasks, which are the atomic units of work in the sync process.

## Responsibility

- **Atomic Operations**: Encapsulates specific sync actions such as file transfers (`PullTask`, `PushTask`), filesystem modifications (`MkdirLocalTask`, `RemoveRemoteTask`), and state management (`CleanRecordTask`).
- **Cross-Platform Interaction**: Bridges the gap between the local Obsidian `Vault` and the remote WebDAV server.
- **Conflict Resolution**: Implements logic to handle discrepancies between local and remote file versions (`ConflictResolveTask`).
- **Error Handling**: Standardizes error reporting across different types of operations using `TaskError` and `TaskResult`.

## Design Patterns

- **Command Pattern**: Each task is a class extending `BaseTask` that encapsulates all information needed to perform an action. The `exec()` method serves as the execution trigger.
- **Template Method Pattern**: `BaseTask` defines the structure and common properties (like path resolution logic), while subclasses implement the specific execution logic in `exec()`.
- **Strategy Pattern**: `ConflictResolveTask` employs different strategies (e.g., `DiffMatchPatch`, `LatestTimeStamp`) to resolve version conflicts based on configuration.
- **Abstract Base Class**: `BaseTask` provides a unified interface and shared utility getters for all task implementations.

## Data & Control Flow

- **Initialization**: Tasks are instantiated with `BaseTaskOptions`, providing access to the Obsidian `Vault`, `WebDAVClient`, `SyncRecord`, and relevant file paths.
- **Execution Flow**:
    1. **State Verification**: Tasks often begin by checking the existence or metadata of files using utilities like `statVaultItem` or `statWebDAVItem`.
    2. **Action**: The core logic is performed (e.g., `webdav.putFileContents` for uploads, `vault.modifyBinary` for downloads).
    3. **Result Reporting**: Tasks return a `TaskResult` object. A `success: true` result may include `skipRecord: true` if the task shouldn't trigger a sync record update.
- **Error Propagation**: Exceptions are caught within `exec()`, logged via `logger`, and converted into a `TaskFailureResult` containing a `TaskError`.

## Integration Points

- **Obsidian API**: Uses `Vault` for reading, writing, and trashing local files and folders.
- **WebDAV Client**: Uses `WebDAVClient` for all remote operations including file transfers and directory management.
- **Sync Engine**: Tasks are typically created and orchestrated by the higher-level sync logic (e.g., `SyncManager` or `PlanGenerator`).
- **Storage Layer**: Interacts with `SyncRecord` to manage the persistent state of synchronized items and `blobStore` for retrieving base versions during merges.
- **Utilities**: Relies on shared utilities for path manipulation (`path-browserify`), directory creation (`mkdirs-vault`), and internationalization (`i18n`).
