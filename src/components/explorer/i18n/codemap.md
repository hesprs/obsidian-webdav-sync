# src/components/explorer/i18n

## Responsibility

Provide explorer-scoped localization runtime:

- map browser language to supported explorer locales,
- hold reactive active locale signal,
- load/flatten locale dictionaries,
- export `t()` translator consumed by explorer UI components.

## Design Patterns

- **Locale normalization gate**: `toLocale(language)` collapses all non-`zh` language codes to `en`.
- **Reactive i18n state**: `locale` is a Solid signal (`createSignal`) and can be updated by host code when needed.
- **Resource-backed dictionary loading**: `createResource(locale, ...)` re-computes flattened dictionary on locale changes.
- **Translator facade export**: `t` is exported once and used across explorer module for key lookup.

## Data & Control Flow

1. Initial locale is derived from `navigator.language` through `toLocale()`.
2. `createResource` selects dictionary module (`locales/zh` or `locales/en`).
3. Selected nested dictionary is flattened via `@solid-primitives/i18n.flatten`.
4. `translator(dict)` resolves keys for UI call sites (`t('confirm')`, etc.).
5. When `setLocale()` updates locale, resource and translator output reactively update.

## Integration Points

- Depends on `@solid-primitives/i18n` for flattening/translation helpers.
- Depends on Solid reactivity (`createSignal`, `createResource`).
- Imports dictionaries from `./locales/en` and `./locales/zh`.
- Consumed by `App.tsx` and `components/NewFolder.tsx` in explorer UI.
