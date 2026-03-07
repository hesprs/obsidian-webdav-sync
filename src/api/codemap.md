# src/api/

## Responsibility

Provide low-level network access for Nutstore/Jianguoyun and WebDAV endpoints used by sync features. This directory normalizes remote responses into local TypeScript shapes used by higher-level services:

- `delta.ts`: fetches incremental change sets (`delta`) and normalizes entry arrays/cursor values.
- `latestDeltaCursor.ts`: fetches latest server cursor checkpoint without full delta payload.
- `webdav.ts`: lists directory contents via `PROPFIND`, supports paginated responses, and converts DAV XML properties into `FileStat` objects.

## Design Patterns

- Functional API surface: exports async functions (`getDelta`, `getLatestDeltaCursor`, `getDirectoryContents`) rather than classes.
- Request wrapper reuse: all HTTP calls go through shared `requestUrl` utility for consistent transport behavior.
- Rate-limit wrapping for API endpoints: `getDelta` and `getLatestDeltaCursor` are wrapped by `apiLimiter.wrap(...)`.
- XML-to-model transformation pipeline:
  - Parse XML with `fast-xml-parser`.
  - Normalize shape differences (single item vs array).
  - Coerce/clean values (cursor to string, HTML entity decoding for paths, numeric size parsing).
- Resilience handling in WebDAV traversal: retries `503` responses with wait-and-retry loop.

## Data & Control Flow

- Delta retrieval (`getDelta`):
  1. Build XML body containing `folderName` and optional `cursor`.
  2. POST to `NSAPI('delta')` with Basic auth token.
  3. Parse XML response to `DeltaResponse`.
  4. Normalize cursor type, force `delta.entry` to array, decode `entry.path` HTML entities.
  5. Return parsed response object containing cursor/hasMore/reset and entry list.

- Latest cursor retrieval (`getLatestDeltaCursor`):
  1. Build XML body with `folderName`.
  2. POST to `NSAPI('latestDeltaCursor')`.
  3. Parse XML and return `{ response: { cursor } }`.

- WebDAV directory listing (`getDirectoryContents`):
  1. Encode each path segment and ensure leading slash.
  2. Send `PROPFIND` request (Depth `1`) to `${NS_DAV_ENDPOINT}${path}`.
  3. Parse `multistatus.response` records and convert each entry to `FileStat`.
  4. Skip first entry (current directory itself), append children to accumulator.
  5. If response has `Link: rel="next"`, follow pagination URL and continue.
  6. On `503`, log and sleep before retrying same page; otherwise throw.
  7. Return aggregated `FileStat[]`.

## Integration Points

- Consumes constants/utilities:
  - `NS_DAV_ENDPOINT` for WebDAV base URL.
  - `NSAPI(...)` for Nutstore API endpoint construction.
  - `requestUrl` for outbound HTTP.
  - `apiLimiter` for throttling API calls.
  - `is503Error`, `logger` for retry/error observability.
- Consumes external libraries:
  - `fast-xml-parser` for XML parsing.
  - `html-entities` for decoding delta paths.
  - `path-browserify` and `lodash-es` for path/null handling.
  - `webdav` type `FileStat` for return contract.
- Used by UI/workflow layers that need remote directory browsing and incremental remote-state synchronization (for example WebDAV explorer integration and sync orchestration).
