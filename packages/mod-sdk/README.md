# @mc/mod-sdk

The mod SDK for custom content packs (docs/custom-content-packs.md §5, §6, §11.2): the pack source layout, the DSL
feature list, `validatePack` and `buildPack`.

## What a pack's source repo looks like

```
pack.json              the author-written part of the manifest
cards/                 one card record per file, named after the card code (x.<pack-id>.<nn>[a].json)
abilities/index.ts     default export: the pack's abilities, built with the DSL
decks/                 optional: one StarterDeck record per file
scenarios/             optional: one Scenario record per file (id `<pack-id>-<name>`)
encounter-sets/        optional: one EncounterSet record per file (id `<pack-id>-<name>`): a nemesis set, a modular set, a scenario's own set
campaigns/             optional: one campaign record per file, carried through untouched
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
  abilities, decks?, scenarios?, encounterSets?, campaigns? }` (`PackInput`), so it runs without a disk. `readPackInput(manifest, files)` builds one
  from an unzipped pack.
- Games with a pack's scenarios and modular sets (`src/game.ts`; the client's seams):
  `scenarioWithPacks(scenarioId, options, packs)` is the `GameSetupConfig` for a base scenario or any scenario of the
  packs, with the packs' cards in the pool and their modular sets allowed in `options.modularSetIds` (mixed with base
  ones; a pack set counts toward the scenario's modular count). Run it on `gameDepsWithPacks(PLAYABLE_DEPS, packs)`.
  `packScenarioRecords(packs)` lists the pack scenarios, `packEncounterSetRecords(packs)` the sets (display names), and
  `packModularSetChoices(scenario, packs)` the pack sets that may be a modular pick at a given scenario. They build on
  the cards package's `playableScenarioWithCustom` / `customModularSetChoices` / `customScenarioProblems`
  (`packages/cards/src/playable/custom.ts`). A pack scenario uses the plain `Scenario` fields only
  (`CUSTOM_SCENARIO_FIELDS`); other fields, and a pack set at a Civil War or pool scenario, are refused with a sentence.
- `dslFeatures(registry)`, `SUPPORTED_DSL_FEATURES`: see the key naming in `src/features.ts`.
- `definePackAbilities`, `sha256Hex`, and everything `@mc/cards` exports (the DSL builders).

Node-only (`@mc/mod-sdk/build`, `src/build.ts`):

- `buildPack(srcDir, outDir)`: loads the source, validates it, writes `data/*.json`, the art, `pack.json` and the
  deterministic `<id>-<version>.zip` (sorted entries, fixed timestamp), and returns the manifest and the zip's sha256.
- `loadPackSource`, `assemblePack`, `zipPack` for the steps on their own.

`abilities/index.ts` is TypeScript. `buildPack` / `loadPackSource` import it with a plain `import()` by default
(Vitest can); pass `importModule: packModuleImporter()` (`src/loader.ts`, jiti) to load it anywhere, as the CLI does.

Node-only, for tests (`src/smoke.ts`; `<sdk>/testing` in the published package):

- `smokeTestPack(pack, { games, scenario, maxCommands })`: what `mc-pack test` runs (below).

## `mc-pack`

`src/cli.ts` (`runCli`), run by `src/bin.ts`. In this repo: `pnpm --filter @mc/mod-sdk mc-pack <command> ...`
(paths relative to `packages/mod-sdk`; slow to start, since jiti transforms the workspace sources). The published
package's `npx mc-pack` starts in under a second.

```
mc-pack validate <dir> [--allow-unscripted]
mc-pack build <dir> --out <dir>
mc-pack test <dir> [--games <n>] [--scenario rhino|klaw|ultron] [--max-commands <n>]
mc-pack import-marvelcdb <src> [--out <dir>] [--id <pack-id>] [--app <range>]
```

- Exit codes: 0 success, 1 the pack has a problem (invalid, fails to load, a smoke game failed), 2 a usage error.
- `validate` lists real problems first and the `unscripted-ability` issues as their own group; `--allow-unscripted`
  passes a pack whose only issues are those. `build` and `test` never allow them.
- `test` plays `--games` (default 3) games, standard mode, with the cards package's greedy driver (the one the sample
  packs' tests use), of: each deck in `decks/` against a Core scenario (default Rhino, with its recommended modular set);
  each of the pack's scenarios with a base precon (Core Spider-Man) and the scenario's recommended modular set; each of
  the pack's modular sets, picked with a base precon at the Core scenario. A game fails on an
  engine error, an illegal driver command, no outcome inside `--max-commands` (default 4000: stuck), a prompt left
  open, or a log that does not replay to the same state. A pack with no deck, scenario or modular set plays a base
  precon with its cards in the pool, and says so.
- The pack's `abilities/index.ts` is loaded with jiti, whose `virtualModules` give its `import ... from "@mc/mod-sdk"`
  (or the published package name) the SDK that is already running. jiti over tsx: an in-process API with no loader
  hooks and no native binary, and the virtual module keeps one SDK in memory whatever name the pack imports.

## The published package

`pnpm --filter @mc/mod-sdk build:dist` (`scripts/build-npm.mjs`) writes `dist-npm/package/` and `npm pack`s it into
`dist-npm/<name>-<version>.tgz` (both git-ignored):

- `dist/`: an esbuild ESM bundle (index, build, import, testing and the `mc-pack` bin, sharing chunks) carrying the
  engine, cards and content code, so it depends on none of the private `@mc/*` packages. Its one dependency is jiti.
  The `import` and `mc-pack` entries register the content package's MarvelCDB normalizer up front
  (`npm/register-normalizer.ts`), since a bundle has no `packages/content/scripts` to import at run time.
- `types/`: tsc's declarations (`tsconfig.npm.json` maps `@mc/*` to the workspace sources so they are emitted too),
  with every `@mc/*` specifier rewritten to a relative path.
- `package.json`: the name is `--name`, `MC_SDK_PACKAGE_NAME` or `@champions-digital-game/mod-sdk`; the version is
  `--version`, `MC_SDK_VERSION` or the app's (the root `package.json`, which the release PR bumps).
  AGPL-3.0-or-later, `bin: { "mc-pack": ... }`, and the README in `npm/README.md`.

`pnpm --filter @mc/mod-sdk smoke:dist [--build]` (`scripts/smoke-npm.mjs`) installs the tarball into a temp pack repo
made from `content-packs/sample-hero` (importing the SDK by its published name), runs what the registry's CI runs
(`npm ci --ignore-scripts`, `mc-pack validate`, `test`, `build`), a strict `tsc --noEmit` over the pack's abilities
and an import of each entry point. It needs the npm registry for jiti.

`.github/workflows/mod-sdk.yml` builds and smoke-tests the tarball for each release, attaches it, and publishes it to
npm when the `NPM_TOKEN` secret exists (`npm publish --provenance --access public`). `release-on-merge.yml` calls it,
since a release that workflow publishes starts no other workflow; a manual run is a dry run by default.

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
- A pack scenario is built by the generic path: no several villains, set-aside cards, villain choice, modular set pool,
  difficulty-set alternatives or extra modular sets. A pack encounter set may not be an extra, auto-included, campaign,
  competitive, sided or separate-deck set. Scenario packs sample: `content-packs/sample-scenario`.
