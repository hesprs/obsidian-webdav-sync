# src/fs/utils/

## Responsibility

This directory contains utility functions for file system operations and path manipulations within the Obsidian Sync plugin. Its primary focus is on maintaining structural integrity of file metadata during filtering and synchronization processes.

- **Path Validation**: Determining if a path represents the root of the file system.
- **Structure Completion**: Ensuring that filtered file sets include all necessary parent directory metadata to maintain a valid tree structure.

## Design

- **Functional Utilities**: Stateless, pure functions (mostly) that perform specific transformations or checks on file system data.
- **Efficient Lookups**: Utilization of `Set` and `Map` data structures to handle large lists of file statistics with $O(1)$ lookup performance during tree traversal.

## Flow

1. **Input**: `completeLossDir` receives a full list of available file stats and a subset of filtered stats (e.g., after applying ignore rules).
2. **Traversal**: For every item in the filtered subset, the function climbs the directory tree using `path.dirname`.
3. **Validation**: At each level, it checks if the parent directory is already present in the filtered set.
4. **Recovery**: If a parent is missing but exists in the original full list, it is added back to the filtered set.
5. **Termination**: The process stops when `isRoot` returns true for the current path.
6. **Output**: A complete array of stats that includes all files and their respective parent directory chains.

## Integration

- **Sync Engine**: Used during the preparation phase of synchronization to ensure that the local/remote file trees are structurally sound before comparison or transfer.
- **Path Browserify**: Relies on `path-browserify` for cross-platform path manipulation in the browser-based Obsidian environment.
- **Models**: Integrates with `StatModel` for consistent file metadata representation.
