# src

## Responsibility

`src/` is the plugin runtime root. It composes the Obsidian plugin entrypoint, sync scheduler/executor services, deterministic sync engine, platform adapters, and user-facing component modules.

## System Entry Points

Primary entry and wiring files:

- `index.ts` — plugin bootstrap and lifecycle orchestration.
- `api.ts` — external/plugin-facing API surface.
- `consts.ts`, `webdav-patch.ts` — runtime constants and environment patches.

## Design Patterns

- Composition root in `index.ts` wires long-lived services, event subscribers, settings UI, and command/ribbon entrypoints.
- Clear boundary split between orchestration (`services/`, `sync/`), infrastructure (`fs/`, `platform/`, `storage/`), and presentation (`components/`).
- Platform normalization layer centralizes runtime-sensitive binary/crypto/path behavior instead of duplicating path logic in sync/fs code.

## Module Boundaries

### Core orchestration

- `sync/` — sync engine orchestration, decision pipeline, and task execution.
  - See: `src/sync/codemap.md`
- `services/` — operational services around triggering, execution, status, progress, logging, and WebDAV integration.
  - See: `src/services/codemap.md`

### Infrastructure adapters

- `fs/` — filesystem abstractions/adapters for local vault + WebDAV backends.
  - See: `src/fs/codemap.md`
- `platform/` — runtime-stable binary, crypto, and path primitives shared by fs/sync/utils.
  - See: `src/platform/codemap.md`
- `storage/` — persistence layer for sync-state records and remote traversal snapshots.
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
- `components/` — UI modal/ribbon components and embedded remote explorer used by plugin workflows.
  - See: `src/components/codemap.md`
- `utils/` — cross-cutting pure helpers and small infra utilities.
  - See: `src/utils/codemap.md`

### Localization and assets

- `i18n/` — localization runtime and locale loading entrypoints.
- `assets/` — packaged static assets (e.g., CSS).

## Data & Control Flow

1. `index.ts` initializes plugin state and registers commands/UI.
2. Service layer (`services/`) funnels manual/startup/interval/realtime triggers into the scheduler and guarded executor.
3. Sync engine (`sync/`) computes plans and runs file operations using adapter boundaries (`fs/`, `platform/`, `storage/`).
4. Event and UI modules (`events/`, `components/`) project progress/state to users, including the embedded remote explorer in settings flows.

## Integration Points

- `manifest.json` and Obsidian runtime lifecycle load the plugin entrypoint.
- `src/services` consumes `src/sync`, `src/events`, `src/settings`, and WebDAV transport helpers.
- `src/sync` consumes fs/platform/storage/model/utils layers for planning and execution.
- `src/components` hosts settings and sync UX, including the in-repo explorer module.
