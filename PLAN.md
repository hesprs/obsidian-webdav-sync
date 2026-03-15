# Mobile support plan

## Recommendation

Use a **browser-first refactor**, not a broad Node polyfill.

The plugin is already close to mobile-safe because WebDAV transport is patched through `requestUrl` in `src/webdav-patch.ts`. The real blockers are Node assumptions leaking into runtime code:

- `node:path` imports across sync, utils, settings, and UI
- `Buffer`-specific conversion in `src/sync/tasks/pull.task.ts`
- build config externalizing Node builtins in `tsdown.config.ts`

The clean path is to introduce small internal runtime-safe adapters for **paths** and **binary data**, then harden the build so Node runtime APIs cannot leak back in.

---

## Current blockers

### 1. `node:path` is used in runtime code

Important files:

- `src/api.ts`
- `src/utils/glob-match.ts`
- `src/utils/traverse-webdav.ts`
- `src/sync/index.ts`
- `src/sync/tasks/task.interface.ts`
- `src/sync/tasks/pull.task.ts`
- `src/services/cache.service.v1.ts`
- `src/settings/cache.ts`
- `src/explorer/App.tsx`
- plus several utility files under `src/utils` and `src/fs/utils`

This is the main mobile blocker because `tsdown.config.ts` currently leaves Node builtins unresolved in the final bundle.

### 2. Binary handling still assumes Node `Buffer`

Known direct issue:

- `src/sync/tasks/pull.task.ts`

Related edge files:

- `src/sync/tasks/conflict-resolve.task.ts`
- `src/services/cache.service.v1.ts`
- `src/sync/core/merge-utils.ts`

### 3. Build config hides the problem

`tsdown.config.ts` includes `...builtinModules` in `neverBundle`, which is fine for tooling but not for mobile plugin runtime code.

---

## Architectural direction

### A. Split path handling into two explicit domains

Introduce internal helpers with clear semantics:

1. **Remote path helpers**
   - absolute WebDAV paths
   - slash-separated
   - no Node path semantics

2. **Vault path helpers**
   - Obsidian-relative paths
   - slash-separated
   - aligned with `normalizePath`

Do **not** use a generic `path-browserify` style drop-in as the main fix.

Why:

- it keeps Node semantics in places that should be domain-specific
- it hides remote-path vs vault-path mistakes
- it increases bundle complexity without improving architecture

Use a tiny internal path layer instead.

### B. Normalize binary data at the I/O edge

All WebDAV binary reads should be converted immediately into a runtime-safe representation (`ArrayBuffer` or `Uint8Array`) before sync logic uses them.

Core sync and merge code should not depend on `Buffer` or `BufferLike`.

### C. Keep platform awareness only at true platform boundaries

Keep existing platform-specific behavior where it belongs:

- `src/webdav-patch.ts` for request transport quirks
- `Platform.isDesktopApp` UX branches in `src/sync/index.ts`

Remove platform dependence from path and binary handling.

---

## Refactor phases

### Phase 0 — Guardrails

Goal: stop the spread before refactoring.

- treat `node:*` imports inside `src/` as violations
- document path invariants:
  - remote paths start with `/`
  - remote dir canonical form is explicit
  - vault paths are normalized slash paths without leading `/`
- add a repo rule that build/runtime code must not rely on Node builtins

### Phase 1 — Introduce remote path helpers

Create a small helper module for remote paths and migrate these first:

- `src/utils/std-remote-path.ts`
- `src/utils/remote-path-to-absolute.ts`
- `src/utils/remote-path-to-local-path.ts`
- `src/utils/traverse-webdav.ts`
- `src/api.ts`
- `src/settings/cache.ts`
- `src/services/cache.service.v1.ts`
- `src/sync/tasks/task.interface.ts`
- `src/utils/stat-webdav-item.ts`
- `src/fs/utils/normalize-remote-walk-path.ts`

Reason: remote path correctness is central to traversal, WebDAV reads, cache export, and task execution.

Key changes:

- replace `join`, `normalize`, `basename`, `isAbsolute` with explicit remote helpers
- make task remote path resolution explicit in `src/sync/tasks/task.interface.ts`
- make traversal child resolution explicit in `src/utils/traverse-webdav.ts`
- make cache file path construction remote-safe in settings/service code

### Phase 2 — Introduce vault path helpers

Migrate vault-facing logic next:

- `src/utils/mkdirs-vault.ts`
- `src/sync/index.ts`
- `src/sync/tasks/pull.task.ts`
- `src/utils/stat-vault-item.ts`
- `src/fs/utils/complete-loss-dir.ts`
- `src/utils/glob-match.ts`
- `src/explorer/App.tsx`

Key changes:

- use slash-only path helpers plus `normalizePath` where appropriate
- replace parent-directory calculations with explicit vault path operations
- make explorer folder creation use the same path rules as sync code

### Phase 3 — Add a binary adapter boundary

Create one shared binary conversion utility and route all WebDAV binary reads through it.

Migrate:

- `src/sync/tasks/pull.task.ts`
- `src/sync/tasks/conflict-resolve.task.ts`
- `src/services/cache.service.v1.ts`
- `src/sync/core/merge-utils.ts`

Key changes:

- remove direct `Buffer` assumptions
- prefer `ArrayBuffer` / `Uint8Array`
- keep conversion logic out of task/merge code

### Phase 4 — Make sync core runtime-neutral

Tighten contracts in:

- `src/sync/tasks/task.interface.ts`
- `src/sync/index.ts`
- `src/sync/core/merge-utils.ts`

Goal:

- path inputs are already normalized by domain
- binary inputs are already normalized
- sync logic no longer knows or cares about Node runtime types

### Phase 5 — Harden the build

Update `tsdown.config.ts` so Node builtins are not silently shipped as externals for plugin runtime code.

Target state:

- `obsidian` remains external
- true runtime externals stay external only when necessary
- accidental `node:*` imports fail visibly during build

This phase should happen after runtime imports are removed, otherwise it will surface too many issues at once.

---

## Suggested helper surface

Keep it small.

### Remote path helper module

Responsibilities:

- `normalizeRemotePath`
- `joinRemotePath`
- `dirnameRemotePath`
- `basenameRemotePath`
- `isAbsoluteRemotePath`
- `stripRemoteBaseDir`

### Vault path helper module

Responsibilities:

- `normalizeVaultPath`
- `joinVaultPath`
- `dirnameVaultPath`
- `isRootVaultPath`

### Binary helper module

Responsibilities:

- convert WebDAV binary payloads to `ArrayBuffer`
- expose `Uint8Array` views when needed
- isolate runtime-specific shape handling in one place

---

## Why this is cleaner than a polyfill-first fix

### Polyfill-first

Pros:

- fastest short-term unblocking

Cons:

- keeps Node-centric architecture
- does not solve `Buffer` leakage cleanly
- makes remote/vault path confusion easier to preserve
- adds bundle/runtime complexity

### Refactor-first

Pros:

- cleaner architecture
- smaller and more explicit runtime surface
- less risk of desktop/mobile divergence
- easier long-term maintenance

Cons:

- touches more files up front

Given this codebase, refactor-first is the better long-term choice.

---

## Main risks

### 1. Path semantics regressions

Highest-risk areas:

- `src/sync/tasks/task.interface.ts`
- `src/utils/traverse-webdav.ts`
- `src/utils/mkdirs-vault.ts`
- `src/sync/index.ts`
- `src/utils/glob-match.ts`

Failure modes:

- bad root handling (`/`, `.`, empty string)
- wrong parent directory calculation
- bad remote base dir stripping
- duplicate or missing slashes

### 2. Remote/vault domain confusion

The current code mixes path meanings. The refactor should make those domains explicit instead of preserving implicit conversions.

### 3. Binary runtime inconsistency

WebDAV binary payload shapes may differ across patched environments. That is exactly why the conversion boundary should be centralized.

---

## Verification checklist

### Static checks

- no `node:` imports remain in `src/`
- no core sync module exposes `Buffer`
- remote path and vault path helpers are separate
- `tsdown.config.ts` no longer externalizes Node builtins for runtime code

### Functional checks

- sync plan generation works
- fresh and cached WebDAV traversal both work
- remote root recreation still clears records and traversal cache correctly
- binary pull works
- conflict resolution still works for timestamp and text merge strategies
- cache save/restore/delete still works
- explorer folder creation still works
- include/exclude glob matching still behaves the same

### Runtime checks

- desktop build still works
- mobile plugin loads without unresolved builtin-module errors
- WebDAV calls still flow through `src/webdav-patch.ts`
- iOS PROPFIND retry behavior remains intact

---

## Recommended execution order

1. add guardrails
2. refactor remote paths
3. refactor vault paths
4. centralize binary conversion
5. harden sync/task contracts
6. tighten build config
7. run desktop + mobile validation

## Bottom line

The elegant solution is **not** “polyfill Node on mobile.”

It is to finish the architectural move the codebase has already started: keep transport patched at the platform edge, and make the sync core fully browser-safe through explicit **remote-path**, **vault-path**, and **binary** adapters.
