This is a general-purpose Obsidian syncing plugin to sync notes between Obsidian and a WebDAV server.

## Commands

- `pnpm lint`: format and fix fixable lint errors (always run before `pnpm check`).
- `pnpm check`: check types, lint and format (no file change).
- `pnpm dev`: fast build for daily debug.
- `pnpm test`: run all tests.

## Code Quality

- No non-null assertion (use `as` assertion)
- No explicit `any`
- Error handling and observables should be handled by the logger, do not throw into the console.
- For mobile compatibility, using any Node API is prohibited.
- Use sentence case for UI text.

## Methodology

- **Small refactor for simplicity and uniformity is always preferred than irresponsible fast patch.** Ask yourself: does this introduce inconsistency or duplication? Are there simpler ways? Is existing code not structured well or redundant? **Do not overdo refactoring, if your refactoring is not to simplify but add additional bloat, consider if you truly need it.**
- **Use fixers strategically to speed up development.**

## Repository Map

A full codemap is available at `codemap.md` in the project root.

Before working on any task, read `codemap.md` to understand:

- Project architecture and entry points
- Directory responsibilities and design patterns
- Data flow and integration points between modules

For deep work on a specific folder, also read that folder's `codemap.md`.
