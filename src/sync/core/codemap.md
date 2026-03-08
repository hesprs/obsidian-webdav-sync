# src/sync/core Codemap

## Responsibility

This directory contains the core synchronization and conflict resolution logic for the plugin. It provides pure utility functions to determine how to reconcile differences between local and remote files.

- **Conflict Resolution**: Deciding which version to keep based on metadata (timestamps).
- **Content Merging**: Performing 3-way merges for text files to preserve changes from both sides when possible.

## Design Patterns

- **Strategy Pattern**: Implements multiple resolution strategies (`resolveByLatestTimestamp`, `resolveByIntelligentMerge`) that can be chosen based on the file type or sync configuration.
- **Result Object Pattern**: Functions return structured objects (e.g., `LatestTimestampResult`, `IntelligentMergeResult`) containing status enums and data, ensuring type-safe handling of different outcomes (success, conflict, no change).
- **Fallback Mechanism**: The intelligent merge logic employs a multi-stage approach, starting with a conservative line-based merge and falling back to a more aggressive character-based patch application.

## Data & Control Flow

### Timestamp-based Resolution (`resolveByLatestTimestamp`)

1. Compares local and remote modification times (`mtime`).
2. If timestamps differ, it performs a content equality check (`isEqual`).
3. Returns `UseRemote` or `UseLocal` only if the newer version actually has different content; otherwise, returns `NoChange`.

### Intelligent Merge Resolution (`resolveByIntelligentMerge`)

1. **Identity Check**: Returns immediately if local and remote contents are identical.
2. **Line-based Merge**: Attempts a 3-way merge using `node-diff3`. This is preferred as it is safer for structured text like Markdown.
3. **Character-based Fallback**: If line-based merge fails due to conflicts, it attempts to apply patches using `diff-match-patch`.
4. **Final Result**: Returns the merged text if successful, or a failure status if a "hard" conflict is detected that neither algorithm can resolve safely.

## Integration Points

- **External Libraries**:
  - `node-diff3`: Primary engine for line-level 3-way merging.
  - `diff-match-patch`: Fallback engine for character-level patching and fuzzy matching.
  - `lodash-es`: Used for robust content comparison.
- **Types**:
  - `webdav`: Integrates with `BufferLike` types for handling file contents.
- **Consumers**: This core logic is designed to be consumed by higher-level sync services that manage the Obsidian vault and WebDAV communication.
