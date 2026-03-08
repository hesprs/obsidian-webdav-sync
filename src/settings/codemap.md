# src/settings

## Responsibility

Own the plugin settings UI for account, sync behavior, filters, cache, and logs, and define the settings shape used by the plugin. This module is responsible for rendering settings controls, validating/normalizing user input, persisting changes via `saveSettings()`, and triggering immediate side effects when specific settings require runtime updates.

## Design

- **Section composition via `SyncSettingTab`**: `index.ts` creates one container per section and delegates rendering to `AccountSettings`, `CommonSettings`, `FilterSettings`, `CacheSettings`, and `LogSettings`.
- **Shared section base class**: `settings.base.ts` defines `BaseSettings` with shared constructor dependencies (`app`, `plugin`, parent tab, section container) and an abstract `display()` contract.
- **Immediate persistence model**: nearly every input writes directly to `plugin.settings` and then awaits `plugin.saveSettings()`.
- **Blur-time normalization/validation**:
  - Server URL normalization in `account.ts` (`http/https`, trim trailing slashes).
  - Remote directory and cache directory normalized by reading back computed getters and re-rendering on blur.
  - Numeric and size constraints in `common.ts` (clamp startup delay and sync interval, parse file-size limits with `bytes-iec`).
- **Modal-driven advanced actions**: filters, remote directory picking, cache save/restore/clear flows are handled by dedicated modal components.
- **Runtime singleton accessor**: `index.ts` exposes `setPluginInstance`, `waitUntilPluginInstance`, and `useSettings()` for deferred settings access once plugin instance is available.

## Flow

1. Obsidian opens the plugin settings tab and calls `SyncSettingTab.display()`.
2. A warning setting row is rendered first, then each section `display()` runs in order: account → common → filter → cache → log.
3. Each section clears and rebuilds only its own container.
4. User edits update in-memory `plugin.settings` and persist through `saveSettings()`.
5. Section-specific side effects run when needed:
   - Account: connection check button validates URL, saves normalized URL, calls `webDAVService.checkWebDAVConnection()`, and updates button/notice state.
   - Common: interval edits call `scheduledSyncService.updateInterval()`; language changes call `i18nService.update()` and re-render the full tab.
   - Filter: modal callback replaces inclusion/exclusion rule arrays and re-renders section.
   - Cache: remote cache path setting and cache operations (save/restore/clear) execute through modals and callbacks.
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
  - `CacheSaveModal`, `CacheRestoreModal`, `CacheClearModal`
- **Utilities/dependencies**:
  - `bytes-iec` parsing for max file size handling
  - `lodash-es` clamp/isNil and `ramda` isNotNil
  - path/helpers for cache paths (`path-browserify` `join`, `stdRemotePath`, `getDBKey`)

## Files

- `index.ts` — settings schema/types, plugin-instance helpers, and tab-level section orchestration.
- `settings.base.ts` — abstract base class for all settings sections.
- `account.ts` — server URL/account/credential fields and WebDAV connection check UX.
- `common.ts` — core sync options: remote dir, file-size limit, conflict strategy, toggles, delays/intervals, sync mode, and language.
- `filter.ts` — inclusion/exclusion rule editing entry points via filter modal.
- `cache.ts` — remote cache directory config and cache save/restore/clear actions.
- `log.ts` — log export to vault note and log clearing.
