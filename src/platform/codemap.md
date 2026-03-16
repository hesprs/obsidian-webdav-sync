# src/platform

## Responsibility

Provide environment-stable platform primitives (binary, crypto, and path helpers) used by higher-level sync/services/fs modules.

## Design Patterns

- Thin utility modules with explicit input/output contracts.
- Browser/runtime compatibility wrappers over host APIs (`crypto.subtle`, `Blob`, `ArrayBufferView`).
- Path logic isolated in dedicated submodule (`path/`) to avoid duplicated normalization rules.

## Data & Control Flow

1. Callers pass raw runtime values (binary payloads, object values, or path strings).
2. Platform helpers normalize/convert into canonical forms:
   - `binary.ts`: convert to `ArrayBuffer`, compare buffers.
   - `crypto.ts`: compute SHA-256 digests and deterministic lightweight hashes/deep equality checks.
   - `path/*`: resolve and normalize vault/remote paths.
3. Canonicalized outputs are consumed by sync logic, fs adapters, and cache/state key flows.

## Integration Points

- `src/fs/*` and traversal utilities consume path helpers for remote/local path conversion.
- Sync/storage workflows consume binary/crypto helpers for content comparison and hashing.
- Runtime depends on browser-compatible globals (`globalThis.crypto`, `Blob`, typed arrays).

## Key Files

- `binary.ts`: binary conversion and equality utilities.
- `crypto.ts`: digest/hash/equality helpers for structured values.
- `path/remote-path.ts`: remote path normalization + conversion helpers.
- `path/vault-path.ts`: vault-relative path normalization + basename/dirname helpers.
