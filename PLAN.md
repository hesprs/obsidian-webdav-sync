# Re-engineering Plan: Nutstore fork → General-purpose Obsidian WebDAV Sync

## 0) Objective

Transform this fork into a **pure general-purpose WebDAV sync plugin**.

Target:
- Any RFC4918-compatible WebDAV server (Nextcloud, ownCloud, Synology, Box WebDAV, etc.)

Non-goals:
- Keep Nutstore-specific compatibility
- Keep Nutstore-specific optimizations (delta API, SSO, protocol callback)

---

## 1) Current state (as-is codebase understanding)

### 1.1 Core architecture already reusable
- Plugin composition root: `src/index.ts`
- Sync orchestration: `src/services/sync-executor.service.ts` + `src/sync/index.ts`
- Decision engine and tasks: `src/sync/decision/*`, `src/sync/tasks/*`
- FS abstraction exists: `src/fs/fs.interface.ts`, `src/fs/local-vault.ts`, `src/fs/nutstore.ts`
- Remote path chooser UI already generic by contract: `packages/webdav-explorer/src/*`

### 1.2 Nutstore lock-in points to remove
- Branding + identity:
  - `manifest.json` (`id/name/description`)
  - `package.json` (`name`)
  - `README.md`
  - CSS classes in `src/assets/styles/global.css` (`nutstore-sync-*`)
- Endpoint constants and hardcoded host behavior:
  - `src/consts.ts` (`NS_DAV_ENDPOINT`, `NS_NSDAV_ENDPOINT`)
  - `esbuild.config.ts` injects those env vars
- Nutstore-only auth and protocol:
  - `src/settings/account.ts` (`@nutstore/sso-js`, Jianguoyun help URL)
  - `src/index.ts` protocol handler `nutstore-sync/sso`
  - `src/utils/decrypt-ticket-response.ts`
- Nutstore-only traversal optimization:
  - `src/utils/traverse-webdav.ts` uses `getDelta/getLatestDeltaCursor`
  - `src/api/delta.ts`, `src/api/latestDeltaCursor.ts`, `src/utils/ns-api.ts`
- Nutstore assumptions in directory listing mapping:
  - `src/api/webdav.ts` hardcodes `/dav` in `convertToFileStat`
- Naming lock-in across internals:
  - `NutstorePlugin`, `NutstoreSync`, `NutstoreFileSystem`, `NutstoreSettings`
- Storage naming lock-in:
  - `src/storage/kv.ts` DB name `Nutstore_Plugin_Cache`

---

## 2) Product direction

Core plugin mode:
1. User enters WebDAV server URL
2. User enters credentials (initially Basic auth)
3. User tests connection
4. User chooses remote root directory
5. Existing sync engine runs normally

Policy:
- Prioritize clean architecture over backward compatibility.
- Breaking changes from the Nutstore fork baseline are acceptable.

---

## 3) What to add / remove / refactor

### 3.1 Add

#### A) Generic WebDAV settings UX
- Server URL input
- Username/password input
- Connection test with clear errors
- Optional advanced section (timeout/retry)

#### B) Generic remote traversal strategy
- Keep one default strategy: recursive PROPFIND traversal + local cache acceleration.
- No provider-specific delta/SSO capability flags.

### 3.2 Remove

Remove Nutstore-specific code and dependencies directly:
- `@nutstore/sso-js` dependency and all SSO flow
- protocol callback `nutstore-sync/sso`
- `decrypt-ticket-response` utility
- delta APIs and Nutstore HTTP wrappers (`delta`, `latestDeltaCursor`, `ns-api`)
- compile-time Nutstore endpoint constants and injected envs
- Nutstore-only UI copy/help links
- hardcoded `/dav` path normalization

### 3.3 Refactor

#### Naming refactor (internal)
- `NutstorePlugin` → `WebDAVSyncPlugin` (or final project name)
- `NutstoreSync` → `SyncEngine`
- `NutstoreFileSystem` → `RemoteWebDAVFileSystem`
- `NutstoreSettings` → `PluginSettings`

#### Services and flow refactor
- `src/services/webdav.service.ts`
  - Build client from user-provided server URL + credentials
- `src/sync/index.ts`
  - Keep constructor generic; remove any Nutstore-only assumptions
- `src/sync/utils/update-records.ts`
  - Depend on generic remote fs abstraction only
- `src/components/SelectRemoteBaseDirModal.ts`
  - Use generic WebDAV listing path only

#### API module refactor
- Keep `src/api/webdav.ts` protocol-generic
- Remove Nutstore adapter/API modules entirely

---

## 4) Execution roadmap (phased)

### Phase 1 — Remove hard lock-ins
1. Delete Nutstore SSO/protocol flows and dependencies.
2. Delete delta-related APIs/utilities.
3. Remove compile-time Nutstore endpoint constants.
4. Remove `/dav` hardcode.

Deliverable: codebase no longer depends on Nutstore-specific APIs.

### Phase 2 — Generic settings and client wiring
1. Redesign settings schema for direct WebDAV URL + credentials.
2. Refactor `WebDAVService` to use runtime settings only.
3. Update settings UI copy and validation for generic WebDAV.

Deliverable: manual setup works with arbitrary WebDAV endpoints.

### Phase 3 — Naming and structural cleanup
1. Rename core classes/types to provider-neutral names.
2. Rename storage keys/DB names and related labels.
3. Remove leftover Nutstore identifiers in code/comments/CSS/i18n.

Deliverable: internal semantics are fully generic.

### Phase 4 — Branding and release hardening
1. Update `manifest.json`, `package.json`, README, and user-facing copy.
2. Final dead-code sweep and dependency cleanup.
3. Validate end-to-end sync flows against at least two non-Nutstore servers.

Deliverable: publishable, general-purpose WebDAV sync plugin.

---

## 5) Detailed file-by-file plan

### Core
- `src/index.ts`
  - Remove Nutstore protocol handler and related branches
  - Load generic settings only

- `src/services/webdav.service.ts`
  - Use dynamic server URL and credentials from settings

- `src/services/sync-executor.service.ts`
  - Construct sync using generic remote fs + traversal only

- `src/sync/index.ts`
  - Eliminate Nutstore-specific naming and assumptions

- `src/sync/utils/update-records.ts`
  - Keep only generic remote fs dependency

### Settings/UI
- `src/settings/index.ts`
  - Define simplified generic settings model

- `src/settings/account.ts`
  - Replace SSO/loginMode flows with explicit WebDAV credential fields

- `src/settings/common.ts`
  - Remove Jianguoyun/Nutstore-specific help and text

- `src/settings/log.ts`
  - Rename note path/title from `nutstore-*` to generic naming

### API/Traversal
- `src/api/webdav.ts`
  - Remove `/dav` assumption
  - Keep parser/listing logic provider-neutral

- `src/utils/traverse-webdav.ts`
  - Remove delta branch; keep generic recursive traversal

- Delete:
  - `src/api/delta.ts`
  - `src/api/latestDeltaCursor.ts`
  - `src/utils/ns-api.ts`
  - `src/utils/decrypt-ticket-response.ts`

### Metadata and docs
- `manifest.json`, `package.json`, `README.md`, i18n files, CSS classes
  - Rename and rewrite to provider-neutral branding

---

## 6) Risks and mitigations

1. **Performance regression without delta API**
   - Mitigation: optimize generic traversal (batching, cache intervals, reduced redundant PROPFIND depth usage).

2. **Auth UX complexity across providers**
   - Mitigation: start with Basic auth + app-password guidance; add modes incrementally.

3. **Path normalization bugs across servers**
   - Mitigation: centralize canonicalization and add tests for `/`, trailing slash, encoded segments, Unicode paths.

4. **Intentional breaking changes for existing Nutstore users**
   - Mitigation: clearly document in release notes; no compatibility shim planned.

---

## 7) Verification plan

Per phase:
1. `pnpm check`
2. `pnpm test`
3. Manual smoke tests:
   - connect to generic WebDAV server
   - browse/select remote dir (explorer)
   - first sync, incremental sync, delete flow, conflict flow
   - cache export/import
4. Cross-server validation:
   - test against at least two distinct WebDAV implementations

---

## 8) Definition of done

The re-engineering is complete when:
- Plugin is configurable and usable with non-Nutstore WebDAV servers out of the box.
- Nutstore-specific code paths, dependencies, and protocol flows are removed.
- Core modules, naming, docs, and metadata are provider-neutral.
- Full sync lifecycle passes checks/tests/manual smoke validation on multiple WebDAV servers.

### Re-Engineering Success Criteria

1. **Remote-local deletion/create/save correctness**
   - Remote delete → local file removed and not resurrected on next sync.
   - Local delete → remote file removed and not resurrected on next sync.
   - Remote create/update → local reflects latest state.
   - Local create/update/save → remote reflects latest state.
   - Verify with repeated sync cycles to ensure idempotency (no flip-flop state).

2. **No stale overwrite regressions**
   - Modified local files must not be reverted by stale remote metadata.
   - Modified remote files must not be overwritten by stale local metadata.
   - Record-update logic (`src/sync/utils/update-records.ts`) must preserve latest authoritative version per decision path.

3. **Conflict handling and merge behavior**
   - Simultaneous local+remote edits trigger conflict path deterministically.
   - Conflict outputs are preserved (no silent loss).
   - Merge result is stable on subsequent sync runs.

4. **Real-time and manual sync parity**
   - Real-time watcher-triggered sync and manual sync produce equivalent final state.
   - Burst save events are debounced/coalesced safely; no missed or duplicated operations.
   - Background/foreground transitions do not corrupt sync sequence.

5. **Regression matrix execution**
   - Run all above scenarios on at least two WebDAV servers.
   - Run each scenario under:
     - clean first sync
     - incremental sync
     - offline/reconnect retry
     - large directory subtree
