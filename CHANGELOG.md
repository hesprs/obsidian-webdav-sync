# Changelog

All notable changes to this project will be documented in this file.

## Obsidian WebDAV Sync v2.5.11 - 2026-06-02

- Fixed the bug that causes smart merge to fail due to undefined iterator.

## Obsidian WebDAV Sync v2.5.10 - 2026-05-30

- Added traditional Chinese translation.
- Fixed the bug that causes the plugin fail to resolve absolute URL paths returned by servers.
- Made clicking the sync button during syncing open the progress modal instead of doing nothing.
- Optimized several points to improve code clarity and prevent infinite retries.

## Obsidian WebDAV Sync v2.5.9 - 2026-05-24

- Fixed task name display error in progress modal.
- Removed outdated migration script.
- Improved logger for specificity, simplicity and memory usage.
- Reduced redundant stat calls after mkdir operations.

## Obsidian WebDAV Sync v2.5.8 - 2026-05-22

- Remove invalid characters check since most services actually support them.
- Adjusted misconfigured default schedule interval from 600ms to 6000ms.

## Obsidian WebDAV Sync v2.5.7 - 2026-05-18

- Fixed traversal errors that encryption makes the plugin think almost remote files are deleted.

## Obsidian WebDAV Sync v2.5.6 - 2026-05-17

- Fixed WebDAV response parsing glitches on Mailbox service.
- Simplified and improved logger for specificity.
- Simplified several request-related logic.

## Obsidian WebDAV Sync v2.5.5 - 2026-05-13

- Fixed sync execution itself triggering real-time sync.
- Refurbished and simplified failed task display for better human readability.
- Adjusted some minor formatting issues in logger.

## Obsidian WebDAV Sync v2.5.4 - 2026-05-08

- Refactored auto-sync scheduling logic (startup sync, scheduled sync, real-time sync).
- Fixed various bugs related with sync scheduling.

## Obsidian WebDAV Sync v2.5.3 - 2026-05-07

- Fixed the bug that startup sync uses real-time sync delay.
- Fixed user config file size and time unit convert glitches.

## Obsidian WebDAV Sync v2.5.2 - 2026-05-04

- Fixed the bug that all uploads, downloads, and deletion are repeated for three times.

## Obsidian WebDAV Sync v2.5.1 - 2026-05-03

- Specify encryption reminder modal text to prevent confusion.
- Correct inconsistencies in reminder text.
- Format the text to make it more readable.

## Obsidian WebDAV Sync v2.5.0 - 2026-05-03

- Implemented client-side encryption. The encryption mechanism is faster, smaller, and more secure than similar solutions (like Remotely Save). See detail in [algorithm spec](https://github.com/hesprs/obsidian-webdav-sync/blob/main/docs/encryption.md).
- Adjusted settings entry description for better understanding.
- Improved chunked downloading for better error
- Fixed cancel button doesn't appear during pre-connecting.
- Fixed deleting folders contain changed items causing 404 error.

## Obsidian WebDAV Sync v2.4.1 - 2026-04-25

- Adjusted manual sync progress UI address text overflow problem on mobile devices.
- Refactored and standardized internal data flow of tracking sync progress.
- Fixed the bug that, when the UI is previously hidden, confirm the sync using the progress UI will cause the sync to be aborted.
- Improved i18n and iconography, removed unused entries.

## Obsidian WebDAV Sync v2.4.0 - 2026-04-25

### Performance, Stability, and UI Improvements

- Replaced the sync task selection and confirmation modals with an interactive file-tree interface, allowing visually browse and select specific files or folders for synchronization.
- Enabled reliable resumption of large file downloads by implementing chunked storage, ensuring that interrupted transfers can continue from where they left off without restarting.
- Optimized memory usage during sync operations by introducing smart load balancing, which prevents performance spikes and keeps the application responsive even when handling gigabytes at once.
- Simplified the sync progress display and behavior, providing a clearer and more consistent view of ongoing synchronization tasks.
- Added an option to recursively traverse all remote directories (`Depth: infinity`) in one request to further improve performance.
- Streamlined sync settings by renaming "Fast Sync" to "Fast Realtime Sync" for clarity and removing the confusing "Sync Mode" option, reducing configuration complexity.
- Standardized the settings interface with improved input validation, reusable components, and human-readable file size and time conversions, making it easier to configure and understand sync preferences.

## Obsidian WebDAV Sync v2.3.2 - 2026-04-14

- Fixed the file deletion bug that causes the plugin unable to delete any files on Android.
- Made the plugin prune stale records during syncing.

## Obsidian WebDAV Sync v2.3.1 - 2026-04-13

- Fixed the i18n bug that causes all non-English default users all fallback to English when they are using their native locale in Obsidian.

## Obsidian WebDAV Sync v2.3.0 - 2026-04-13

**Note: breaking change present (moved WebDAV credential into secret store), but auto-migration available. The real intrusion is zero for most users.**

### Security / credentials

- Store WebDAV credentials in Obsidian’s credential storage instead of plaintext settings.
- Added a migration that moves existing plaintext tokens into the secret store.

### Sync engine / behavior

- Supported syncing the `.obsidian/` config folder (excluded by default).
- Updated realtime sync to honor inclusion / exclusion glob rules before real-time sync.
- Added fallback handling for non-mergeable files when smart merge is selected.
- Moved conflict-resolution strategy settings into the settings model and updated the sync decision flow accordingly.
- Simplified startup setup by replacing command and i18n service classes with direct setup functions.
- Switched vault traversal, stat reads, content reads, and trashing to adapter-based async APIs.
- Introduced a vault-aware trash file location now respects user's configured trash location instead of into Obsidian trash.

### Internationalization / settings cleanup

- Replaced i18next with a lightweight custom translation helper and typed translation keys to decrease bundle size and improve performance.
- Fixed language auto detection that always display English.
- Removed the manual language setting and the related i18n setup service. Now the i18n option is entirely integrated with Obsidian's language setting.

## Obsidian WebDAV Sync v2.2.0 - 2026-04-11

### Memory and performance optimizations

- Replaced the rxjs-based sync event bus with lightweight hooks/ref helpers, simplifying sync state propagation across the modal, ribbon, commands, unload flow, and related UI/services.
- Refactored sync task handling and logging to reduce noise, tighten typing, remove unnecessary async/await patterns, and simplify progress summary structures.
- Changed planning to create tasks directly from current file stats instead of snapshot-based planning, and moved file-content loading into push/pull/merge tasks for lazier, more targeted fetches.
- Removed the planning “deciding” substage and updated progress/i18n text accordingly.
- Introduced a maxConcurrentSyncTasks setting and updated task optimization to chunk work by the new concurrency limit.
- Raised the default maxConcurrentWebDAVCalls to 100 and migrated existing configs from 0.

### Sync correctness and compatibility

- Updated delete-confirmation reupload handling to rebuild uploads from the current vault state.
- Added compatibility fixes for obsidian-paste-image-rename by preserving ctime on local file creation during pull and separating file vs folder stats in task interfaces.
- Adjusted conflict resolution logic to handle file-only conflicts more accurately.
- Added remote mkdir handling when reuploading deleted directories.
- Removed unnecessary recursive remote directory creation in mkdir handling.
- Eliminated unnecessary async calls in the two-way decider to improve planning performance.

### Localization, docs, and maintenance

- Added Russian translations for the webdav explorer UI.

## Obsidian WebDAV Sync v2.1.0 - 2026-04-08

### Sync planning and execution

- Reworked two-way sync planning into explicit file/folder/file-folder collections, simplifying the decision flow and removing redundant per-path branching.
- Added cancelable traversal/planning by propagating throwIfCancelled through WebDAV traversal and decider loops.
- Changed task creation and optimization to run grouped mkdir/push/pull/remove/merge work concurrently.
- Renamed conflict handling from conflict-resolve to merge across planning, settings, UI, and migrations, and centralized merge snapshot handling.
- Simplified mkdir handling by removing recursive mkdir task chains and tightening path/subpath validation.
- Optimized delete/reupload syncing by replacing an O(n²) lookup with a Map, and improved task ordering by sorting directories via path segment depth.
- Consolidated traversal, path normalization, and stat conversion helpers into shared utilities, and removed the local-walk planning report.
- Simplify change detection and loose-mode handling

### Settings, localization, and UI

- Expanded i18n language handling with a shared language map, normalized auto-detection, and a fix for zh-Hans detection.
- Made language settings accept arbitrary values and populate the dropdown dynamically.
- Updated sync progress and observability UI to use i18n-driven run kinds, raw paths, and clearer percent/count display.
- Replaced the old sync run-type formatter with direct localization lookups and added/adjusted conflict-related translation keys.
- Replaced settings migration flow with a new processing pipeline and added the prune base text store migration.

### Logging and build output

- Enhanced logger output with plugin version and log-length information.
- Added a shared VERSION constant and wired version injection into the build config.

### Cleanup, performance, and internal API tightening

- Centralized ArrayBuffer-to-text conversion into a shared utility and removed duplicated serializers from task classes.
- Simplified task and engine internals by reducing noisy debug payloads, removing unused types/files, and cleaning imports.
- Corrected a misleading execution error message in AddRecordTask.
- Refined mergeability checks so base text is only computed when needed.

## Obsidian WebDAV Sync v2.0.0 - 2026-04-05

### Huge Internal Refactor

**Many breaking changes are present although auto migration is provided. Strongly recommended to backup before upgrade.**

- Complete rewrite and simplification of storage layer to separated IndexedDB-backed stores for base text and sync records. Drastically reduced storage read / write overhead.
- Added safer key parsing and bulk `getItems/removeItems` helpers in storage to reduce round-trips.
- Traversal refactor: class-based traversal replaced by functional traversal utilities. Greatly improved implementation simplicity.
- Centralized path utilities under `src/platform/path.ts` and simplified path handling across the plugin.
- Parallelized traversal, storage and decision with conceivable 10-20x performance boost.
- Standardized previous IOS-specific strict directory path normalization to all platforms.
- Reworked sync task implementations to the new `record/StatsMap` model.
- Removed useless `noop` and `skip` tasks.
- Refurbished and renamed merge/remove task utilities.
- Added WebDAV runtime-configurable rate-liming settings.
- Organized settings UI.
- Added Russian locale (`src/i18n/ru.ts`) and related wiring.
- Two migration systems (v1.3.0 - v2.0.0) added and executed on plugin load:
  - Settings migration: `src/settings/migration.ts`
  - Storage migration: `src/storage/migration/migrate.ts`
- Numerous bug / glitch fixes.

## Obsidian WebDAV Sync v1.3.0 - 2026-03-26

- Fixed iOS-specific Unicode normalization inconsistency that causes different file with the same name to be created in the WebDAV.
- Introduced 'Keep Local' and 'Keep Remote' conflict resolution strategies by @quantavil.
- Added option `Realtime sync delay` to adjust custom debounce time for realtime sync and changed the default value to 5s.
- Reorganized settings categories.
- Changing the starting syncing phase in status bar from `Loading records` to `Pre-connecting` for accuracy.

## Obsidian WebDAV Sync v1.2.4 - 2026-03-23

- Fixed iOS-specific JSON parsing error originated from different trailing slash handling.
- Fixed deleted files / folders come back due to asymmetric record update.
- Fixed repeating fetch / upload files due to record inconsistency.
- Fixed file not found error due to the race that a file's parent directory is deleted before the file is deleted uring remote deletion propagation.
- Reordered the plugin settings interface.
- Added new option "Clear records" to clear all local / records saved in local indexed database.

## Obsidian WebDAV Sync v1.2.3 - 2026-03-22

- Ignore syncing application time realtime syncing invocation to avoid duplicated syncing caused by syncing itself.
- Fixed repeated vault re-upload due to file path and modification time mismatch.

## Obsidian WebDAV Sync v1.2.2 - 2026-03-22

- Fixed sync progress not showing explicit progress in `Building plan` phase.
- Simplified progress reporting pipeline and reduced unnecessary traversals and updates.

## Obsidian WebDAV Sync v1.2.1 - 2026-03-21

- Fixed 404 error during planning phase when a pull is requested.

## Obsidian WebDAV Sync v1.2.0 - 2026-03-21

- Refactored the syncing process to finish local and remote file capturing at planning time, creating a snapshotted plan that will be used to sync. This avoids the edge case that the file changes between planning and execution.
- Make records be updated immediately after finishing a sync task, which avoids redundant WebDAV requests and similar race condition above.
- Display detailed planing phases in the status bar.
- Fix debug log not being written in exported support log in development mode.
- Added new option "Show sync status in mobile notification" to improve observability on mobile devices.

## Obsidian WebDAV Sync v1.1.2 - 2026-03-19

- Fixed observability chaos that causes the status bar always show "planning" when offline.
- Refactored sync termination logic.

## Obsidian WebDAV Sync v1.1.1 - 2026-03-18

- Fixed #9 that XML decoding race condition could cause file name mismatch and false removal.
- Refactored observability pattern to deliver human-readable markdown support log.
- Enhanced user feedback via more detailed status bar indicators and event notifications.

## Obsidian WebDAV Sync v1.1.0 - 2026-03-17

- Refactored the syncing process to only traverse remote directory once per normal sync.
- Unified traversal cache with local last-sync record to become a single remote record.
- Simplified and modernized remote record local database storage.
- Introduced new fast syncing mode that avoids remote directory traversal entirely for high-frequency realtime syncing.

## Obsidian WebDAV Sync v1.0.0 - 2026-03-16

- Re-engineered the plugin to be a general-purpose WebDAV syncing plugin.
- Allow custom WebDAV endpoints.
- Removed Nutstore-specific features and APIs.
- Reduced size by 50% via eliminating unnecessary dependencies while preserving mobile compatibility.
- Internal: simplified the plugin structure and modernized the build & lint & format toolchain.
- Internal: simplified syncing planning process and reuse traversal cache in stable syncing to improve performance.

## Obsidian Nutstore Sync v1.1.3 - 2026-02-14

- 优化了设置访问的稳定性和错误处理。
- 优化账户同步流程：在同步前增加配置校验，引导用户前往设置页面。
- Improved stability and error handling for settings access.
- Enhanced account sync workflow: Added configuration validation before sync and guided users to settings page.

## Obsidian Nutstore Sync v1.1.2 - 2026-02-11

- 新增对 traverseWebDAV 缓存清理的支持
- Added support for clearing the traverseWebDAV cache

## Obsidian Nutstore Sync v1.1.1 - 2026-02-10

- 修复：增强了 HTML 实体解码支持，提升了对特殊字符的处理能力。
- Fix: Enhanced HTML entity decoding support, improving special character handling.

## Obsidian Nutstore Sync v1.1.0 - 2026-02-05

### 新增功能 / Features

- 新增可恢复的 WebDAV 遍历功能，支持大规模目录树的高效扫描。
- 新增失败任务弹窗，集中展示同步错误信息。
- 新增同步准备事件，提供更细致的同步状态反馈。
- 新增删除确认设置，允许在自动同步时控制是否显示删除确认。
- 新增显示相对时间功能，改善时间显示的可读性。
- 新增更多任务图标，丰富任务类型的视觉反馈。
- 新增文件跳过原因显示（文件大小、被忽略项等），提升同步透明度。
- Added resumable WebDAV traversal for efficient large directory tree scanning.
- Added failed tasks modal to centralize sync error information display.
- Added sync preparing event for more detailed sync status feedback.
- Added delete confirmation setting to control confirmation display during auto-sync.
- Added relative time display for improved time readability.
- Added more task icons to enrich visual feedback for task types.
- Added skip reason display (file size, ignored items, etc.) to improve sync transparency.

### 修复 / Fixes

- 修复同步进度弹窗按钮未定义的问题。
- 修复 FilterEditorModal 描述显示问题。
- 修复文件大小限制判断逻辑。
- 修复 traverseWebDAVKV 异步等待问题。
- 修复 delta 增量获取不完整的问题，确保持续检索直到无更多可用数据。
- 修复节点键值的标准化问题。
- 修复取消检测在确认前的问题。
- 修复可恢复遍历的返回值。
- 修复远程目录创建前的文件名有效性检查。
- Fixed undefined button reference in SyncProgressModal.
- Fixed FilterEditorModal description display issue.
- Fixed file size limit logic.
- Fixed traverseWebDAVKV async await issue.
- Fixed incomplete delta retrieval, ensuring continuous retrieval until no more data is available.
- Fixed node key normalization issue.
- Fixed cancel detection before confirmation.
- Fixed resumable traverse return value.
- Fixed filename validity check before remote directory creation.

### 重构与优化 / Refactoring & Improvements

- 重构并增强 glob 匹配逻辑，改进路径标准化。
- 重构 delta 应用逻辑，新增 applyDeltasToStats 工具函数。
- 移除 delta 缓存键值存储，简化架构。
- 改用 Vault API 进行文件操作，提升稳定性。
- 将语言设置从 Obsidian API 获取改为插件设置中配置。
- Refactored and enhanced glob matching logic with improved path normalization.
- Refactored delta application logic and added applyDeltasToStats utility.
- Removed delta cache key-value storage to simplify architecture.
- Switched to Vault API for file operations to improve stability.
- Changed language setting from Obsidian API to plugin settings configuration.

## Obsidian Nutstore Sync v1.0.0 - 2025-12-29

- 功能: 分块执行同步任务并新增批量远端操作（批量建目录、递归删除）、覆盖推送与跳过冲突，显著提升大批量同步效率。/ Feature: Execute sync jobs in chunks with new batch remote operations (bulk mkdir, recursive delete), overwrite push, and conflict skipping to speed up large syncs.
- 功能: 扩展 glob 规则和路径判定（Mergeable、Markdown、二进制文件），自动排除 configDir，并支持禁用间隔自动同步，增强策略可控性。/ Feature: Extended glob rules and path detection (mergeable, markdown, binary), auto-exclusion of configDir, and ability to disable interval auto sync for finer control.
- 功能: 新增删除确认弹窗、将同步日志保存到 Vault，并在同步结束时显示 Close 状态，整体提升可用性与反馈。/ Feature: Added delete confirmation modal, saving sync logs to the vault, and showing Close instead of Hidden after sync to improve UX and feedback.
- 修复: 保护忽略文件不被远端删除、修复缓存服务、记录跳过、进度上报与任务分块等问题，保证同步稳定性。/ Fix: Safeguarded ignored files from remote deletion and fixed cache service, record skipping, progress reporting, and chunked task handling to keep sync stable.
- 优化: 使用 `fflate` 压缩缓存、以 SWC 支持 ES5、改进 ArrayBuffer 转换与时长 clamping，提供更快更兼容的运行体验。/ Improvement: Switched to `fflate` caching, compile with SWC for ES5 support, and improved ArrayBuffer conversion plus duration clamping for faster, more compatible runtime.

## Obsidian Nutstore Sync v0.8.5 - 2025-12-02

- 功能: 允许跳过初始同步确认。/ Feature: Allow skipping initial sync confirmation.
- 修复: 移除无用的卸载服务进程。/ Fix: Remove useless unload service process.
- 优化: 优化记录更新的防抖性能。/ Refactor: Debounce record updates for performance.

## Obsidian Nutstore Sync v0.8.4 - 2025-12-02

- **改进:** 实现了可配置的自动同步间隔。
- **修复:** 删除了孤立的记录。
- **内部优化:** 重构了同步决策架构，并添加了全面的 glob 匹配测试；对 [SyncRecord](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/model/sync-record.model.ts#L4-L30) 类进行了解耦和重构，提升了代码可维护性；改进了 [StatModel](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/model/stat.model.ts#L1-L19) 的类型安全性和修复了相关的类型问题；使用了 `path-browserify` 提升兼容性。
- **Improvements:** Implemented configurable auto-sync interval.
- **Fixes:** Removed orphaned record.
- **Internal Improvements:** Refactored sync decision architecture and added comprehensive glob matching tests; Decoupled and refactored the [SyncRecord](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/model/sync-record.model.ts#L4-L30) class for improved maintainability; Improved [StatModel](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/model/stat.model.ts#L1-L19) type safety and fixed related type issues; Used `path-browserify` for better compatibility.

## Obsidian Nutstore Sync v0.8.3 - 2025-07-21

- 优化二进制文件检测：通过扩展名检查优化了二进制文件的检测。
- Optimized binary file detection: Improved binary file detection with extension checking.

## Obsidian Nutstore Sync v0.8.2 - 2025-06-26

- **改进:** 提升了文件处理的稳定性，修复了 [PullTask](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/sync/tasks/pull.task.ts#L1-L42) 执行方法中的错误。
- **改进:** 改进了 `deepStringify` 函数的错误处理，使其能够更好地处理 `Error` 对象。
- **Improvements:** Improved file handling stability, fixing errors in the [PullTask](file:///home/hesprs/Documents/Obsidian%20WebDAV%20Sync/src/sync/tasks/pull.task.ts#L1-L42) execution method.
- **Improvements:** Improved error handling in the `deepStringify` function to better manage `Error` objects.

## Obsidian Nutstore Sync v0.8.1 - 2025-06-25

- **改进与修复:**
  - 更新了文件检索方法，提高了效率和稳定性。
  - 优化了文件夹创建逻辑，减少了潜在错误。
  - 增强了语言获取方法的健壮性，避免了潜在的运行时错误。
- **Improvements and Fixes:**
  - Updated file retrieval method for improved efficiency and stability.
  - Improved folder creation logic to reduce potential errors.
  - Enhanced robustness of language retrieval method to prevent potential runtime errors.

## Obsidian Nutstore Sync v0.8.0 - 2025-06-23

- **改进:**
  - 优化同步流程，避免同步进度条被意外清空。
  - 修复开始同步指令逻辑，使其更可靠。
  - 统一英文翻译大小写格式，提升用户体验。
  - 同步数据库时显示进度条，提升用户感知。
- **底层优化:**
  - 使用 Vault API 重构部分代码，提升效率和稳定性。
  - 使用 `Setting` 组件替换 `h2` 元素，统一设置界面样式。
  - 移除未使用的代码，精简代码库。
  - 使用 `window.clearTimeout` 和 `window.setTimeout` 优化计时器管理。
- **Improvements:**
  - Optimized sync process to prevent unexpected clearing of the progress bar.
  - Fixed the logic of the start sync command for better reliability.
  - Unified capitalization in English translations for improved user experience.
  - Added a progress bar during database synchronization for better user feedback.
- **Under the hood:**
  - Refactored parts of the code using the Vault API for improved efficiency and stability.
  - Replaced `h2` elements with the `Setting` component for consistent settings interface styling.
  - Removed unused code to streamline the codebase.
  - Optimized timer management using `window.clearTimeout` and `window.setTimeout`.

## Obsidian Nutstore Sync v0.7.0 - 2025-05-14

- **特性**
  - 增强智能合并策略，提升冲突解决效率。
  - 新增启动后自动同步选项，允许配置同步延迟。
- **修复**
  - 为 `updateMtimeInRecord` 方法增加错误处理，提高稳定性。
  - 兼容 1.8.x 及更早版本。

---

- **Features**
  - Enhanced intelligent merge strategy for more efficient conflict resolution.
  - Added an option for automatic synchronization after startup, with configurable delay.
- **Bug Fixes**
  - Improved stability of the `updateMtimeInRecord` method by adding error handling.
  - Ensured compatibility with versions 1.8.x and earlier.

## Obsidian Nutstore Sync v0.6.1 - 2025-05-13

- 改进 Glob 匹配逻辑和性能 (重构文件系统结构)
- Improve glob matching logic and performance (Refactored filesystem structure)

## Obsidian Nutstore Sync v0.6.0 - 2025-05-09

- **新功能**
  - 解码文件路径中的 HTML Entity 编码
  - 添加文件名错误任务，处理不支持的特殊字符
  - 自动同步时不显示通知
  - 添加过滤规则设置，支持包含和排除规则

- **Features**
  - Decode HTML entities in file paths
  - Add task for filename errors to handle unsupported special characters
  - Suppress notifications during automatic synchronization
  - Add filter rule settings with support for include and exclude rules

## Obsidian Nutstore Sync v0.5.1 - 2025-04-30

- 修复：修复了 NutstorePlugin 类型不存在 'logs' 属性的问题。
- Fixed: Resolved an issue where the 'logs' property was missing from the NutstorePlugin type.

- **功能改进:**
  - 实现了实时同步服务，并添加了相应的设置选项。
  - 添加了 BaseSyncDecision 抽象类以支持同步决策逻辑。
- **错误修复:**
  - 更新了过滤器描述，移除了关于 globstar 的描述。
  - 修复了生成的正则表达式标志，移除了默认的全局标志。
  - 将 configDir 添加到过滤器规则中。
- **Features:**
  - Implemented a real-time synchronization service and added corresponding settings.
  - Added a BaseSyncDecision abstract class to support synchronization decision logic.
- **Bug Fixes:**
  - Updated the filter description, removing the description about globstar.
  - Fixed the generated regular expression flags, removing the default global flag.
  - Added configDir to the filter rules.

## Obsidian Nutstore Sync v0.4.2 - 2025-04-28

- 修复：优化实时保存同步记录功能，避免同步大量文件中断后需要重新读写。
- 修复：处理空目录或根目录情况。
- 修复：改进了 WebDAV 连接检查功能，现在可以处理 503 错误并提供相应的通知。
- Fixed: Optimized real-time saving of sync records to prevent rereading and rewriting after interruptions during large file synchronizations.
- Fixed: Handled cases with empty or root directories.
- Fixed: Improved WebDAV connection check to handle 503 errors and provide corresponding notifications.

## Obsidian Nutstore Sync v0.4.1 - 2025-04-27

- 修复了首次同步时本地数据会覆盖远程数据的问题，现在会进行合并。
- Fixed an issue where local data would overwrite remote data during the initial synchronization. Now, the data will be merged.

## Obsidian Nutstore Sync v0.4.0 - 2025-04-25

- 可以配置跳过大文件，避免 OOM；同步进度窗口可以取消同步和隐藏窗口；可选择性清除缓存。
- 串行保存 blob 数据，日志持久化。
- Configure skip large files to avoid OOM; The sync progress window can cancel sync and hide the window; Selectable cache clearing modal.
- Serialize blob saving; Logs are now persistent.

## Obsidian Nutstore Sync v0.3.2 - 2025-04-23

- 恢复同步记录后显示同步完成提示。
- 完善了同步记录功能，自动补充缺失文件夹的同步记录。
- 新增内存文件系统。
- 新增同步完成标记功能。
- 新增同步进度弹窗。
- 新增同步和终止命令。
- 优化了同步机制，包括可中断的 503 重试机制和睡眠函数，修复了大量任务并发读取文件时闪退的问题。
- Synchronization complete message is now displayed after synchronization records are restored.
- Enhanced synchronization record functionality by automatically adding missing folder records.
- Implemented an in-memory file system (memfs).
- Added a synchronization completion marker.
- Added a synchronization progress popup.
- Added commands for starting and stopping synchronization.
- Improved synchronization mechanism with interruptible 503 retry and sleep functions, fixing the crash issue when concurrently reading files with a large number of tasks.

## Obsidian Nutstore Sync v0.3.1 - 2025-04-21

- 修复：
  - 仅导出当前 vault 的缓存
  - 修复 delta 响应中的类型解析错误
- 功能：
  - 使用标准远程路径处理选择的远程路径，确保路径一致性
  - 添加空操作任务以优化任务执行流程
  - 添加松散同步模式，跳过同名且大小相同的文件
- Bug fixes:
  - Only export the cache of the current vault.
  - Fixed a type parsing error in delta responses.
- Features:
  - Use standardized remote paths to ensure path consistency.
  - Added a no-op task to optimize task execution flow.
  - Added a loose synchronization mode to skip files with the same name and size.

## Obsidian Nutstore Sync v0.3.0 - 2025-04-18

- **功能改进:**
  - 实现了 Indexed DB 缓存数据的导入导出功能，并支持保存到坚果云盘。
  - 使用图标代替了选择文件夹的文本。
  - 添加了日志界面。
- **问题修复:**
  - 修复了 stringify 导致的错误。
- **其他改进:**
  - 为生产模式添加了日志记录功能。
  - 将设置模块重构为类。
- **Features:**
  - Implemented import and export of Indexed DB cache data, with support for saving to Nutstore Cloud.
  - Replaced folder selection text with an icon.
  - Added a log interface.
- **Bug Fixes:**
  - Fixed an error caused by stringify.
- **Other Improvements:**
  - Added logging functionality for production mode.
  - Refactored the settings module as a class.

## Obsidian Nutstore Sync v0.2.3 - 2025-04-14

- 修复相对路径处理逻辑
- 为过滤器添加 flag

- fix relative path bug
- allow config flag for filter

## Obsidian Nutstore Sync v0.2.2 - 2025-04-10

- 修复了部分旧环境下的兼容性问题 (通过 polyfill 数组方法)。
- 修复了导致移动端无法同步的问题。

- Fixed compatibility issues in some older environments (by polyfilling array methods).
- Fixed an issue preventing synchronization on mobile devices.

## Obsidian Nutstore Sync v0.2.1 - 2025-04-10

- 修正了相对路径的处理。

- Corrected handling of relative paths.

## Obsidian Nutstore Sync v0.2.0 - 2025-04-09

- 简化了登录流程。
- 增加了自定义过滤功能。
- 支持自定义请求 URL。
- 增加了当同步任务过多时建议使用客户端的提示信息。
- 修复了 iOS 设备上无法通过浏览器进行 SSO 登录的问题。
- 修复了数值可能以科学记数法 (eNotation) 显示的问题。
- 更新了冲突解决策略的描述，增加了备份建议。
- 调整了差异匹配阈值。
- 对路径进行了编码以改善处理。

- Simplified the login process.
- Added custom filtering capabilities.
- Added support for custom request URLs.
- Added a prompt suggesting client use for numerous sync tasks.
- Fixed an issue preventing SSO login via browser on iOS devices.
- Fixed an issue where numbers might display in scientific notation (eNotation).
- Updated conflict resolution strategy descriptions to include a backup recommendation.
- Adjusted the match threshold for diffs.
- Encoded paths for improved handling.

## Obsidian Nutstore Sync v0.1.0 - 2025-04-03

- 为冲突解决策略描述添加了备份建议。
- 改进了手动登录帮助链接的结构。
- 禁用了数字显示的科学计数法 (eNotation)。
- 更新了单点登录 (SSO) 组件 (使用 `@nutstore/sso-js`)。

- Added backup recommendation to conflict resolution strategy descriptions.
- Improved the structure of the manual login help link.
- Disabled scientific notation (eNotation) for number display.
- Updated the Single Sign-On (SSO) component (using `@nutstore/sso-js`).

## Obsidian Nutstore Sync v0.0.7 - 2025-03-28

- 新增：执行同步任务前增加确认步骤，通过包含说明文字的新弹窗进行确认。
- 新增：添加 `confirmBeforeSync` 设置项，用于控制是否在同步前进行确认。
- 改进：文件列表（FileList）现在可以同时显示文件和文件夹。
- 改进：为远程目录创建过程中遇到的错误添加了通知提示。
- 优化：优化了同步流程（包括远程目录存在性检查和记录清理）。

- Added a confirmation step before executing sync tasks, shown in a new modal with instructions.
- Added a `confirmBeforeSync` setting to control the sync confirmation behavior.
- Updated FileList to display both files and folders.
- Added notifications for errors during remote directory creation.
- Optimized the synchronization process (includes remote directory checks and record cleanup).

## Obsidian Nutstore Sync v0.0.6 - 2025-03-25

- 提高了获取目录内容时的可靠性，增加了 API 速率限制和针对临时服务器错误 (503) 的自动重试机制。
- Improved reliability when fetching directory contents by adding API rate limiting and automatic retries for temporary server errors (503).

## Obsidian Nutstore Sync v0.0.5 - 2025-03-21

- 修复：创建新文件夹后自动刷新列表。
- 功能：更新了坚果云单点登录（SSO）支持。

- Fix: Refresh list automatically after creating a new folder.
- Feature: Updated Nutstore Single Sign-On (SSO) support.

## Obsidian Nutstore Sync v0.0.4 - 2025-03-13

- 更新了单点登录 (SSO) 功能。
- Updated Single Sign-On (SSO) functionality.

## Obsidian Nutstore Sync v0.0.3 - 2025-03-13

- **同步核心与进度**
  - 新增 同步状态管理、进度百分比显示、完成状态（含失败计数）和同步按钮视觉反馈。
  - 新增 同步取消/停止功能。
  - 新增 SSO（单点登录）用户界面。
  - 新增 同步确认对话框及风险提示。
  - 新增 在本地创建文件夹时，在远端也创建对应文件夹。
  - 新增 同步任务失败时的本地化错误信息。
  - 新增 对二进制文件进行哈希比较。
  - 新增 针对 503 错误的重试机制。
  - 优化 远程基础目录 (`remoteBaseDir`) 回退使用仓库名称。
  - 优化 调整了 API 请求频率限制以提高稳定性。
  - 修复 同步动画旋转方向错误。
  - 修复 从正确的 `remoteBaseDir` 开始遍历文件。
  - 修复 获取目录内容以正确处理服务器基础路径。
- **冲突处理**
  - 新增 冲突处理策略可选。
  - 新增 冲突标记（支持 Git 风格及自定义），并保留原始内容格式。
  - 新增 跳过空文件冲突。
  - 优化 冲突解决支持可选的本地和远程文件状态信息。
- **文件处理**
  - 新增 文件属性中包含文件大小。
  - 新增 获取目录内容支持分页。
  - 修复 处理文件系统中的空文件状态。
- **其他**
  - 新增 插件图标。
  - 新增 中英文文档及同步流程图。
  - 修复 文本自动换行问题。
  - 更新 插件名称。

- **Sync Core & Progress**
  - Added sync state management, progress percentage display, completion status (with failed count), and visual feedback for the sync button.
  - Added sync cancellation/stop functionality.
  - Added SSO (Single Sign-On) user interface.
  - Added sync confirmation dialog and risk warning.
  - Added remote folder creation when a local folder is created.
  - Added localized error messages for sync task failures.
  - Added hash comparison for binary files.
  - Added retry mechanism for 503 errors.
  - Improved `remoteBaseDir` to use the vault name as a fallback.
  - Adjusted API rate limiting parameters for better stability.
  - Fixed sync animation rotation direction.
  - Fixed walking from the correct `remoteBaseDir`.
  - Fixed `getDirectoryContents` to handle server base paths correctly.
- **Conflict Handling**
  - Added selectable conflict resolution strategies.
  - Added conflict markers (supporting Git style and customization), preserving original content formatting.
  - Added skipping of blank file conflicts.
  - Improved conflict resolution to support optional local and remote file stats.
- **File Handling**
  - Added file size to file properties.
  - Added pagination support for getting directory contents.
  - Fixed handling of empty file stats in the file system.
- **Other**
  - Added plugin icons.
  - Added English and Chinese documentation, including a sync flowchart.
  - Fixed automatic word wrapping issues.
  - Updated plugin name.

## Obsidian Nutstore Sync v0.0.2 - 2025-03-07

- **WebDAV:**
  - 新增 WebDAV 文件浏览器功能。
  - 为 WebDAV 配置添加远程基础目录选择器。
  - 支持通过环境变量配置 WebDAV。
  - 提升 WebDAV 可靠性与性能（改进令牌处理、避免重复创建目录、修复 `nextLink` 解码问题）。
- **用户界面与体验:**
  - 移除同步模态框（SyncModal）组件。
  - 改进移动端适配。
  - 更新坚果云（Nutstore）设置界面。
  - 统一界面文本的大小写。
- **其他:**
  - 为中文用户添加了帮助说明。
  - 修复了访问 `configDir` 中配置值的问题。

- **WebDAV:**
  - Added a WebDAV file explorer feature.
  - Added a remote base directory selector for WebDAV configuration.
  - Enabled WebDAV configuration via environment variables.
  - Enhanced WebDAV reliability and performance (improved token handling, avoided duplicate mkdir, fixed `nextLink` decoding).
- **User Interface & Experience:**
  - Removed the SyncModal component.
  - Improved mobile adaptability.
  - Updated the Nutstore Setting Tab UI.
  - Standardized capitalization in UI text.
- **Other:**
  - Added Chinese help documentation (`help` for zh).
  - Fixed accessing configured value from `configDir`.

## Obsidian Nutstore Sync v0.0.1 - 2025-02-26

- 新增 WebDAV 及本地文件同步功能，包括文件和文件夹的遍历、创建、删除（支持递归删除）以及基础的冲突解决机制。
- 改进同步冲突处理：增加解决策略，支持跳过空文件冲突，并在解决后更新记录。
- 增强同步用户体验：
  - 增加同步状态管理、进度百分比显示、加载动画（修复了旋转方向）及完成后的失败任务计数。
  - 增加同步过程中的通知提示和本地化错误信息。
  - 添加取消/停止同步按钮。
  - 优化了同步状态的 UI 显示并添加了图标。
- 引入国际化 (i18n) 支持和语言切换功能。
- 添加 SSO (单点登录) 相关界面（后已隐藏）。
- 优化同步设置：远程目录将回退使用仓库名称。
- 修复了同步中处理服务器基本路径、空文件统计信息等问题。

- Added basic file synchronization for WebDAV and local vaults, including traversal, creation, deletion (with recursive support), and basic conflict resolution.
- Improved sync conflict handling: added resolution strategies, support for skipping blank file conflicts, and record updates after resolution.
- Enhanced sync user experience:
  - Added sync state management, progress percentage display, loading animation (fixed rotation direction), and failed task count on completion.
  - Added notifications during sync and localized error messages.
  - Added a cancel/stop sync button.
  - Improved the sync status UI and added icons.
- Introduced internationalization (i18n) support and language switching functionality.
- Added SSO (Single Sign-On) related UI (later hidden).
- Improved sync setup: Remote base directory now falls back to using the vault name.
- Fixed issues related to handling server base paths, empty file stats, etc., during synchronization.
