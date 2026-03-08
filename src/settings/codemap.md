# src/settings

## Responsibility

Define settings schema and render modular configuration UI sections that validate input, persist plugin preferences, and apply runtime configuration changes.

## Design Patterns

- Section-composition pattern: `SyncSettingTab` composes specialized setting section classes.
- Shared base class pattern: `BaseSettings` provides common plugin/tab dependencies and display contract.
- Immediate persistence pattern: control callbacks update `plugin.settings` and call `saveSettings()`.
- Encapsulated validation pattern for numeric/size/path/auth fields within each section.
- Modal-assisted editing for complex inputs (filters, remote directory selection, cache actions).

## Data & Control Flow

1. Opening plugin settings invokes `SyncSettingTab.display()`.
2. `index.ts` instantiates/renders section components (`account`, `common`, `filter`, `cache`, `log`).
3. User edits mutate in-memory settings and persist through `plugin.saveSettings()`.
4. Field-level validators normalize or reject invalid values and surface feedback via `Notice`.
5. Side-effecting settings changes propagate to runtime services (e.g., scheduler interval, language updates, connection checks).

## Integration Points

- Obsidian settings framework: `PluginSettingTab`, `Setting`, and `Notice`.
- Plugin core settings model (`PluginSettings`, sync mode enums/defaults).
- Internal services: `WebDAVService`, `ScheduledSyncService`, `I18nService`, `LoggerService`.
- UI modals from `src/components` for filter editing, remote path picking, and cache maintenance.
- Utility dependency `bytes-iec` for human-readable byte parsing/validation.

## Key Files

- `index.ts` — settings tab entrypoint, schema/types, section orchestration.
- `settings.base.ts` — abstract base class and shared section utilities.
- `account.ts` — account/auth mode controls and connectivity checks.
- `common.ts` — core sync behavior options (paths, intervals, conflicts, limits, language).
- `filter.ts` — include/exclude rule settings and filter modal integration.
- `cache.ts` — cache location/back-up/restore/clear settings UI.
- `log.ts` — log cleanup and export tooling.
