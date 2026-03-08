# src/model/

## Responsibility

This directory defines the core data structures used throughout the synchronization process. It provides a unified representation of file system metadata for both local and remote environments, ensuring consistency in how file states are tracked and compared.

## Design Patterns

- **Data Transfer Objects (DTOs)**: The models are simple interfaces and types used to pass structured metadata between different layers of the application, such as between storage adapters and the sync engine.
- **Discriminated Unions**: `StatModel` utilizes a discriminated union (based on `isDir`) to represent both file and directory metadata within a single type while maintaining strict type safety for properties like `size` and `mtime`.

## Data & Control Flow

- **Input**: Metadata is gathered from the local Obsidian vault and remote storage providers, then mapped into `StatModel` instances.
- **Processing**: The sync engine aggregates these into `SyncRecordModel` objects, which represent the state of a specific path across local, remote, and base (last known sync) versions.
- **Output**: These models drive the decision-making process for file operations (upload, download, delete, or conflict resolution).

## Integration Points

- **Storage Adapters**: Both local and remote adapters must produce `StatModel` compatible data.
- **Sync Engine**: The core logic of the plugin depends on these models to perform state comparison and synchronization.
- **Conflict Resolver**: Uses `SyncRecordModel` to identify and handle discrepancies between local and remote states.
