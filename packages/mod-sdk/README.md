# @mc/mod-sdk

The mod SDK for custom content packs (docs/custom-content-packs.md §5, §6, §11.2): the pack source layout, the DSL
feature list, `validatePack` and `buildPack`.

## What a pack's source repo looks like

```
pack.json              the author-written part of the manifest
cards/                 one card record per file, named after the card code (x.<pack-id>.<nn>[a].json)
abilities/index.ts     default export: the pack's abilities, built with the DSL
decks/                 optional: one StarterDeck record per file
scenarios/             optional: one scenario record per file
art/                   images (copied to the pack as art/...)
CREDITS.md             who made the pack and its art (required)
PERMISSION.md          the creator's permission for the store to distribute it (required)
```

`packages/mod-sdk/src/fixtures/tiny-pack/` is a complete minimal example.

### `pack.json` (author part)

```json
{
  "id": "fan-moon-knight",
  "version": "1.0.0",
  "kind": "hero",
  "name": "Moon Knight",
  "authors": ["..."],
  "description": "A fan-made hero pack.",
  "license": "Fan-made, non-commercial; see CREDITS.md",
  "requires": { "app": ">=0.40.0", "packs": [] },
  "pictures": { "hero": { "x.fan-moon-knight.01a": "art/hero.webp" } }
}
```

`pictures` is optional. The build fills in `schema`, `requires.dslFeatures`, `contents`, `files` (path, size, sha256 of
every shipped file) and `totalBytes`.

### Cards and ability ids

- Every card code is `x.<pack-id>.<number>` with an optional face letter (`x.fan-moon-knight.01a`).
- A card names its abilities as `<card code>.<slug>` (`x.fan-moon-knight.02.moonlight-action`), the same convention as
  the base game with the card code swapped. The base game's `defineAbilities` only accepts 5-digit codes, so a pack
  uses `definePackAbilities`, which runs the same `validateDefinition` checks:

```ts
import { definePackAbilities, heroAction, thwartAScheme } from "@mc/mod-sdk";

export default definePackAbilities({
  "x.fan-moon-knight.02.moonlight-action": heroAction({ label: "thwart" }, thwartAScheme(2)),
});
```

A card may also name a base-game ability id.

## API

Browser-safe (`@mc/mod-sdk`):

- `validatePack(input, options?)`: returns `{ path, message }[]`, empty when valid. `input` is `{ manifest, files, cards,
  abilities, decks?, scenarios? }` (`PackInput`), so it runs without a disk. `readPackInput(manifest, files)` builds one
  from an unzipped pack.
- `dslFeatures(registry)`, `SUPPORTED_DSL_FEATURES`: see the key naming in `src/features.ts`.
- `definePackAbilities`, `sha256Hex`, and everything `@mc/cards` exports (the DSL builders).

Node-only (`@mc/mod-sdk/build`, `src/build.ts`):

- `buildPack(srcDir, outDir)`: loads the source, validates it, writes `data/*.json`, the art, `pack.json` and the
  deterministic `<id>-<version>.zip` (sorted entries, fixed timestamp), and returns the manifest and the zip's sha256.
- `loadPackSource`, `assemblePack`, `zipPack` for the steps on their own.

`abilities/index.ts` is TypeScript, so `buildPack` must run where `.ts` can be imported (Vitest today; a `tsx`
wrapper for the `mc-pack` CLI comes later).

## Known limits

- `allowUnlabeledAttack` marks an ability with a non-enumerable symbol that JSON drops. `buildPack` validates the
  in-memory abilities, so such an ability builds; `validatePack` on the built JSON would report it.
- `SUPPORTED_DSL_FEATURES` is what the base game's own scripts use (the engine's types are erased at runtime), not
  every kind the types allow.
