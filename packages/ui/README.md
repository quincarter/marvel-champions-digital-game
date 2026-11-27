# @mc/ui

The Lit components the client draws its panel screens with, over the Phaser table. Each component is presentational:
the client passes in every value (already translated) and listens for its events. `@mc/ui` imports none of the other
packages.

## Conventions

- **Types live in their own files, not in the component.** Keep interfaces and type aliases in a `<name>.types.ts`
  file beside the component (`components/mc-game-log/mc-game-log.types.ts`) and import them where they are needed.
- **Shared types go to `src/shared/*.types.ts`**, one file per concern (`sheet.types.ts`, `glyph.types.ts`,
  `button.types.ts`, `tap.types.ts`). Anything used by more than one component, or by the client independent of a
  component (the sheet node shapes `SheetBuilder` builds, glyph specs and grounds, button kinds, tap options), is
  exported from there rather than coupled to a component module.
- `src/index.ts` exports types with `export type { ... } from "./.../*.types.js"`, never through a component module.
  A component's registering file (`mc-thing.ts`) only defines the element and re-exports the class.

## One component per concept, composed from small parts

The list-and-panel kit (`mc-picture-tile`, `mc-picture-card`, `mc-media-row`, `mc-list-row`, `mc-section-header`,
`mc-empty-state`, `mc-search-field`, `mc-tab-rail`, `mc-filter-chip`, `mc-filter-bar`, `mc-article`) has exactly one
component per concept. Before adding a new one, check it is not a variant of one of these: extend its API instead, and
compose bigger pieces from the small ones (`mc-picture-card` and `mc-media-row` are built from `mc-picture-tile`).
Each has a sheet node of the same name (`pictureTile`, `sectionHeader`, `filterBar`, ...) and a `SheetBuilder` method.
`MIGRATION.md` maps the names parallel branches used onto this kit.
