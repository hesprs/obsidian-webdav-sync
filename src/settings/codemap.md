# Settings Module Codemap

## Responsibility

The `settings` directory is responsible for managing the plugin's configuration UI and persisting user preferences. It breaks down complex settings into manageable sub-sections.

- **`index.ts`**: The entry point for settings. Defines the `NutstoreSettingTab` (the main UI container), the `NutstoreSettings` interface (data structure), and the `SyncMode` enum. It orchestrates the rendering of all sub-sections.
- **`settings.base.ts`**: Defines the `BaseSettings` abstract class, providing a common interface and shared dependencies (App, Plugin, SettingTab) for all settings sub-components.
- **`account.ts`**: Manages authentication settings. Supports both Manual (WebDAV credentials) and SSO login modes. Includes a connection testing utility.
- **`common.ts`**: Handles core synchronization parameters such as remote directory paths, conflict resolution strategies, sync intervals (startup and periodic), and file size limits.
- **`filter.ts`**: Provides the interface for configuring file inclusion and exclusion rules, delegating the actual editing to the `FilterEditorModal`.
- **`cache.ts`**: Manages the remote cache location and provides tools for backing up, restoring, and clearing synchronization metadata.
- **`log.ts`**: Offers diagnostic tools, including the ability to clear logs or export them into a Markdown note within the vault.

## Design Patterns

- **Component-Based UI Composition**: The main `NutstoreSettingTab` acts as a coordinator that composes multiple specialized settings classes. Each class is responsible for a specific `div` container within the settings tab.
- **Inheritance**: Uses the Template Method pattern via `BaseSettings` to ensure all settings sections implement a `display()` method and have access to the plugin context.
- **Reactive Updates**: The settings tab subscribes to SSO events (via `onSsoReceive`) to automatically refresh the UI when authentication state changes.
- **Encapsulation**: Validation logic (e.g., for file sizes in `common.ts`) and complex UI interactions (e.g., SSO timer in `account.ts`) are encapsulated within their respective sub-components.

## Data & Control Flow

- **Settings Persistence**: User interactions in the UI trigger updates to the `this.plugin.settings` object. These changes are immediately persisted to disk using `this.plugin.saveSettings()`.
- **Rendering Flow**: When the settings tab is opened, `NutstoreSettingTab.display()` is called, which in turn calls the `display()` method of each sub-component sequentially. Each sub-component clears its container and rebuilds its specific UI elements.
- **Validation Loop**: Input fields (like sync intervals or file sizes) perform validation on `blur` or `change`. If invalid, they revert to the last known good value and notify the user via an Obsidian `Notice`.
- **Service Integration**: Changes to certain settings (like language or sync interval) trigger immediate updates in the corresponding background services (`I18nService`, `ScheduledSyncService`).

## Integration Points

- **Obsidian Framework**: Extends `PluginSettingTab` and heavily utilizes the `Setting` and `Notice` APIs for UI construction and user feedback.
- **Internal Services**:
  - `WebDAVService`: Used by `AccountSettings` for connection checks and `CacheSettings` for directory operations.
  - `ScheduledSyncService`: Updated by `CommonSettings` when sync intervals change.
  - `I18nService`: Triggered by `CommonSettings` to switch the plugin's display language.
  - `LoggerService`: Accessed by `LogSettings` for log management.
- **Modals**: Integrates with various specialized modals (`FilterEditorModal`, `SelectRemoteBaseDirModal`, etc.) for complex configuration tasks.
- **External Dependencies**:
  - `@nutstore/sso-js`: For generating SSO authentication URLs.
  - `bytes-iec`: For parsing and validating human-readable file size strings (e.g., "500MB").
