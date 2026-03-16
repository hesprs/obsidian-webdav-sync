# src/utils/mime/

## Responsibility

Contains lightweight file-type predicates used by sync policy decisions. Current scope is markdown-path detection only.

## Design Patterns

- Pure function classification (`isMarkdownPath(path)`).
- Normalization-first matching (`trim` + lowercase).
- Extension-only policy (`.md`, `.markdown`) with zero I/O.

## Data & Control Flow

1. Input path string is normalized.
2. Suffix check returns markdown eligibility.

## Integration Points

- Consumed by `src/sync/utils/is-mergeable-path.ts` to gate text-merge logic and base-text capture.
- No runtime dependency on Obsidian/WebDAV/storage.
