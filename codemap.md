# Repository Atlas - Obsidian Sync

## Project Responsibility

This plugin enables two-way synchronization between Obsidian notes and remote servers via WebDAV protocol. It features incremental sync, smart conflict resolution, and a WebDAV explorer. The project is being re-engineered to be a general-purpose Obsidian syncing plugin, moving away from its Nutstore-specific origins.

## System Entry Points

- **`src/index.ts`**: The main entry point for the Obsidian plugin, initializing services and registering commands.
- **`manifest.json`**: Plugin metadata, versioning, and configuration for the Obsidian environment.
- **`package.json`**: Defines project dependencies, build scripts (`esbuild`), and workspace configuration.
- **`esbuild.config.ts`**: Build configuration for bundling the plugin and its dependencies.

## Repository Directory Map

| Directory | Responsibility Summary | Detailed Map |
| :--- | :--- | :--- |
| `src/sync` | Core synchronization logic, orchestrating local and remote state comparison and task execution. | [codemap.md](./src/sync/codemap.md) |
| `src/events` | Centralized event bus using RxJS for synchronization, authentication, and vault operations. | [codemap.md](./src/events/codemap.md) |
| `src/services` | Plugin lifecycle management, sync orchestration, UI state, and external integrations. | [codemap.md](./src/services/codemap.md) |
| `src/fs` | Unified abstraction layer for local (Obsidian Vault) and remote (WebDAV) file system operations. | [codemap.md](./src/fs/codemap.md) |
| `src/fs/utils` | Utility functions for path validation and maintaining structural integrity during filtering. | [codemap.md](./src/fs/utils/codemap.md) |
| `src/storage` | Local persistence management using IndexedDB for sync records, blobs, and cache. | [codemap.md](./src/storage/codemap.md) |
| `src/types` | Type definitions for the system. | [codemap.md](./src/types/codemap.md) |
| `packages/webdav-explorer/src` | Source code for the WebDAV explorer package. | [codemap.md](./packages/webdav-explorer/src/codemap.md) |
| `src/settings` | Plugin settings management and UI. | [codemap.md](./src/settings/codemap.md) |
| `src/sync/utils` | Helper functions for task optimization and record management. | [codemap.md](./src/sync/utils/codemap.md) |
| `src/sync/decision` | Logic for determining which sync actions are necessary based on the current state. | [codemap.md](./src/sync/decision/codemap.md) |
| `src/sync/core` | Low-level utilities for merging and comparing file states. | [codemap.md](./src/sync/core/codemap.md) |
| `src/sync/tasks` | Individual, executable units of work (e.g., Push, Pull, Delete). | [codemap.md](./src/sync/tasks/codemap.md) |
| `src/utils/mime` | MIME type detection and handling. | [codemap.md](./src/utils/mime/codemap.md) |
| `src/utils` | General utility functions for path manipulation, hashing, and glob matching. | [codemap.md](./src/utils/codemap.md) |
| `src/model` | Data models for file metadata and sync records. | [codemap.md](./src/model/codemap.md) |
| `src/api` | API communication logic and WebDAV client integration. | [codemap.md](./src/api/codemap.md) |
| `src/components` | UI components including modals, notices, and status bar elements. | [codemap.md](./src/components/codemap.md) |
| `src` | Main source directory containing the plugin entry point and core modules. | [codemap.md](./src/codemap.md) |
| `packages/webdav-explorer` | Visual file browser for remote WebDAV file management. | [codemap.md](./packages/webdav-explorer/codemap.md) |
| `packages` | Workspace packages including the WebDAV explorer. | [codemap.md](./packages/codemap.md) |
| `packages/webdav-explorer/src/components` | UI components for the WebDAV explorer. | [codemap.md](./packages/webdav-explorer/src/components/codemap.md) |
