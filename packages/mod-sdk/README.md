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

Optional fields the build copies through: `languages` (`{ base, available, text? }`), `altArt`, `permission`
(`{ by, evidence?, date?, scope? }`), `templateCredit` and `translators` (`{ es: "Name" }`).

### Pictures, languages and alternate art

A card's picture is `cards/<lang>/<card code>.webp`, in the source folder and in the built pack alike (the card records
are the `*.json` files directly in `cards/`; its sub-folders are pictures). Both faces of a double-sided card have
one (`x.p.01a.webp`, `x.p.01b.webp`). `languages.base` is the fallback: a client shows the player's language where the
pack has that picture and the base language's where it does not (`resolvePackCardImage` in `@mc/content`). Alternate
art is `alt-art/<lang>/<card code>.webp`, listed in `altArt: { <lang>: { <card code>: <path> } }`. The code is a
base-game card (`"01088"`) or one of the pack's own faces, and any pack kind may carry it (an `art` pack is only alt
art). `validatePack` checks the tags, that `base` is available, that every picture is of a pack card, and that
alternate art names a known card and a listed file.

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

- `validatePack(input, options?)`: returns `{ path, message, category? }[]`, empty when valid. A card that names an
  ability nobody has written yet is reported with `category: "unscripted-ability"`; `splitIssues(issues)` separates
  those from real defects, so a converted pack shows "valid, N abilities to script". `input` is `{ manifest, files, cards,
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

## Importing a MarvelCDB-shaped pack

`importMarvelCdbPack(srcDir, { packId, outDir })` (`src/import-marvelcdb.ts`, Node-only, needs a runtime that imports
`.ts`) converts a community folder (`mod.json`, `<id>.json` in MarvelCDB public-API shape, `images/<lang>/`,
`alt-art/<lang>/`) into the source layout above:

- the cards go through the content package's own normalizer (`packages/content/scripts/marvelcdb`, what
  `pnpm --filter @mc/content ingest` runs) with a bare curation, so a converted card has an ingested card's shape;
- codes are renumbered `x.<packId>.<NN>[a|b]` in order (a double-sided card keeps its number), and every reference
  is rewritten: ability ids, obligation, aspect, nemesis and modular set ids (`<packId>-nemesis`), deck lists;
- MarvelCDB art paths are dropped, pictures are mapped to `cards/<lang>/<code>.webp`, alt art to `alt-art/`;
- `pack.json`, `CREDITS.md` and `PERMISSION.md` come from `mod.json`; the author's `x_*` fields are kept in
  `extensions.json`; `abilities/index.ts` is a stub listing every ability id that needs a script with its printed
  text (an existing one is never overwritten);
- curation: pass `curation: { corrections: [...], cardNotes: {...}, ... }` (the ingest's `PackCuration` fields, cards
  named by source or final code). The importer adds one correction itself: a permanent upgrade or support with no cost is
  a printed dash cost (`specialCost: "dash"`), and a same-type linked card gets `hidden: true` as the API sends it, so
  a flip upgrade such as Night Thrasher's Battle Board converts. Both are listed in the report;
- the result is validated in memory. `report.validationIssues` are real defects; `report.unscriptedIssues` are the
  abilities still to script. Without `outDir` it is a dry run.

`MC_IMPORT_REAL_DIR=<folder of pack folders> [MC_IMPORT_REAL_OUT=<out>] pnpm --filter @mc/mod-sdk exec vitest run
import-marvelcdb` prints a report per folder (the real packs are not checked in).

## Known limits

- `SUPPORTED_DSL_FEATURES` is what the base game's own scripts use (the engine's types are erased at runtime), not
  every kind the types allow.
