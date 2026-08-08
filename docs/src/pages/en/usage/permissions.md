# Runtime Permissions

This page is an exhaustive list of runtime APIs used by Sync Engine and official modules that may raise concerns, with verifiable explanations that justify their necessity. You can also compare this list against Obsidian Community website "Disclosure" section in the plugin scorecard.

## Dynamic JavaScript Module Evaluation

Dynamic JavaScript module evaluation is a type of _dynamic code execution_, which is similar to how Obsidian loads plugins. It is essential for Sync Engine's extensible architecture.

Sync Engine only evaluates JavaScript ESM modules explicitly downloaded or approved by the user, and only when the plugin starts, a module auto-updates, or the user explicitly toggles.

Sync Engine implements a series of mechanisms to minimize the attack surface brought by module evaluation. Refer to [Security](./security) for more detail.

## Access and Modify Vault Files

Sync Engine accesses and modifies vault files for basic syncing and module management requirements.

It obtains the last modified time and file size for each file to detect changes; reads files and uploads to configured syncing backend; and updates or deletes local files according to detected remote changes. Deleted files are moved to system or Obsidian trash folder.

Sync Engine only accesses and modifies vault files during sync runs, and it never tries to access files that are explicitly excluded by [inclusion and exclusion rules](./settings#inclusion-and-exclusion-rules).

Sync Engine also persists its modules in `<vault folder>/.obsidian/plugins/sync-engine/modules/`.

## Network Requests

Sync Engine only makes network requests for the two purposes below:

- performs authorization and syncs files to the configured backend
- fetches module sources and downloads modules

Requests made for syncing purpose only happen during sync runs.

Module sources are fetched only when automatic module update starts or user opens the module management panel. Sync Engine only fetches module sources defined in the "Module sources" setting. Modules are only downloaded when the user manually downloads a module or during module auto update.

The only default module source is `https://sync.consensia.cc/modules.json`, `sync.consensia.cc` is hosted on GitHub pages, whose source code is 100% transparent and verifiable in Sync Engine GitHub repository.

Sync Engine plugin and `sync.consensia.cc` don't contain any type of telemetry.

## Obsidian Secret Storage

Obsidian secret storage is shown as "Keychain" in Obsidian settings. Sync Engine and official modules acquire secrets in following scenarios:

- Plugin core: reads the configured [secret headers](./settings#custom-headers) at the start of a sync run
- [WebDAV](../deep-dive/modules/webdav) module: reads the configured WebDAV token secret at the start of a sync run for service authentication
- [S3](../deep-dive/modules/s3) module: reads the configured secret access key when resolving S3 credentials for connection checks or sync operations
- [Encryption](../deep-dive/modules/encryption) module: reads the configured encryption password secret at the start of a sync run for later encryption and decryption

Sync Engine and official modules never read beyond what is provided by the user.

## IndexedDB Storage

IndexedDB is a browser API to store data in an embedded database instead of physical files. Sync Engine utilizes IndexedDB through the [`uni-kv`](https://github.com/hesprs/uni-kv) package.

The plugin core uses IndexedDB for following purposes:

- records the unique identifiers of known synced local and remote files, to facilitate the three-way change detection of next sync
- records metadata including enable state and integrity hash for each installed module. This is because IndexedDB is immune from common vault file replacement attacks, Sync Engine utilizes this to guard module execution to the only ones approved by the user
