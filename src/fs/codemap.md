# src/fs

## Responsibility

Provide a unified filesystem-walk boundary for sync planning across two backends:

- local Obsidian vault traversal
- remote WebDAV traversal/snapshots

Both backends emit a shared `FsWalkResult[]` shape and apply the same filter + parent-directory completion semantics.

## Design Patterns

- Strategy pattern via `AbstractFileSystem` implementations:
  - `LocalVaultFileSystem`
  - `RemoteWebDAVFileSystem`
- Backend adapters normalize source-specific paths/stat payloads into `StatModel` and `FsWalkResult`.
- Shared rule-evaluation pipeline (`GlobMatch`, `needIncludeFromGlobRules`) reused by both backends.
- Structural completion pass (`completeLossDir`) restores missing ancestor directories after filtering.
- Remote path canonicalization delegated to platform path abstraction (`normalizeRemoteWalkPath` -> `remotePathToLocalRelative`).

## Data & Control Flow

1. Sync layer selects an `AbstractFileSystem` implementation and calls `walk(options?)`.
2. Local backend:
   - traverses vault (`traverseLocalVault`)
   - evaluates inclusion/exclusion rules
   - runs `completeLossDir`
   - returns original stat list annotated with `ignored`.
3. Remote backend:
   - builds traversal state key (`getSyncStateKey`)
   - reads either persisted snapshot (`remoteSource: 'stored-record'`) or live traversal (`ResumableWebDAVTraversal.traverse`)
   - normalizes remote absolute paths into vault-relative paths
   - applies the same filter + completion pipeline
   - returns normalized stats annotated with `ignored`.

## Integration Points

- Obsidian `Vault` API for local tree traversal.
- WebDAV traversal utility (`ResumableWebDAVTraversal`) and DB key generation (`getSyncStateKey`) for resumable remote state.
- Settings module (`useSettings`) for filter rules.
- Platform path abstraction (`~/platform/path/*`) for deterministic vault/remote path normalization.
- Shared models/utilities: `StatModel`, glob matcher utilities.

## Key Files

- `fs.interface.ts`: abstract filesystem contract (`walk(): FsWalkResult[]`).
- `local-vault.ts`: local vault walker with rule filtering.
- `webdav.ts`: remote walker supporting live traversal or stored snapshot source and path normalization.
- `utils/complete-loss-dir.ts`: fills missing parent directories after filtering.
- `utils/is-root.ts`: root-path guard helper.
- `utils/normalize-remote-walk-path.ts`: converts remote walk paths into vault-relative paths.
