# src/platform/path

## Responsibility

Centralize canonical path operations for two namespaces:

- vault-relative paths (Obsidian/internal sync representation)
- remote absolute WebDAV paths

## Design Patterns

- Namespace separation:
  - `vault-path.ts` for relative, slash-normalized vault paths.
  - `remote-path.ts` for absolute remote paths with leading `/` invariants.
- Shared segment-resolution approach (`.` removal, `..` collapse, slash normalization) to keep deterministic path identities.
- Conversion adapters bridge namespaces without leaking backend-specific path assumptions.

## Data & Control Flow

1. Input path strings are normalized into canonical segment arrays.
2. Vault operations (`normalizeVaultPath`, `joinVaultPath`, `vaultDirname`, `vaultBasename`) produce stable relative paths.
3. Remote operations (`normalizeRemotePath`, `normalizeRemoteDir`, `joinRemotePath`, `remoteDirname`, `remoteBasename`) enforce absolute/dir invariants.
4. Bridge functions:
   - `remotePathToLocalRelative(base, remotePath)` maps remote absolute paths to vault-relative paths.
   - `remotePathToAbsolute(base, remotePath)` resolves mixed relative/absolute remote inputs.
5. Fs/WebDAV traversal layers consume these conversions before filtering and sync comparison.

## Integration Points

- `src/fs/webdav.ts` uses remote-to-local conversion (via fs utility wrapper) to align remote snapshot paths with vault path space.
- `src/fs/utils/complete-loss-dir.ts` uses `vaultDirname` while restoring missing ancestor directories.
- Other sync/storage modules can rely on these helpers to avoid path duplication bugs across local/remote operations.

## Key Files

- `vault-path.ts`: vault path normalization/join/basename/dirname.
- `remote-path.ts`: remote absolute path normalization/join/basename/dirname and local/remote bridge functions.
