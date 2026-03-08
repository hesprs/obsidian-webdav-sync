# src

## Top-level architecture

`src/` is the plugin runtime root. It composes the Obsidian plugin entrypoint, sync engine, infrastructure adapters, and UI/service layers.

Primary entry and wiring files:

- `index.ts` — plugin bootstrap and lifecycle orchestration.
- `api.ts` — external/plugin-facing API surface.
- `consts.ts`, `polyfill.ts`, `webdav-patch.ts` — runtime constants and environment patches.

## Module boundaries

### Core orchestration

- `sync/` — sync engine orchestration, decision pipeline, and task execution.
  - See: `src/sync/codemap.md`
- `services/` — operational services around triggering, execution, status, progress, logging, and WebDAV integration.
  - See: `src/services/codemap.md`

### Infrastructure adapters

- `fs/` — filesystem abstractions/adapters for local vault + WebDAV backends.
  - See: `src/fs/codemap.md`
- `storage/` — persistence layer for blobs, key-value data, and sync records.
  - See: `src/storage/codemap.md`

### Configuration and contracts

- `settings/` — settings model/schema composition and configuration domains.
  - See: `src/settings/codemap.md`
- `model/` — core data models used across sync/services.
  - See: `src/model/codemap.md`
- `types/` — ambient and shared type declarations.
  - See: `src/types/codemap.md`

### Eventing, UI, and shared helpers

- `events/` — typed sync/vault event definitions and event contracts.
  - See: `src/events/codemap.md`
- `components/` — UI modal/ribbon components used by plugin workflows.
  - See: `src/components/codemap.md`
- `utils/` — cross-cutting pure helpers and small infra utilities.
  - See: `src/utils/codemap.md`

### Localization and assets

- `i18n/` — localization runtime and locale loading entrypoints.
- `assets/` — packaged static assets (e.g., CSS).

## High-level runtime flow

1. `index.ts` initializes plugin state and registers commands/UI.
2. Service layer (`services/`) translates triggers into sync execution requests.
3. Sync engine (`sync/`) computes and runs file operations using adapter boundaries (`fs/`, `storage/`).
4. Event and UI modules (`events/`, `components/`) reflect progress/state to users.
