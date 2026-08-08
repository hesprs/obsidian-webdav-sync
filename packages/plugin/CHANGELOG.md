# Changelog

All notable changes to this project will be documented in this file.

## Sync Engine v3.0.2 - 2026-08-07

- Animate status bar icon when a sync is running.
- Fixed plugin review false positives caused by incomplete type info and wrong dist folder.

## Sync Engine v3.0.1 - 2026-08-07

- Fixed plugin review failure cause by outdated lock file.

## Sync Engine v3.0.0 - 2026-08-07

### Complete Rewrite from Ground Up

- Completely rewritten the plugin with new modular architecture and extend support to all kinds of backends.
- Renamed to **Sync Engine**.
- The plugin now transitions from a plugin to a platform: it allows module extension without modifying the plugin source, and provides comprehensive documentation and API on developing a module.
- Sync Engine also extends beyond WebDAV with the **S3-compatible backend support**, more backends like Google Drive and Dropbox will become as easy as writing a module.
- Plugin performance is greatly improved, enhancements include faster startup, and [Anchored Asymmetric Storage](https://sync.consensia.cc/deep-dive/asymmetric-storage) that accelerates every sync, [benchmarks show that Sync Engine is around 100x faster than Remotely Save in daily sync scenario](https://sync.consensia.cc/usage/benchmark#webdav-performance).
- Countless of stability improvements and bug fixes.

## Obsidian WebDAV Sync v2.5.13 - 2026-07-29

- Fixed the bug that causes encrypted fast sync to fail and create duplicated files.
- Fixed the bug that records are not cleared for files that are deleted at both local and remote side.
- Adjusted migration script to match new v3 module contract.

## Obsidian WebDAV Sync v2.5.12 - 2026-07-10

- Added support for custom headers by @brycepollack.
- Fixed the bug that causes independently and separately created same-name files on two devices fail to sync by @hesprs.
- Prepare for v3 update by @hesprs.

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

- Implemented client-side encryption. The encryption mechanism is faster, smaller, and more secure than similar solutions (like Remotely Save).
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
