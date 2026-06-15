# File System Abstraction

The file systems the plugin will majorly be interacting with are the Obsidian Vault and the WebDAV. The plugin abstracts the file system interfaces into unified `Fs` as defined in `src/fs/interface.ts`. All abstractions are designed to be immutable and throw-away in each sync run.

## Vault Abstraction

`delete()`, `mkdir()`, `write()`, `writeStream()` are coalesce-optimized, other methods execute directly, principles:

1. Merge and execute `delete()` calls to the shallowest parent that is also deleted.
2. Sort and reorder `mkdir()`, execute from shallowest to deepest sequentially, each level concurrently.
3. `write()` and `writeStream()` go last concurrently.

`constructor()`: receives an Obsidian vault instance.

`getUid()`: return the vault name

`read()`: wrap `vault.adapter.readBinary()`

`write()`: wrap `vault.adapter.writeBinary()`, then immediately `this.stat()` and return `mtime`.

`writeStream()`:

- simulate a streamed write by wrapping `vault.adapter.appendBinary()`
- read a stream, append to `.trash/<random-string>` in the vault
- when stream finishes, `this.move()` `.trash/<random-string>` to the destination location.
- `this.stat()` and return `mtime`.

`delete()`: try to obtain trash file preference from `vault.config.trashOption`, then trash accordingly. If `trashSystem` fails, fallback to `trashLocal`.

`move()`: wrap `vault.adapter.rename()`

`mkdir()`: wrap `vault.adapter.mkdir()`

`stat()`:

- wrap `vault.adapter.stat()`
- convert to the project standard `Stat` format, `uid` uses Etag if present, otherwise fallback to `mtime`.

`listAll()`: BFS recursive `vault.adapter.stat()` + convert to `Stat` array

## WebDAV Abstraction

The WebDAV abstraction should not use any external libraries. Only use Obsidian `requestUrl`-like API with custom request handling. `delete()`, `mkdir()`, `write()` are coalesce-optimized, other methods execute directly, principles:

1. Merge and execute `delete()` calls to the shallowest parent that is also deleted.
2. Sort and reorder `mkdir()`, execute from shallowest to deepest sequentially, each level concurrently.
3. `write()` goes last concurrently.

`constructor()`: receives an options object including `requestUrl()` injection (default to the Obsidian export), user username, WebDAV endpoint, password, and `useInfinity` boolean option.

`getUid()`: user server endpoint + `~` + user account name

`checkConnection()`: most simple method to test whether a WebDAV endpoint, account name, credential are correct.

`read()`: `GET` request to constructed URL

`readStream()`: `GET` with byte range header, each request fixed at 1MiB, multiplex max 4 requests during streaming. When multiplexed response arrives, sort and feed to stream. When back pressure detected, stop making new requests.

`write()`: `PUT` request to constructed URL. Try to find `Etag` in the response header. If found, return it. If not found, `this.stat()` immediately to the file just uploaded and return `uid`.

`delete()`: `DELETE` request to the constructed URL. Swallow `404` errors where the file has already been deleted.

`mkdir()`: `MKCOL` request to the constructed URL. Optional recursive flag.

`stat()`: `PROPFIND` (depth 0) request to constructed URL with custom XML. Parse with `XMLParser` composable, convert to `Stat`.

`exists()`: `PROPFIND` and intercept 404 responses.

`list()`: `PROPFIND` (depth 1) request to constructed folder URL with custom XML. Parse with `XMLParser`, convert to `Stat` array.

`listAll()`: when `useInfinity` is true, use `PROPFIND` (depth `infinity`) request, parse and convert to `Stat` array. Otherwise BFS recursive depth 1 `PROPFIND`. When the `progress` argument is present, reactively update it.

## File System Operation Coalescing

Due to the difference in different file systems, the operations needed to execute a sync is different in different backends. E.g, in WebDAV, a file must be uploaded after the creation of its parent directories; in S3-compatible backend, all files can be uploaded concurrently without caring about hierarchy. The task optimization must be done at backend-side. The plugin must only give backends general and raw operations during the sync process.

In practice, the plugin initiates all raw tasks in direct parallel. Due to how TypeScript (JavaScript) event loop works, the leading synchronous or resolved promise part in each task will still be executed immediately until requesting the first unresolved promise.

The tasks can ensure that the first unresolved promise are file operations only (this requires: 1. Special code arrangement in tasks 2. All FS shims intercepting operations must be synchronous / asynchronous but fully resolved / asynchronous, unresolved, but all resolved in the same drain cycle). So when an FS abstraction coalesces the microtask drain cycle of task initiation. The FS can immediately obtain the full list of operations, and optimize them directly within the promises, such as batching (one operation resolves multiple promises) and reordering (delay resolution of the promises that are ordered later).

Coalescing optimization is only limited to operations arriving at the same microtask drain cycle. And should be avoided when there's only one operation captured in one cycle.

### WebDAV Coalescing

## Principles

**Unified key schema**:

`RemoteFs`s should use unified key (file path) format. All abstracted file systems should automatically convert between the unified key and their native file path.

- `/` stands for the root.
- `file.md`, `folder/file.md` stand for files.
- `folder/`, `folder/folder/` stand for folders.

In contrast, Obsidian uses:

File: `file.md`, `folder/file.md`
Folder: `folder`, `folder/folder`

While WebDAV uses:

File: `https://.../file.md`, `https://.../folder/file.md`
Folder: `https://.../folder/`, `https://.../folder/folder/`

**Error handling**: Except 404 errors explicitly documented above to swallow, other request errors should be thrown fast. No retry needed (which should be handled by the retry shim).

**Local remote disparity**: The local vault has an intentionally different interface with remote. This is for specific reasons:

- We don't need so many shims around vault FS.
- Obsidian doesn't support read stream. And thus, we don't need write stream in remote FS.

**Behavioral purity**: Raw FS classes should not carry any additional functions, such as base dir config or retry, they should all be achieved via shims.
