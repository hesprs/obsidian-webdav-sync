# src/platform/

## Responsibility

Platform-adapter helpers for path, binary, and crypto primitives.
They normalize vault/WebDAV paths, bridge browser binary types to `ArrayBuffer`, and expose the small crypto surface used by sync and encryption code.

## Design

- `path.ts` treats remote paths and vault paths separately.
  - Remote helpers preserve absolute WebDAV semantics (`/`, trailing `/` for dirs, base-dir joining/splitting).
  - Vault helpers normalize to Obsidian-style relative paths and derive dirname/basename without Node APIs.
  - All path splitting removes `.`/`..`, converts `\` to `/`, and normalizes NFC.
- `binary.ts` provides mobile/browser-safe conversion and comparison helpers.
  - Converts `Blob`, typed-array views, and `ArrayBuffer` to `ArrayBuffer`.
  - Copies `SharedArrayBuffer` views so callers always get a detached buffer.
  - Compares buffers byte-by-byte and converts buffers to text through `Blob`.
- `crypto.ts` is intentionally tiny.
  - `sha256Digest` wraps `crypto.subtle.digest`.
  - `hash` is a fast non-cryptographic string hash for sync-state keys.

## Flow

1. Settings and startup normalize user/server inputs with path helpers (`remoteDir`, vault name, sync-state identity).
2. WebDAV traversal uses remote path helpers to strip endpoint prefixes, detect directories, and map remote paths back into vault-relative paths.
3. Vault traversal and file utilities use vault path helpers to keep local paths normalized when reading, creating temp files, and deriving parent dirs.
4. Sync encryption uses remote path helpers to split/join descendants below the configured base dir, and crypto helpers to derive salts/keys.
5. Sync tasks use binary helpers to compare, decode, upload, and download file content before writing back to vault/WebDAV.

## Integration

- `src/fs/webdav/*` uses `normalizeRemotePath`, `normalizeBaseDir`, `remoteBasename`, and relative/absolute base-dir helpers for listing, stat, and traversal.
- `src/fs/vault/*` uses `normalizeVaultPath` and `vaultDirname` for local traversal and temp-path handling.
- `src/utils/encryption.ts` depends on `splitRemotePathAtBaseDir`, `joinRemotePathFromBaseDir`, and `normalizePathToRelative` to encrypt/decrypt path segments around the configured remote base dir.
- `src/composable/encryption.ts` uses `sha256Digest` to derive salts and encryption keys from server/account/base-dir identity.
- `src/utils/get-sync-state-key.ts` uses `hash` plus normalized base dirs to create stable sync-state storage keys.
- `src/sync/tasks/*` and WebDAV helpers use binary conversion/equality helpers for file content round-tripping and merge detection.
