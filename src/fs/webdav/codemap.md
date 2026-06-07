# src/fs/webdav/

## Responsibility

WebDAV-backed filesystem access for the sync engine. This folder handles remote directory listing, file stat lookup, traversal, and small client helpers for reading and creating remote paths.

## Design

- `api.ts` builds raw WebDAV `PROPFIND` requests, parses XML responses, and converts DAV records into internal `StatModel` values.
- Path handling is normalized through `normalizeRemotePath`, `normalizePathToRelative`, and remote URL builders so returned stats match vault-style paths.
- Requests retry on retryable network errors with a fixed sleep/backoff loop.
- `traverse.ts` walks the remote tree using settings-driven traversal mode: either exhaustive listing or breadth-first directory exploration.
- `utils.ts` keeps thin wrappers around the WebDAV client: stat lookup, content download, and recursive mkdir.
- `index.ts` re-exports the public WebDAV API for consumers.

## Flow

1. Callers request remote stats or contents through `getStat`, `getDirectoryContents`, or `traverseWebDAV`.
2. `api.ts` constructs a `PROPFIND` body, sends it via `requestUrl`, parses `multistatus`, and maps each response item to `StatModel`.
3. `getDirectoryContents` follows `Link: rel="next"` pagination when present.
4. `traverseWebDAV` wraps directory listing with `apiLimiter`, decrypts remote traversal paths when encryption is enabled, normalizes each path relative to the configured remote base, then passes the accumulated map through `postTraversal`.
5. On 404s during traversal, the folder is skipped instead of failing the whole walk.

## Integration

- `src/sync/decision/two-way.decider.ts` uses `traverseWebDAV` to build the remote snapshot for sync decisions.
- `src/sync/tasks/pull.task.ts`, `push.task.ts`, and `merge.task.ts` use `getContent`, `statItem`, and related helpers for file transfer and post-write verification.
- `src/components/SelectRemoteBaseDirModal.ts` uses `getDirectoryContents` for remote folder browsing and `mkdirsWebDAV` for folder creation.
- `src/services/webdav.service.ts` creates the authenticated WebDAV client that these helpers consume.
