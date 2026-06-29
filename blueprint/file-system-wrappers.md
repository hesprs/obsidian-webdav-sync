# File System Wrappers

A wrapper is a factory function around a `RemoteFs` instance that intercepts the behavior of the original class. A wrapper function receives the original class in the first argument and returns a `RemoteFs`. Infinite layers of wrappers can be applied to the same FS instance.

The root FS without any wrappers are typed `RootRemoteFs` and `RootLocalFs`. Once a layer of wrapper is applied, it changes to `WrappedRemoteFs`, and `WrappedLocalFs`.

There are two kinds of wrappers:

- **Injection wrapper**: only changes some methods of the original FS by directly re-assigning some public members in the root file system. Does not produce new layers.
- **Overlay wrapper**: most common, applies a new layer of wrapper at the top of original FS.

## Base Dir Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Instantiates a new class wrappings around the remote FS to make a specific path as the root dir (format `${string}/`), instead of the entire FS. Receives the base dir in the second parameter in the constructor.

`getUid()`: append `~` + `baseDir` to original `getUid()` output.

All other methods: prepend the base dir to the received key, relay to the original class method. If the method returns `Stat` or `Array<Stat>`, pre-strip all base dirs in the `key` in it.

## Retry Wrapper

Target: `RemoteFs`
Type: injection wrapper

Auto-retry requests. Receives an options object including `maxRetry` (number) and `retryableStatusCodes` (array of string).

Only re-assigns the `request` method in the original class by obtaining it, wrapping with retry logic, and assigning back.

## Rate Limiter Wrapper

Target: `RemoteFs`
Type: injection wrapper

Limit the max concurrency and request interval of remote requests. Receives `maxConcurrency` and `minInterval` as options in the second argument.

Only re-assigns the `request` method in the original class by obtaining it, wrapping with a newly instantiated API limiter composable, and assigning back.

## Memory Control Wrapper

Target: `RemoteFs` & `LocalFs`
Type: overlay wrapper

Separate wrappers for `RootRemoteFs` and `RootLocalFs`, both check and modify shared variables `memoryConsumption` counter and `hangingOperations` pool. Accept number `maxMemory` in the second parameter.

`hangingOperations` pool should always be sorted in ascending order according to the file size of each operation.

Only intercept `read`, `readStream`, `write`, `writeStream` calls:

1. When `read()` and `readStream()` (`RemoteFs` only) arrives, check if spare memory allows the digestion (`read` has size passed in arguments, `readStream` has fixed size 4 MiB). If allows, let it pass through and increment the consumption by the size. If memory is full, move it into the pool and delay the promise. When `read()` or `readStream()` fails, decrement the memory consumption back, check the pool, resume reads.
2. When `write()` or `writeStream()` (`LocalFs` only) finishes, or either of the `write()`, `writeStream()` fails, decrement the consumption (fixed 4 MiB for `writeStream()`), check the pool, resume reads when memory allows.

## Encryption Wrapper

Target: `RemoteFs`
Type: overlay wrapper

Apply client-side encryption / decryption directly at file system level.

Detail see `./encryption.md`.

## Optimization Wrapper

Target: `RemoteFs` & `LocalFs`
Type: overlay wrapper
Mechanism: Microtask-batched atom queue

### Backend-Dependent Optimization

Sync routines must remain backend-independent, but optimal execution strategies vary (e.g., WebDAV requires sequential parent directory creation; S3 allows concurrent uploads). This wrapper decouples logic from optimization by intercepting FS API calls at the root layer to reorder, batch, or schedule execution within promises.

Backends may extend `RootRemoteFs`. Optimizers access these extensions via `digOriginal<SpecialFs>(fs)` to apply backend-specific optimizations without polluting core sync logic.

### Operation Coalescing

Coalescing exploits the JS event loop: raw tasks initiate in parallel, but their synchronous setup executes within the same microtask drain cycle before hitting the first unresolved promise. Since the wrapper ensures only file operations are pending at this boundary, it captures the full operation set immediately upon microtask flush.

**Interception Rules**:

1. Mutations (`delete`, `mkdir`, `move`): Enqueued as `InputAtom`s.
2. Reads (`read`, `readStream`): Keys pushed to shared pools (`remotePool` for `RemoteFs`, `localPool` for `LocalFs`). Pools are injected by `Bootstrap` and shared across wrappers.
3. Writes (`write`, `writeStream`):
   - Reuses deferred execution if a pending anticipated write exists for the key.
   - Passes through otherwise.
   - Note: `readStream` is `RemoteFs`-only; `writeStream` is `LocalFs`-only.
4. Pass-through: `checkConnection`, `getUid`, `stat`, `exists`, `list` bypass interception.

**Execution**:

On microtask flush, the wrapper drains queued atoms and anticipates opposite-side pool keys into synthetic `write` atoms. These are passed to the injected `batchOptimizer`. Single-atom queues execute directly without batching. Queued atoms share real execution and deferred promises via `createCachedPromise()`.

### Context Wrapper

Target: `LocalFs` & `RemoteFs`
Type: overlay wrapper

Intercepts `list()`, `stat()`, `write()`, `writeStream()` (`LocalFS` only), `delete()`, `move()`, and `mkdir()` calls, obtain file & folder stats, and builds a copy of best-effort known stat in memory KV store using `uni-kv` that survives sync runs.

Also completes the `size` optional argument in `read()` or `readStream()` (`RemoteFS` only) calls.

Constants (defined in `packages/plugin/src/types.ts` and `packages/plugin/src/consts.ts`):

- Database name: `STORAGE_NAME`
- Store meta: `MemoryDBMeta`
- Storage schema: `MemoryDBSchema`
- Scope: `localStatContext` and `remoteStatContext` stores

Behavior:

- On `stat()`, upsert the returned stat into the KV store
- On `listAll()`, clear the store and reset according to list result
- On `write()` or `writeStream()`, upsert stat. `mtime` use 0; `size` for `write()` uses actual size, for `writeStream()` use 0.
- On `delete()`, delete the record.
- On `move()`, get and delete original, upsert to new key, also modify the `key` field in the original record.
- On `mkdir()`, upsert folder record.
- All memory database mutation should only happen when original operation succeeds and returns.
- Only once when the wrapper is activated: check if store meta `lastLocalContextUid` or `lastRemoteContextUid` is aligned with the current FS uid. If not, clear target store, and update the meta to the current uid.
- Intercept `read()` and `readStream()` calls, when finding the optional `size?: number` argument is not defined, try to retrieve the size from the store and pass it down. If file even not found in store, keep undefined.

## Cancellation Wrapper

Target: `LocalFs` & `RemoteFs`
Type: both overlay wrapper + injection wrapper for `RemoteFs`

Behavior:

- Receive `isCancelled: () => boolean` in the second argument to detect sync cancellation.
- Intercept all methods except `checkConnection()` in `RemoteFs` and `getUid()`.
- Wrap all method calls with a throw if cancelled at before and after relaying. Special cases: only check cancellation **before** `read()` & `readStream()` and **after** `write()` & `writeStream()` to prevent cancellation race blocking memory control counter release.
- Wrap `request` in `RemoteFs` with a throw if cancelled at before and after requests.
