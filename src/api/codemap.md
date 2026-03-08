# src/api

## Responsibility

Provide low-level WebDAV API helpers that fetch remote directory data and normalize it into `FileStat` objects for sync and traversal logic.

## Design Patterns

- Functional module API (`getDirectoryContents`) instead of service classes.
- Parse-and-normalize pipeline for DAV XML responses.
- Retry loop for transient `503` responses with backoff via `sleep`.
- Small focused helpers for pagination (`extractNextLink`) and path normalization.

## Data & Control Flow

1. `getDirectoryContents` normalizes and URL-encodes the requested path.
2. Sends `PROPFIND` request with `Depth: 1` through `requestUrl`.
3. Parses XML into `multistatus.response` entries.
4. Converts each response item to `FileStat` (type, size, timestamps, normalized filename).
5. Skips the first self-entry and accumulates children.
6. Follows `Link: rel="next"` pagination until exhausted.
7. On `503`, logs and retries after delay; otherwise rethrows error.

## Integration Points

- Internal utilities: `requestUrl`, `is503Error`, `logger`, `sleep`.
- External libraries: `fast-xml-parser`, `path-browserify`, `lodash-es`, `webdav` types.
- Consumed by WebDAV traversal/sync layers that need remote directory listing.

## Key Files

- `webdav.ts`: WebDAV `PROPFIND` listing with XML parsing, pagination, and retry handling.
