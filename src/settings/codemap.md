# src/settings

## Responsibility

Define plugin settings schema and render modular settings UI for account, sync behavior, filters, and logs. The module performs input normalization/validation, immediate persistence through `saveSettings()`, and targeted runtime side effects when a setting changes.

## Design

- **Section composition via `SyncSettingTab`**: `index.ts` creates one container per section and delegates rendering to `AccountSettings`, `CommonSettings`, `FilterSettings`, and `LogSettings`.
- **Shared section base class**: `settings.base.ts` defines `BaseSettings` with shared constructor dependencies (`app`, `plugin`, parent tab, section container) and an abstract `display()` contract.
- **Immediate persistence model**: nearly every input mutates `plugin.settings` and persists immediately via `await plugin.saveSettings()`.
- **Blur-time normalization/validation**:
  - Server URL normalization and protocol checks in `account.ts`.
  - Remote directory canonicalization through `plugin.remoteBaseDir` on blur in `common.ts`.
  - Numeric clamping for startup delay / sync interval and max-size parsing with `bytes-iec`.
- **Modal-driven actions**: filter editing and remote base-dir browsing are delegated to dedicated modal components.
- **Runtime singleton accessor**: `index.ts` exposes `setPluginInstance`, `waitUntilPluginInstance`, and `useSettings()` for deferred settings access once plugin instance is available.

## Flow

1. Obsidian opens the plugin settings tab and calls `SyncSettingTab.display()`.
2. A warning setting row is rendered first, then each section `display()` runs in order: account → common → filter → log.
3. Each section clears and rebuilds only its own container.
4. User edits update in-memory `plugin.settings` and persist through `saveSettings()`.
5. Section-specific side effects run when needed:
   - Account: connection check button validates URL, saves normalized URL, calls `webDAVService.checkWebDAVConnection()`, and updates button/notice state.
   - Common: interval edits call `scheduledSyncService.updateInterval()`; language changes call `i18nService.update()` and then re-render the whole tab.
   - Filter: modal callback replaces inclusion/exclusion rule arrays and re-renders section.
   - Log: export logs to a vault note and open it, or clear logs from `loggerService`.
6. On tab hide, only `accountSettings.hide()` is currently invoked by `SyncSettingTab.hide()`.

## Integration

- **Obsidian API**: `PluginSettingTab`, `Setting`, `Notice`, vault file/folder APIs, and workspace leaf opening.
- **Plugin-level services and state**:
  - `plugin.settings` (`PluginSettings`, `SyncMode` from `index.ts`)
  - `webDAVService` (connection check, client creation)
  - `scheduledSyncService` (auto-sync interval refresh)
  - `i18nService` (language update)
  - `loggerService` (read/clear logs)
- **Components used by settings**:
  - `FilterEditorModal`
  - `SelectRemoteBaseDirModal`
- **Utilities/dependencies**:
  - `bytes-iec` parsing for max file size handling
  - `lodash-es` clamp/isNil
  - remote-path normalization helpers exposed by plugin getters

## Files

- `index.ts` — settings schema/types, plugin-instance helpers, and tab-level section orchestration.
- `settings.base.ts` — abstract base class for all settings sections.
- `account.ts` — server URL/account/credential fields and WebDAV connection check UX.
- `common.ts` — core sync options: remote dir, file-size limit, conflict strategy, behavior toggles, startup/interval timing, sync mode, and language.
- `filter.ts` — inclusion/exclusion rule editing entry points via filter modal.
- `log.ts` — log export to vault note and log clearing.
