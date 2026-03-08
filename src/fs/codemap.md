# FS Codemap

## Responsibility

The `fs` (File System) module provides a unified abstraction layer for interacting with different storage backends. It is responsible for:

- Defining a common interface (`AbstractFileSystem`) for file system operations.
- Implementing local storage access via `LocalVaultFileSystem`, which interacts with the Obsidian Vault API.
- Implementing remote storage access via `NutstoreFileSystem`, which interacts with Nutstore WebDAV.
- Handling file filtering based on inclusion and exclusion rules defined in settings.
- Ensuring directory structure integrity by automatically including parent directories of included files (`completeLossDir`).

## Design Patterns

- **Strategy Pattern**: `AbstractFileSystem` serves as the base strategy, with `LocalVaultFileSystem` and `NutstoreFileSystem` as concrete implementations. This allows the sync engine to operate on any file system without knowing its specific type.
- **Interface-based Polymorphism**: The use of an abstract class/interface ensures consistency across different storage providers.
- **Utility Pattern**: Helper functions in the `utils` subdirectory provide specialized logic for path validation and directory completion.

## Data & Control Flow

### Data Flow

1. **Traversal**: The `walk()` method initiates a traversal of the file system (local or remote).
2. **Metadata Collection**: File and directory metadata is collected into `StatModel` objects.
3. **Filtering**: Inclusion and exclusion rules are applied to the paths.
4. **Structure Completion**: `completeLossDir` is called to ensure that if a file is included, all its parent directories are also marked as included (not ignored).
5. **Result Mapping**: The final list of `StatModel` objects is mapped to `FsWalkResult[]`, indicating which items are ignored.

### Control Flow

- A sync manager or engine instantiates the appropriate `AbstractFileSystem` implementation.
- The `walk()` method is called to get the current state of the file system.
- The results are then used by the sync engine to determine which files need to be uploaded, downloaded, or deleted.

## Integration Points

- **Obsidian API**: `LocalVaultFileSystem` integrates directly with Obsidian's `Vault` and `TFile`/`TFolder` structures (via `traverseLocalVault`).
- **WebDAV Client**: `NutstoreFileSystem` integrates with the `webdav` library for remote communication.
- **Settings Module**: Both implementations depend on `useSettings` to retrieve user-defined sync rules.
- **Global Utils**: Uses `GlobMatch` for pattern matching and `traverseLocalVault`/`ResumableWebDAVTraversal` for the actual walking logic.
- **Models**: Relies on `StatModel` for a consistent representation of file metadata across different backends.
