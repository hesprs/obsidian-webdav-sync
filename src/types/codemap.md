# src/types

## Responsibility

Provide ambient TypeScript declarations that bridge runtime globals and undocumented Obsidian APIs used by the plugin.

## Design Patterns

- Module augmentation (`declare module 'obsidian'`) for internal API surface extension.
- Global declaration files (`declare const ...`) for build-time/runtime-injected flags.
- Declaration-only boundary: no runtime code, compiler contract only.

## Data & Control Flow

No runtime execution. Type declarations are loaded by TypeScript during compilation and shape editor diagnostics + type checking across plugin code.

## Integration Points

- Obsidian API augmentation consumed by UI/services that call internal settings APIs (`app.setting?.openTabById`).

## Key Files

- `obsidian-extended.d.ts`: augments `App` with optional internal `setting` API contract.
