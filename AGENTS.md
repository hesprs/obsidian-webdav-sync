This is a general-purpose Obsidian syncing plugin.

Detailed codebase map can be found in `codemap.md` in each directory. Rule of thumb:

- need to know logic and code structure? -> codemaps
- need to know code? -> investigate yourself

## Commands

- `pnpm lint`: format and fix fixable lint errors.
- `pnpm check`: check types, lint and format (no file change).
- `pnpm dev`: fast build for daily debug.
- `pnpm build`: build for distribution (DO NOT USE).
- `pnpm test`: run all tests.

## Code Quality

- No non-null assertion (use `as` assertion)
- No explicit `any`

## Repository Map

A full codemap is available at `codemap.md` in the project root.

Before working on any task, read `codemap.md` to understand:

- Project architecture and entry points
- Directory responsibilities and design patterns
- Data flow and integration points between modules

For deep work on a specific folder, also read that folder's `codemap.md`.
