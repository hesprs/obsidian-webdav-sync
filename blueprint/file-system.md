# File System Abstraction

The file systems the plugin will majorly be interacting with are the Obsidian Vault and the WebDAV. The plugin abstracts the file system interfaces into unified `Fs` as defined in `src/fs-new/interface.ts`. All abstractions are designed to be immutable and throw-away in each sync run.

## Vault Abstraction

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

The WebDAV abstraction should not use any external libraries. Only use Obsidian `requestUrl`-like API with custom request handling.

`constructor()`: receives an options object including `requestUrl()` injection (default to the Obsidian export), user username, WebDAV endpoint, password, and `useInfinity` boolean option.

`getUid()`: user server endpoint + `~` + user account name

`checkConnection()`: most simple method to test whether a WebDAV endpoint, account name, credential are correct.

`read()`: `GET` request to constructed URL

`readStream()`: `GET` with byte range header, each request fixed at 2MiB, multiplex max 8 requests during streaming. When multiplexed response arrives, sort and feed to stream. When back pressure detected, stop making mew requests. So there's max 8 \* 2MiB = 16MiB backpressure held in memory.

`write()`: `PUT` request to constructed URL. Try to find `Etag` in the response header. If found, return it. If not found, `this.stat()` immediately to the file just uploaded and return `uid`.

`delete()`: `DELETE` request to the constructed URL. Swallow `404` errors where the file has already been deleted.

`mkdir()`: `MKCOL` request to the constructed URL. Optional recursive flag.

`stat()`: `PROPFIND` (depth 0) request to constructed URL with custom XML. Parse with `XMLParser` composable, convert to `Stat`.

`exists()`: `PROPFIND` and intercept 404 responses.

`list()`: `PROPFIND` (depth 1) request to constructed folder URL with custom XML. Parse with `XMLParser`, convert to `Stat` array.

`listAll()`: when `useInfinity` is true, use `PROPFIND` (depth `infinity`) request, parse and convert to `Stat` array. Otherwise BFS recursive depth 1 `PROPFIND`. When the `progress` argument is present, reactively update it.

## Remote File System Shims

A shim is a factory function around a `RemoteFs` instance that intercepts the behavior of the original class. A shim function receives the original class in the first argument and returns a `RemoteFs`. Infinite layers of shim can be applied to the same FS instance.

### Base Dir Shim

Instantiates a new class wrappings around the remote FS to make a specific path as the root dir (format `${string}/`), instead of the entire FS. Receives the base dir in the second parameter in the constructor.

`getUid()`: append `~` + `baseDir` to original `getUid()` output.

All other methods: prepend the base dir to the received key, relay to the original class method. If the method returns `Stat` or `Array<Stat>`, pre-strip all base dirs in the `key` in it.

### Retry Shim

Auto-retry requests. Receives an options object including `maxRetry` (number) and `retryableStatusCodes` (array of string).

Only re-assigns the `request` method in the original class by obtaining it, wrapping with retry logic, and assigning back.

### Rate Limiter Shim

Limit the max concurrency and request interval of remote requests. Receives `maxConcurrency` and `minInterval` as options in the second argument.

Only re-assigns the `request` method in the original class by obtaining it, wrapping with a newly instantiated API limiter composable, and assigning back.

## Mechanisms

**Unified key schema**:

`RemoteFs`s should use unified key (file path) format. All abstracted file systems should automatically convert between the unified key and their native file path.

- `/` stands for the root dir.
- `file.md`, `folder/file.md` stand for a file.
- `folder/`, `folder/folder/` stand for folder.

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

**Behavioral purity**: Raw FS classes should not carry one additional functions, such as base dir config or retry, they should all be achieved via shims.
