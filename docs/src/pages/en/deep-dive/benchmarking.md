# Benchmarking

## Benchmark Standards

The benchmark aims to obtain reliable and reproducible sync performance and algorithmic correctness statistics between Sync Engine and other syncing plugins. The Obsidian instance must have only the benchmarked plugin installed during a benchmark. And the benchmarked plugin must use the default settings except necessary account configuration.

Each benchmark contains fixed routines and test cases as specified below, any special deviation from the test routine must be documented clearly.

### Benchmark Signature

To ensure reproducibility, each benchmark must contain following metadata:

- Benchmarked plugin
- Obsidian version
- Benchmarked plugin version
- Benchmarking machine operating system (due to benchmarking script assumption, Windows is not supported)
- Benchmarking machine Geekbench 7 CPU single-core score (can search from [Geekbench website](https://browser.geekbench.com/) and estimate average)
- Tested remote backend type and service
- Average ping delay to tested service in milliseconds (use [Ping Tester](#ping-tester))
- Average upload and download speed of the tested service in MiB/s.

### Test Cases

**Plugin size**: Obtained from the GitHub release page of the corresponding version.

**Startup speed**:

On the benchmarking machine, kill Obsidian Electron APP completely and restart for 5 times, each time record down Obsidian settings -> General -> Advanced -> Notify if startup takes longer than expected -> Stopwatch icon -> benchmarked plugin startup time in milliseconds. Then take average over the 5 records.

**Upload speed**:

Initiate a deterministic test vault using [Test Vault Bootstrapper](#test-vault-bootstrapper). Turn the limit off if the benchmarked plugin has large file size limits.

Then start a non-interactive sync using the plugin, wait for it to finish, and access the plugin's built in logs / profiler to obtain total sync duration. If the plugin has no non-interactive option or profiler, take screen record and perform manual UI operations. Then trim the record to critical breakpoints and measure video length.

**Download speed**:

Reuse the already uploaded test vault above, create a new empty vault and configure the benchmarked plugin. Perform full sync to download those files from remote and record down duration.

**Daily sync speed**

Now we should have two copies of the vault, one (original) is generated from [Test Vault Bootstrapper](#test-vault-bootstrapper), another one (replica) is newly downloaded from remote.

Perform deterministic sync-on-change using [Operation Executor](#operation-executor) inside the original vault. The scripts contains 10 independent and sequential test cases covering create, modify, delete, and rename (move) operations to simulate small but frequent user edit. Each operation is gated with CLI command to continue. A sync is triggered every case in original vault first, then in replica vault. If the benchmarked plugin has "Sync on change" option, enabled it in original vault.

When all cases finish, calculate the max, min, and median duration of the above 10 syncs.

**Sync correctness**:

Run [Correctness Validator](#correctness-validator) on both original and replica vault, sum up the total count of errors appeared in each vault. This stands for the stability and reliability of the plugin.

## Benchmarking Utilities

The benchmarking utilities are located in `scripts/benchmark/` in this repo. It is a CLI application majorly interacting with Obsidian CLI with five modules: Test Vault Bootstrapper, Operation Executor, Correctness Validator, Speed Tester, and Ping Tester.

### Test Vault Bootstrapper

File: `scripts/benchmark/test-vault.ts`

Initiate a deterministic test vault using `scripts/benchmark/test-vault.ts`. Clears the vault first, then populates the vault with a large vault simulation with randomly and deeply nested files; consists 1880 small files with sizes ranging from 50 bytes to 50 KiB, 100 medium files with sizes ranging from 500 KiB to 2 MiB, and 20 large files with sizes ranging from 15 MiB to 100 MiB.

### Operation Executor

File: `scripts/benchmark/daily-test.ts`

Operation Executor executes defined command operations in series or in parallel, it follows a declarative syntax to iterate over an array of `Commands`:

```TypeScript
type MaybePromise<T> = Promise<T> | T;
type Command =
	| string
	| { command: string; callback: (result: $.ShellPromise) => MaybePromise<void> };
type Commands = Array<Command | Array<Command>>;
```

All commands in a sub-array inside the command array are executed concurrently.

The commands are hooked to the running Obsidian instance via executing Obsidian CLI commands:

- `obsidian create path=<path> content=<content> overwrite`
- `obsidian delete path=<path>`
- `obsidian move path=<path> to=<destination>`

The Daily Test routine contains 10 test cases, executed in series to simulate small but frequent user edits. The benchmarked plugin is required to perform a sync for each test case. The duration of each sync is measured for evaluation.

### Correctness Validator

File: `scripts/benchmark/validator.ts`

The validator is used to validate the sync correctness after the set of operations executed by [Operation Executor](#operation-executor) and following syncs. It scans a vault and validates the existence of each file and folder, missing or extra ones all marked as error. For files that are appended in the test cases, it additionally validates the size of the file.

After validation, it outputs the total count of errors, and each error with its reason.

### Speed Tester

File: `scripts/benchmark/speed-test.ts`

The speed tester tests both upload and download speeds. It needs the benchmarker to edit `scripts/benchmark/speed-test.ts` to include necessary request endpoint and authorization headers.

When started, it launches sequential `PUT` and `GET` requests to testing uploading and downloading a generated 50 MiB test file. After tests, it launches `DELETE` request to the same URL to clean up the test file.

It computes the average upload and download speeds via 50MiB / recorded time.

### Ping Tester

File: `scripts/benchmark/ping-test.ts`

The Ping Tester tests average HTTP ping delay when trying to connect to a URL. It launches 20 sequential HTTP `HEAD` requests toward the target and record the response delay.

After all tests, it sorts the request delays and discard the longest two and shortest two delays. The calculate the average for the rest 16 samples.
