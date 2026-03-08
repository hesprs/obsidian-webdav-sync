# src/fs

## Responsibility

Provide a common filesystem-walk abstraction over local vault and remote WebDAV sources, with shared include/exclude filtering and parent-directory completion.

## Design Patterns

- Strategy-style implementations behind one interface: `AbstractFileSystem` with `LocalVaultFileSystem` and `RemoteWebDAVFileSystem`.
- Shared filtering pipeline using glob rule objects (`GlobMatch`).
- Post-filter normalization utility (`completeLossDir`) to keep required parent directories.
- Adapter-style wrapping of backend-specific traversal APIs into a common `FsWalkResult[]` output.

## Data & Control Flow

1. Caller selects a concrete filesystem and calls `walk()`.
2. Implementation loads sync filter rules from `useSettings()`.
3. Traversal collects `StatModel[]` from local vault (`traverseLocalVault`) or remote WebDAV (`ResumableWebDAVTraversal`).
4. Inclusion/exclusion rules are applied via `needIncludeFromGlobRules`.
5. `completeLossDir` re-adds missing parent directories for included descendants.
6. Final result maps each stat to `{ stat, ignored }` for sync decision-making.

## Integration Points

- Obsidian `Vault` API for local tree traversal.
- WebDAV traversal utility (`ResumableWebDAVTraversal`) and DB key generation for remote state.
- Settings module (`useSettings`) for filter rules.
- Shared models/utilities: `StatModel`, glob matcher utilities, remote path helpers.

## Key Files

- `fs.interface.ts`: abstract filesystem contract (`walk(): FsWalkResult[]`).
- `local-vault.ts`: local vault walker with rule filtering.
- `webdav.ts`: remote WebDAV walker with base-path trimming and filtering.
- `utils/complete-loss-dir.ts`: fills missing parent directories after filtering.
- `utils/is-root.ts`: root-path guard helper.
