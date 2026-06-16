## File System Wrappers

A wrapper is a factory function around a `RemoteFs` instance that intercepts the behavior of the original class. A wrapper function receives the original class in the first argument and returns a `RemoteFs`. Infinite layers of wrappers can be applied to the same FS instance.

The root FS without any wrappers are typed `RootRemoteFs` and `RootVaultFs`. Once a layer of wrapper is applied, it changes to `WrappedRemoteFs`, and `WrappedVaultFs`.

There are three kinds of wrappers:

- **Root injection wrapper**: only changes some methods of the original FS by direct re-assign some public members in the root file system. Does not produce new layers.
- **Overlay wrapper**: most common, applies a new layer of wrapper at the top of original FS.
- **Insertion wrapper**: travels across layers of wrapper layers and applies itself as a new layer inserting between two layers. Manipulates the layer chain so that it stays linear.

### Base Dir Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Instantiates a new class wrappings around the remote FS to make a specific path as the root dir (format `${string}/`), instead of the entire FS. Receives the base dir in the second parameter in the constructor.

`getUid()`: append `~` + `baseDir` to original `getUid()` output.

All other methods: prepend the base dir to the received key, relay to the original class method. If the method returns `Stat` or `Array<Stat>`, pre-strip all base dirs in the `key` in it.

### Retry Wrapper

Target: `RemoteFs`
Type: root injection wrapper

Auto-retry requests. Receives an options object including `maxRetry` (number) and `retryableStatusCodes` (array of string).

Only re-assigns the `request` method in the original class by obtaining it, wrapping with retry logic, and assigning back.

### Rate Limiter Wrapper

Target: `RemoteFs`
Type: root injection wrapper

Limit the max concurrency and request interval of remote requests. Receives `maxConcurrency` and `minInterval` as options in the second argument.

Only re-assigns the `request` method in the original class by obtaining it, wrapping with a newly instantiated API limiter composable, and assigning back.

### Memory Control Wrapper

Target: `RemoteFs` & `VaultFs`
Type: insertion wrapper that inserts between the root FS and the backend-specific optimization wrapper

Separate wrappers for `RootRemoteFs` and `RootVaultFs`, both check and modify shared variables `memoryConsumption` counter and `hangingOperations` pool. Accept number `maxMemory` in the second parameter.

Only intercept `read`, `readStream`, `write`, `writeStream` calls:

1. When `read` and `readStream` arrives, check if spare memory allows the digestion (`read` has size passed in arguments, `readStream` has fixed size 4 MiB). If allows, let it pass through and increment the consumption by the size. If memory is full, move it into the pool and delay the promise.
2. When `write` arrives and finishes, or `writeStream` arrives and `ReadableStream.closed` resolves, decrement the consumption, check the pool, resume reads when memory allows.

### Encryption Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Apply client-side encryption / decryption directly at file system level.

Detail see `./encryption.md`.

## Common FS Optimization Wrapper

Target: `RemoteFs`
Type: overlay wrapper, but as an optimization wrapper, it must be applied first among overlay wrappers.

Coalesce `delete()`, `mkdir()`, `write()` in each microtask drain cycle, other methods slip through directly, principles:

1. Merge and execute `delete()` calls to the shallowest parent that is also deleted, all concurrently.
2. Sort and reorder `mkdir()`, execute from shallowest to deepest sequentially, each level concurrently.
3. `write()` and `writeStream()` go last concurrently.
4. If only one call is coalesced, let go directly.
5. Special case: if `write()` and `writeStream()` call arrives while some `mkdir()` tasks are delayed by the wrapper, must check if the delayed `mkdir()` calls contain the parents of the write calls. If contains, delay the write call until parents are done.

## Vault FS Optimization Wrapper

Target: `VaultFs`
Type: overlay wrapper, but as an optimization wrapper, it must be applied first among overlay wrappers.

Similar to Common FS Optimization Wrapper, the only difference if that it coalesces `delete()`, `mkdir()`, `write()`, and `writeStream()` calls.
