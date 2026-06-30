# Asymmetric Storage

## Context

Asymmetric storage means that the file structure at remote differs from the real hierarchies at local.

Symmetric hierarchal file storage on both local and remote has significant drawbacks regarding query speed, request frequency, and obfuscation:

- during traversal, the APP needs to recursively traverse nested folders, the minimum time complexity is O(depth) when all folders of the same depth are traversed concurrently.
- the APP needs to make network request for each folder, may reach rate limit.
- during execution, the APP needs to care about folder hierarchies, the minimum time complexity is O(existing depth - target depth) with complex concurrency optimization.
- the encrypted remote file structure mirrors the unencrypted shape, and files with the same basename always have the same ciphertext file name according to [current encryption schema](./encryption.md), which signals insufficient obfuscation.

Even classical asymmetric storage in _object storage_ (flat entries, file path as keys) has drawbacks:

- when a file is deeply nested, the key becomes very long, may exceed max length (when encryption is applied, it can be longer)
- the flat shape is decoupled from the real shape, making structural drift possible.
- when a folder is renamed, all descendants need cascade renaming.

Due to the reasons above, with respect to the fact that most users don't care about remote shape when syncing (they can disable if they'd like to), **asymmetric storage with hierarchal anchors** is proposed to eliminate all the frictions.

## Mechanism

The files and folders are represented in a flat style at remote, no matter how nested is local.

Each folder has a generated 5-byte ASCII anchor (use the algorithm in `packages/plugin/src/fs/utils/generate-anchor.ts`) prepended at the start of the folder basename with delimiter `~`. The root folder has ambient anchor `00000`.

Each file and folder also has the anchor of parent directory prepended at the start of the basename. So that the prepended basename become:

- file: `<parent-anchor>~<basename>`
- folder `<parent-anchor><local-anchor>~<basename>`
- root: still `/`

All files and folders become literal files at remote side, the method to distinguish files and folders at remote is the presence of local anchor.

For example, a file tree like below:

```text
/ (root)
├── foo.md (file)
├── bar.md (file)
├── abc.md (file)
└── a-folder/ (folder)
    ├── nested.md (file)
    └── child.md (file)
```

Can be flattened as:

```text
/ (root)
├── 00000~foo.md (file)
├── 00000~bar.md (file)
├── 00000~abc.md (file)
├── 00000z9Eb{m~a-folder (folder becomes empty file)
├── z9Eb{m~nested.md (file)
└── z9Eb{m~child.md (file)
```

The anchor generation algorithm is deterministic, it needs to take `<parent-anchor>~<basename>` as seed to generate an anchor. For example, the seed of `a-folder/` into the algorithm is `00000~a-folder`.

Despite the determinism in generation algorithm, the implementation should not assume the anchor generation is deterministic. Since once it is, renaming a folder would require cascade rename of all descendants. Instead, the implementation should infer folder-anchor pairing from a list of existing, flattened file names.

## Implementation

Asymmetric storage will be implemented as a [overlay wrapper](./file-system-wrappers.md) above `RemoteFs`. It depends on a direct adjacent context wrapper nearer to root to provide initial list of flattened file names to infer.

The wrapper maintains two symmetric maps of folder key to anchor and anchor to folder key, used by flattening and de-flattening. The two maps are built only once per sync lifecycle from the keys stored in `memoryDB` `remoteStatContext` store when the first non-root key needing flattening / de-flattening arrives.

Per-method specification:

- `getUid()`, `checkConnection()`: keep as-is.
- `read()`, `readStream()`, `write()`, `delete()`, `move()`, `stat()`, `exists()`, `mkdir()`, `list()`: flatten keys before relaying
- `move()`: special check before relaying: if the flattened old key and new key are the same, return directly.
- `stat()`, `list()`: de-flatten keys each item after return, flip `isDir` flag when local anchor detected.
- `mkdir()`: redirect to `write()` of an empty array buffer
