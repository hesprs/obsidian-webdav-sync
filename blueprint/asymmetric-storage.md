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

Each folder has a generated 5-byte ASCII anchor (use the algorithm in `packages/plugin/src/fs/utils/generate-anchor.ts`) appended at the end of the folder basename with delimiter `~`. The root folder has ambient anchor `00000`.

Each file and folder also has the anchor of parent directory prepended at the start of the basename with delimiter `~`.

All files and folders become literal files at remote side, the method to distinguish files and folders at remote is the presence of appended anchor.

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
├── 00000~a-folder~z9Eb{m (folder becomes empty file)
├── z9Eb{m~nested.md (file)
└── z9Eb{m~child.md (file)
```

## Implementation

Will be implemented as a [wrapper](./file-system-wrapper.md) above `RemoteFs`. The biggest hurdle is how to obtain already established folder anchors
