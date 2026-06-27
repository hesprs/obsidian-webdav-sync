This is the monorepo for an extensible Obsidian syncing plugin to sync vault files between Obsidian and various backends. The plugin itself and modules are in `packages/`.

## Commands

- `bun lint`: format and fix fixable lint errors (always run before `bun check`).
- `bun check`: check types, lint and format (no file change).
- `bun dev`: fast build for daily debug.
- `bun tests`: run all tests.
- `bun tests <test path>`: run tests in specific file.
- `bun <command> -F <package-name>`: run command targeting a specific package.

## Packages

- Plugin & module SDK: `packages/plugin/`, package name `@hesprs/sync-engine-sdk`.
- WebDAV module: `packages/webdav/`, package name `webdav`.
- Encryption module: `packages/encryption/`, package name `encryption`.
- Shared utils: `packages/shared/`, package name `@repo/shared`.

## Code Quality

- For mobile compatibility, Node.js API prohibited.
- Sentence case for UI text.
- All Obsidian API mocks go `packages/shared/src/obsidian-mock.ts`.
