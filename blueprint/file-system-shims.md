## File System Shims

A shim is a factory function around a `RemoteFs` instance that intercepts the behavior of the original class. A shim function receives the original class in the first argument and returns a `RemoteFs`. Infinite layers of shim can be applied to the same FS instance.

### Base Dir Shim

Target: RemoteFs

Instantiates a new class wrappings around the remote FS to make a specific path as the root dir (format `${string}/`), instead of the entire FS. Receives the base dir in the second parameter in the constructor.

`getUid()`: append `~` + `baseDir` to original `getUid()` output.

All other methods: prepend the base dir to the received key, relay to the original class method. If the method returns `Stat` or `Array<Stat>`, pre-strip all base dirs in the `key` in it.

### Retry Shim

Target: RemoteFs

Auto-retry requests. Receives an options object including `maxRetry` (number) and `retryableStatusCodes` (array of string).

Only re-assigns the `request` method in the original class by obtaining it, wrapping with retry logic, and assigning back.

### Rate Limiter Shim

Target: RemoteFs

Limit the max concurrency and request interval of remote requests. Receives `maxConcurrency` and `minInterval` as options in the second argument.

Only re-assigns the `request` method in the original class by obtaining it, wrapping with a newly instantiated API limiter composable, and assigning back.

### Memory Control Shim

Target: RemoteFs & VaultFs

Separate shims for RemoteFs and VaultFs, both check and modify shared variable `memoryConsumption` and `hangingOperations` pool. Accept number `maxMemory` in the second parameter.

Only intercept `read`, `readStream`, `write`, `writeStream` calls:

1. When `read` and `readStream` arrives, check if spare memory allows the digestion (`read` has size passed in arguments, `readStream` has fixed size 4 MiB). If allows, let it pass through and increment the consumption by the size. If memory is full, move it into the pool and delay the promise.
2. When `write` arrives and finishes, or `writeStream` arrives and `ReadableStream.closed` resolves, decrement the consumption, check the pool, resume reads when memory allows.

### Encryption Shim

Apply client-side encryption / decryption directly at file system level

Detail see `./encryption.md`.
