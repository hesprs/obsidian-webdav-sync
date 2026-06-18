## File System Wrappers

A wrapper is a factory function around a `RemoteFs` instance that intercepts the behavior of the original class. A wrapper function receives the original class in the first argument and returns a `RemoteFs`. Infinite layers of wrappers can be applied to the same FS instance.

The root FS without any wrappers are typed `RootRemoteFs` and `RootLocalFs`. Once a layer of wrapper is applied, it changes to `WrappedRemoteFs`, and `WrappedLocalFs`.

There are two kinds of wrappers:

- **Injection wrapper**: only changes some methods of the original FS by directly re-assigning some public members in the root file system. Does not produce new layers.
- **Overlay wrapper**: most common, applies a new layer of wrapper at the top of original FS.

### Base Dir Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Instantiates a new class wrappings around the remote FS to make a specific path as the root dir (format `${string}/`), instead of the entire FS. Receives the base dir in the second parameter in the constructor.

`getUid()`: append `~` + `baseDir` to original `getUid()` output.

All other methods: prepend the base dir to the received key, relay to the original class method. If the method returns `Stat` or `Array<Stat>`, pre-strip all base dirs in the `key` in it.

### Retry Wrapper

Target: `RemoteFs`
Type: injection wrapper

Auto-retry requests. Receives an options object including `maxRetry` (number) and `retryableStatusCodes` (array of string).

Only re-assigns the `request` method in the original class by obtaining it, wrapping with retry logic, and assigning back.

### Rate Limiter Wrapper

Target: `RemoteFs`
Type: injection wrapper

Limit the max concurrency and request interval of remote requests. Receives `maxConcurrency` and `minInterval` as options in the second argument.

Only re-assigns the `request` method in the original class by obtaining it, wrapping with a newly instantiated API limiter composable, and assigning back.

### Memory Control Wrapper

Target: `RemoteFs` & `LocalFs`
Type: overlay wrapper

Separate wrappers for `RootRemoteFs` and `RootVaultFs`, both check and modify shared variables `memoryConsumption` counter and `hangingOperations` pool. Accept number `maxMemory` in the second parameter.

`hangingOperations` pool should always be sorted in ascending order according to the file size of each operation.

Only intercept `read`, `readStream`, `write`, `writeStream` calls:

1. When `read()` and `readStream()` (`RemoteFs` only) arrives, check if spare memory allows the digestion (`read` has size passed in arguments, `readStream` has fixed size 4 MiB). If allows, let it pass through and increment the consumption by the size. If memory is full, move it into the pool and delay the promise. When `read()` or `readStream()` fails, decrement the memory consumption back, check the pool, resume reads.
2. When `write` arrives and finishes, or `writeStream` (`VaultFs` only) arrives and the stream is fully consumed, or either of the `write()`, `writeStream()` fails, decrement the consumption, check the pool, resume reads when memory allows.
3. Inspect whether a stream is fully consumed by create a new `TransformStream` and pipe the original stream through.

### Encryption Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Apply client-side encryption / decryption directly at file system level.

Detail see `./encryption.md`.

## Common FS Optimization Wrapper

Target: `RemoteFs`
Type: overlay wrapper

This is an optimization wrapper targeting all folder-hierarchy sensitive backends. Coalesce `delete()`, `mkdir()`, `write()` in each microtask drain cycle, other methods slip through directly, principles:

1. Merge and execute `delete()` calls to the shallowest parent that is also deleted, all concurrently.
2. Sort and reorder `mkdir()`, execute from shallowest to deepest sequentially, each level concurrently.
3. `write()` go last concurrently.
4. If only one call is coalesced, let go directly.
5. Special case: if `write()` call arrives while some `mkdir()` or `delete()` calls are being delayed / executed by the wrapper, must delay the write call until deletes and directory creation are done.

## Local FS Optimization Wrapper

Target: `LocalFs`
Type: overlay wrapper

Similar to Common FS Optimization Wrapper, the only difference if that it coalesces `delete()`, `mkdir()`, `write()`, and `writeStream()` calls.

## Context Wrapper

Target: `LocalFs` & `RemoteFs`
Type: overlay wrapper

Intercepts `list()` (`RemoteFS` only), `listAll()`, and `stat()` calls, obtain file & folder stats, and builds a copy of latest stat result in memory KV store using `uni-kv` that survives sync runs. Also completes the `size?` argument in `read()` or `readStream()` calls.

Constants (defined in `src/types.ts` and `src/consts.ts`):

- Database name: `STORAGE_NAME`
- Store meta: `MemoryStorageMeta`
- Storage schema: `MemoryStorageSchema`
- Scope: `localStatContext` and `remoteStatContext` stores

Behavior:

- Eavesdrop on stat operations (`list()`, `listAll()`, `stat()`)
- On `list()` or `stat()`, upsert the returned stat into the KV store
- On `listAll()`, clear the store and reset according to list result
- Only once when the wrapper is activated: check if store meta `lastLocalContextUid` or `lastRemoteContextUid` is aligned with the current FS uid, if not, clear target store, and update the meta to the current uid.
- Intercept `read()` and `readStream()` (`RemoteFs` only) calls, when finding the optional `size?: number` argument is not defined, try to retrieve the size from the store and pass it down. If file even not found in store, keep undefined.
