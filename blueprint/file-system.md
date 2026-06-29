# File System Abstraction

The file systems the plugin will majorly be interacting with are the Obsidian Vault and the WebDAV. The plugin abstracts the file system interfaces into unified file system classes as defined in `packages/plugin/src/fs/interface.ts`. All abstractions are designed to be immutable and throw-away in each sync run.

Different types of [wrappers](./file-system-wrappers.md) can be applied above the unified interface. Their existence allows easy extensibility of file system functions.

## Vault Abstraction

`constructor()`: receives an Obsidian vault instance.

`getUid()`: return the vault name

`read()`: wrap `vault.adapter.readBinary()`

`write()`: wrap `vault.adapter.writeBinary()`, then immediately `this.stat()` and return `mtime`.

`writeStream()`:

- simulate a streamed write by wrapping `vault.adapter.appendBinary()`
- read a stream, append to `.trash/<random-string>` in the vault
- when stream finishes, `this.move()` `.trash/<random-string>` to the destination location.
- `this.stat()` and return `uid`.

`delete()`: try to obtain trash file preference from `vault.config.trashOption`, then trash accordingly. If `trashSystem` fails, fallback to `trashLocal`.

`move()`: wrap `vault.adapter.rename()`

`mkdir()`: wrap `vault.adapter.mkdir()`

`stat()`:

- wrap `vault.adapter.stat()`
- convert to the project standard `Stat` format, `uid` uses `mtime` + `size` with delimiter `~`.

`list()`: concurrent DFS `vault.adapter.stat()` + convert to `Stat` array

## WebDAV Abstraction

The WebDAV abstraction should not use any external libraries. Only use Obsidian `requestUrl`-like API with custom request handling.

`constructor()`: receives an options object including `requestUrl()` injection (default to the Obsidian export), user username, WebDAV endpoint, password, and `useInfinity` boolean option.

`getUid()`: user server endpoint + `~` + user account name

`checkConnection()`: most simple method to test whether a WebDAV endpoint, account name, credential are correct.

`read()`: `GET` request to constructed URL

`readStream()`: `GET` with byte range header, each request fixed at 1MiB, multiplex max 4 requests during streaming. When multiplexed response arrives, sort and feed to stream. When back pressure detected, stop making new requests.

`write()`: `PUT` request to constructed URL. Try to find `Etag` in the response header. If found, return it. If not found, `this.stat()` immediately to the file just uploaded and return `uid`.

`delete()`: `DELETE` request to the constructed URL. Swallow `404` errors where the file has already been deleted.

`move()`: `MOVE` request to the constructed URL with `Destination` header.

`mkdir()`: `MKCOL` request to the constructed URL. Optional recursive flag. Swallow `already exist` error.

`stat()`: `PROPFIND` (depth 0) request to constructed URL with custom XML. Parse with `XMLParser` composable, convert to `Stat`. `uid` uses `Etag` if present, otherwise use `mtime` + `~` + `size`.

`exists()`: `PROPFIND` and intercept 404 responses.

`list()`: when `useInfinity` is true, use `PROPFIND` (depth `infinity`) request, parse and convert to `Stat` array. Otherwise concurrent DFS of depth 1 `PROPFIND`. When the `progress` argument is present, reactively update it.

## Principles

**Unified key schema**:

All abstracted file systems should automatically convert between the unified key and their native file path:

- `/` stands for the root.
- `file.md`, `folder/file.md` stand for files.
- `folder/`, `folder/folder/` stand for folders.

In contrast, Obsidian uses:

File: `file.md`, `folder/file.md`
Folder: `folder`, `folder/folder`

While WebDAV uses:

File: `https://.../file.md`, `https://.../folder/file.md`
Folder: `https://.../folder/`, `https://.../folder/folder/`

**Error handling**: Except 404 errors explicitly documented above to swallow, other request errors should be thrown fast. No retry needed (which should be handled by the retry wrapper).

**Local remote disparity**: The local vault has an intentionally different interface with remote. This is for specific reasons:

- We don't need so many wrappers around vault FS.
- Obsidian doesn't support read stream. And thus, we don't need write stream in remote FS.

**Behavioral purity**: Raw FS classes should not carry any additional functions, such as base dir config or retry, they should all be achieved via wrappers.
