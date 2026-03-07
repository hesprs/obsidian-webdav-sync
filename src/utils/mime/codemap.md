# src/utils/mime/

## Responsibility

Minimal MIME/path-type helper scope. Currently provides markdown-file detection from path strings in `is_markdown_path.ts`.

## Design Patterns

- Single-purpose stateless predicate: `isMarkdownPath(path)`.
- Input normalization before classification:
  - `trim()` removes surrounding whitespace.
  - `toLowerCase()` makes extension matching case-insensitive.
- Extension-based recognition only (`.md`, `.markdown`), with no filesystem access and no MIME sniffing.

## Data & Control Flow

1. Receive raw path string.
2. Normalize string casing and whitespace.
3. Return boolean by suffix check against two markdown extensions.

## Integration Points

- Exported predicate is consumed by higher-level sync/filter logic when deciding markdown-specific handling.
- No direct dependency on Obsidian, WebDAV, or storage layers.
