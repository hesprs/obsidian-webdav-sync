This is a general-purpose Obsidian syncing plugin to sync notes between Obsidian and a WebDAV server.

## Commands

- `bun lint`: format and fix fixable lint errors (always run before `bun check`).
- `bun check`: check types, lint and format (no file change).
- `bun dev`: fast build for daily debug.
- `bun tests`: run all tests. (automatically loads Obsidian mocks. It's `tests`, do not use `bun test`)
- `bun tests <test path>`: run tests in specific file.

## Code Quality

- For mobile compatibility, using any Node API is prohibited.
- Use sentence case for UI text.
- All Obsidian API mock go `test/mocks/obsidian.ts`.

## Repository Map

A full codemap is available at `codemap.md` in the project root. Before working on any task, read `codemap.md` to understand the project. For deep work on a specific folder, also read that folder's `codemap.md`.
