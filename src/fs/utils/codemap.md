# src/fs/utils/

## Responsibility

Hold fs-scoped normalization primitives used by both local and remote walkers.

- Root detection for vault-relative path loops.
- Parent-directory completion after include/exclude filtering.
- Remote walk path adaptation into vault-relative namespace.

## Design Patterns

- Pure functional helpers with no side effects.
- Single-responsibility utilities composed in higher-level fs walkers.
- `Set`/`Map`-based membership and lookup for linear-time completion over filtered stats.
- Delegation to platform path adapters (`vaultDirname`, `remotePathToLocalRelative`) instead of direct node/path-browserify coupling.

## Data & Control Flow

1. `completeLossDir(stats, filtered)` indexes all stats by path.
2. For each filtered entry, it climbs ancestors using `vaultDirname`.
3. Loop stops when `isRoot(path)` is true.
4. Missing ancestor directories present in the full stat index are re-inserted.
5. Result is a completed filtered set preserving directory chains needed by sync decision logic.
6. For remote traversal, `normalizeRemoteWalkPath` maps absolute/protocol-specific paths into vault-relative form before filtering/completion runs.

## Integration Points

- `src/fs/local-vault.ts` and `src/fs/webdav.ts` both call `completeLossDir`.
- `normalize-remote-walk-path.ts` integrates fs layer with `src/platform/path/remote-path.ts`.
- `complete-loss-dir.ts` integrates with `src/platform/path/vault-path.ts` for portable dirname behavior.
- `StatModel` remains the shared data contract.

## Key Files

- `complete-loss-dir.ts`: restore missing parent directories in filtered stat sets.
- `is-root.ts`: shared root guard (`/`, `.`, ``).
- `normalize-remote-walk-path.ts`: remote-to-local relative path normalization for WebDAV walk output.
