# src/components/explorer/i18n/locales

## Responsibility

Store static explorer UI message catalogs keyed by stable translation IDs.

- `en.ts`: English strings.
- `zh.ts`: Simplified Chinese strings.

## Design Patterns

- **Flat key-value dictionaries**: each locale exports a plain object with identical keys.
- **Module-per-locale**: locale files are independent modules and selected by `../index.ts`.
- **Explorer-scope isolation**: keys only cover explorer UI actions/labels.

## Data & Control Flow

1. `../index.ts` imports both locale modules.
2. Active locale selection (`zh` or fallback `en`) determines which dictionary is flattened.
3. Explorer components access localized values through `t(key)`.

## Integration Points

- Producers: `en.ts`, `zh.ts` default exports.
- Consumer: `src/components/explorer/i18n/index.ts` resource loader.
- Effective call sites: explorer `App.tsx` and `components/NewFolder.tsx`.
