# src/settings/

## Responsibility

Owns the plugin’s persisted settings schema and the Obsidian settings tab used to edit it. This folder defines the shape of `PluginSettings`, the conflict strategy enums, the shared settings-tab base class, and the sectioned UI for account, common, control, filter, and development options.

## Design

- `PluginSettings` is the source of truth for all saved options.
- Numeric/toggled settings use `ToggleNumericSettingsField` (`enabled` + `value`) to represent optional thresholds, delays, and limits.
- `ConflictStrategy` and `UnmergeableStrategy` constrain dropdown values to known sync behaviors.
- `SyncSettingTab` composes one section class per group and renders them in order.
- `BaseSettings` only stores shared constructor context and requires `display()`.
- `generateSettingEntry()` centralizes the common “toggle + validated numeric input” pattern.

## Flow

1. `src/index.ts` creates `plugin.settings` with defaults matching the schema here.
2. On load, the plugin merges saved data into that object and passes the plugin into `SyncSettingTab`.
3. Each section mutates `plugin.settings` directly from UI callbacks, then calls `plugin.saveSettings()`.
4. Text fields validate/normalize on blur:
   - `handleInput()` trims/parses string fields like `serverUrl`, `account`, and `remoteDir`.
   - `generateSettingEntry()` parses number/time/file-size inputs, rejects invalid or out-of-range values, restores the previous value, and shows a notice.
5. Section-specific callbacks also trigger side effects when settings change, such as updating API limiter values, restarting scheduled sync, or refreshing mobile notifications.

## Integration

- `src/index.ts` consumes the schema for defaults, persistence, encryption, sync scheduling, and account checks.
- `handle-input.ts` is used by account fields for string normalization and save-on-blur behavior.
- `generate-setting-entry.ts` powers common and control numeric settings, using `input-converters.ts` for time/file-size formatting and parsing.
- `plugin-instance.ts` exposes the active plugin/settings instance to code that needs settings before direct injection is available.
- `FilterSettings` opens `FilterEditorModal`, and `DevelopmentSettings` clears IndexedDB namespaces or exports logs.
- The UI depends on `obsidian` `Setting`, `TextComponent`, `SecretComponent`, notices, and modal interactions.
