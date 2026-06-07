# src/composable/

## Responsibility

Reusable low-level primitives for sync, settings, and WebDAV code.
This folder covers encryption/key derivation, glob matching, XML parsing,
unit conversion, translation lookup, and shared request throttling.

## Design

- Mostly stateless helpers or small factories with isolated mutable state.
- `api-limiter.ts` exports one shared limiter instance; settings mutate its runtime limits.
- `i18n.ts` stores the active language in a closure and serves template-based lookups.
- `encryption.ts` is the main stateful module: it derives keys, encrypts file content in fixed-size AES-GCM chunks, and encrypts basenames with AES-GCM-SIV.
- `RangedFileDecrypter` buffers partial ciphertext and advances chunk-by-chunk for streamed reads.
- `glob-match.ts` normalizes paths before testing compiled glob expressions against files or ancestors.
- `unit-converter.ts` is a generic parse/format factory for size and time inputs.

## Flow

1. Settings and UI collect user inputs and update shared composable state where needed.
2. Sync services call encryption helpers to transform paths, filenames, and file payloads before WebDAV I/O.
3. WebDAV responses are parsed from XML into plain objects, then traversed into stats and vault paths.
4. Filter/settings utilities turn glob rules and numeric strings into runtime values.
5. Translation lookup resolves the current language once and is consumed by settings screens and other UI text.

## Integration

- `src/utils/encryption.ts` owns sync-level key caching and wraps the encryption helpers for remote path/content handling.
- `src/fs/webdav/api.ts` uses `parse-xml.ts` to convert PROPFIND responses into `DAVResult` objects.
- `src/fs/webdav/traverse.ts`, `src/services/webdav.service.ts`, and `src/settings/controls.ts` share the singleton API limiter.
- `src/i18n/index.ts` wraps `createI18n()` and exposes the app translation function.
- `src/utils/input-converters.ts` wraps `createUnitConverter()` for file-size and time settings.
- `src/utils/glob-match.ts` wraps `GlobMatch` for inclusion/exclusion rule evaluation.
