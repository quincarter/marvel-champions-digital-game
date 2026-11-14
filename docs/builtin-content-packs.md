# Built-in content as mod SDK packs

The base game's own products are defined the way a Mod Store pack is (`docs/custom-content-packs.md` §11.2), one
product at a time. This doc is the pattern a future agent follows to move a product, what has moved, what is left,
and the gaps the move has found. The summary in the store design is `docs/custom-content-packs.md` §11.13; the
tracking issues are #686 (Core and wave 1, PR #687) and #690 (waves 2 and 3).

**Why:** the SDK is proven on content we already trust, built-in content and store packs get one shape and one set
of checks, and each product's folder becomes a worked example creators can copy. It follows the retrofit plan Quin
approved (2026-11-10): built-in packs stay **precompiled modules**, never JSON loaded at runtime, so startup doesn't
change.

## 1. The pattern

### 1.1 What a built-in pack is

`BuiltinPack` (`packages/cards/src/builtin-packs/define.ts`) has the fields of the SDK's `PackInput`, minus the files
a store pack carries:

| Field           | What it holds                                                                              |
| --------------- | ------------------------------------------------------------------------------------------ |
| `manifest`      | `id` (the product's set code, `core`, `cap`, `gmw`), `kind`, `name`, `product` record      |
| `cards`         | the product's `@mc/content` cards (`<P>_CARDS`), the same array, not a copy                |
| `encounterSets` | `<P>_ENCOUNTER_SETS`                                                                       |
| `scenarios`     | `<P>_SCENARIOS`                                                                            |
| `decks`         | `<P>_STARTER_DECKS`                                                                        |
| `abilities`     | every script the product's cards need: its own scripts plus its share of the reprint layer |

`kind` is `core` for the Core Set and otherwise a store pack kind: `hero`, `scenario`, `modular`, or `campaign` for a
box with a campaign (`trors`, `gmw`).

Card codes, ability ids and deck ids keep their MarvelCDB form (`01001a`, `01001a.spider-sense`). Built-in packs are
never `x.` packs, so saves, decks, replays and registry fingerprints are untouched.

### 1.2 One `pack.ts` per product

Each product defines itself in its own `pack.ts`, beside its ability modules (`kit.ts`, `nemesis.ts`, …), and that
file is the product's one entry point:

```ts
// packages/cards/src/wave2/ant/pack.ts
export const ANT_BUILTIN_PACK: BuiltinPack = defineBuiltinPack({
  manifest: { id: "ant", kind: "hero", name: ANT_PACK.name, product: ANT_PACK },
  cards: ANT_CARDS,
  encounterSets: ANT_ENCOUNTER_SETS,
  scenarios: ANT_SCENARIOS,
  decks: ANT_STARTER_DECKS,
  abilities: mergeRegistries(
    abilitiesForCards(WAVE2_REPRINT_ABILITIES, ANT_CARDS),
    ANT_MAN_KIT,
    ANT_MAN_OBLIGATION_NEMESIS,
    ANT_PACK_CARDS,
  ),
});
```

`abilities` lists the product's ability modules directly. The product's old `index.ts`, which only merged those
modules into a `<P>_ABILITIES` registry, is gone (folded into `pack.ts`), and so is that export: code that wants a
product's scripts reads `<P>_BUILTIN_PACK.abilities` (the reprint aliases included), or `ownScriptsOf(pack, aliases)`
for its own scripts alone (a coverage test that checks each script is named in the product's tests). The Core Set's
`core/pack.ts` holds the merge list that used to sit in `core/index.ts`, and `CORE_ABILITIES` is
`CORE_BUILTIN_PACK.abilities`. Status notes about a product's scripting sit in its `pack.ts` doc comment.

`defineBuiltinPack` refuses, in dev and tests (it skips the walk in a production build, like `defineAbilities`):

- a manifest id that isn't the product's code;
- a card, precon, scenario or encounter set from another product;
- a script for a card the product doesn't have. A script belongs to the product when one of its cards names it, or,
  for a script no card record names (one a rule grants with `gainsAbility`, like `gmw`'s
  `16093.balanced-evasion-guard`), when its `<card code>.<slug>` id names one of the product's cards, either face.

### 1.3 The wave's registry comes from its packs, in the old order

A wave lists its packs in the order their scripts merged before, and builds its registry from them:

```ts
export const WAVE2_BUILTIN_PACKS: readonly BuiltinPack[] = [TRORS_BUILTIN_PACK, TOAFK_BUILTIN_PACK /* … */];

export const WAVE2_ABILITIES: AbilityRegistry = mergeRegistries(
  CORE_ABILITIES,
  WAVE2_REPRINT_ABILITIES,
  ...WAVE2_BUILTIN_PACKS.map((pack) => ownScriptsOf(pack, WAVE2_REPRINT_ABILITIES)),
);
```

A wave's reprint aliases (a card that reprints an earlier one by name and type, aliased to the earlier script) are built
once, by `reprintAliases` (`builtin-packs/reprints.ts`): each wave's `reprints.ts` only names its later cards, its
earlier cards and their scripts, and keeps its own pair shape and pinned problems. They are a wave-level layer: they
still merge as one layer ahead of the packs, so **the registry's key order is unchanged**. The engine iterates
registries in places (`select.ts`), so order is behaviour. Each alias also sits in the pack holding its card
(`abilitiesForCards`), so the packs together hold every script, and `ownScriptsOf` takes the aliases back out when the
wave merges.

`BUILTIN_PACKS` (`builtin-packs/index.ts`) lists every moved product: Core, then each wave's packs.

### 1.4 The SDK checks every built-in pack

`validateBuiltinPack` (`packages/mod-sdk/src/builtin.ts`) runs the checks `validatePack` runs on a store pack, minus
the ones about `x.` codes, ids and files, plus the cross references:

- each card's content-schema check, each script's DSL check, and DSL features against the build's;
- every ability a card names is scripted, resolved against the pack and the built-in packs it `requires` only (CI
  passes the Core Set plus the products the pack really depends on, `PRODUCT_REQUIRES` in `builtin.test.ts`), so a
  script dropped from a pack, or a reference to a product the pack doesn't declare, is reported;
- a scenario's sets (`validateScenarioEncounterSets`), villain and main scheme (id and type), each card's encounter
  sets, an identity's obligation and nemesis set (the hero's own: Ironheart's three identity cards, one name and
  one obligation, share one), a precon's identity and cards;
- a clash with a required pack is reported, never thrown.

`builtinGameDeps(packs)` gives the engine's deps from built-in packs alone.

### 1.5 The tests that prove nothing changed

- **Before you edit, fingerprint the registries.** Write a scratch test (outside `src/` when you're done) that hashes
  each `WAVE<N>_ABILITIES` and `PLAYABLE_DEPS.abilities` twice: sha256 of the sorted entries as JSON, and sha256 of the
  key order. Run it before and after; every line must match. Delete it before committing. Put the table in the PR.
- `packages/cards/src/builtin-packs/builtin-packs.test.ts`: every pack holds together; the packs cover the playable
  cards, scenarios and encounter sets of their products (`PLAYABLE_CARDS`, `PLAYABLE_SCENARIO_RECORDS`,
  `PLAYABLE_ENCOUNTER_SETS` and wave 11's content records, an independent source) and every precon, each once;
  together they hold every script of `WAVE11_ABILITIES` as the same definitions; scripts no card names are pinned;
  per wave, each reprint alias lands in exactly one pack and the registry's key order is the order the wave merges
  its layers (the earlier wave, the aliases, then each pack's own scripts, plus wave 5's and 9's Quick Quip shapes).
- `packages/mod-sdk/src/builtin.test.ts`: every pack passes `validateBuiltinPack` against Core and its declared
  dependencies with no defects and its pinned unscripted list (`KNOWN_UNSCRIPTED`); `builtinGameDeps(BUILTIN_PACKS)`
  holds `WAVE11_ABILITIES`; and one game per wave, played on `builtinGameDeps(BUILTIN_PACKS)`, matches the same game on
  that wave's deps or the playable pool's (outcome, rounds and the whole log).

## 2. Moving a wave: the steps

1. Branch from the latest built-in packs branch (stack the PR on it until it merges), and fingerprint the registries.
2. For each product folder of the wave, write `<product>/pack.ts` as in §1.2: the `@mc/content` exports, the ability
   modules its `index.ts` merged (in the same order), and `abilitiesForCards(<WAVE>_REPRINT_ABILITIES, <P>_CARDS)` if
   the wave has a reprint layer. Move the `index.ts` doc comment's status notes into `pack.ts`, delete `index.ts`, and
   point its importers at `pack.ts` (`<P>_ABILITIES` becomes `<P>_BUILTIN_PACK.abilities`, or `ownScriptsOf` where a
   test wants the product's own scripts). Pick `kind` from §1.1.
3. If the wave has a reprint layer, make its `reprints.ts` call `reprintAliases` instead of its own copy of the
   builder, keeping its exports and the exact problem strings its `reprints.test.ts` pins.
4. In the wave's `index.ts`, add `WAVE<N>_BUILTIN_PACKS` in the existing merge order and build the registry from it
   (§1.3). Export it from `packages/cards/src/index.ts` and add it to `BUILTIN_PACKS`.
5. Extend the tests: the product list, the waves table in `builtin-packs.test.ts`, the newest-wave registry, the
   precon list, and one game of the wave in `builtin.test.ts`.
6. Re-run the fingerprint (must match), the wave's own tests, `builtin-packs/` and `mod-sdk/src/builtin.test.ts`,
   then typecheck, lint and format. Update §3 below and `docs/custom-content-packs.md` §11.13.

## 3. Status

Every product has moved: the Core Set and waves 1 to 11 are built-in packs (#687, #690), 64 packs in all
(`BUILTIN_PACKS`).

| Wave | Products                                                                    | Notes                                    |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------- |
| Core | `core`                                                                      | the merge list lives in `core/pack.ts`   |
| 1    | `cap`, `thor`, `msm`, `hlk`, `bkw`, `drs`, `gob`, `twc`                     | reprint layer                            |
| 2    | `trors`, `toafk`, `ant`, `wsp`, `qsv`, `scw`                                | reprint layer                            |
| 3    | `gmw`, `gam`, `stld`, `drax`, `vnm`, `ron`                                  | reprint layer                            |
| 4    | `nebu`, `warm`, `vision`, `mts`, `valk`, `hood`                             | reprint layer, with its own extra rule   |
| 5    | `sm`, `nova`, `ironheart`, `spiderham`, `spdr`                              | merges Silk's Quick Quip after its packs |
| 6    | `mut_gen`, `cyclops`, `phoenix`, `wolv`, `storm`, `gambit`, `rogue`, `mojo` |                                          |
| 7    | `next_evol`, `psylocke`, `angel`, `x23`, `deadpool`                         |                                          |
| 8    | `aoa`, `iceman`, `jubilee`, `ncrawler`, `magneto`                           |                                          |
| 9    | `aos`, `bp`, `silk`, `falcon`, `winter`, `tt`                               | the silk pack holds Quick Quip           |
| 10   | `cw`, `synthezoid`, `wonder_man`, `hercules`                                | packs built from the module list         |
| 11   | `shadowland`, `jj`, `luke_cage`, `fne`                                      | packs built from the module list         |

A pack's `manifest.id` is the set code its cards carry (`card.setCode`); every product folder under
`packages/cards/src/wave<N>/` is named by it (`mut_gen`, `next_evol`, `wonder_man`), and `@mc/content` has a folder of
the same name. The `fixtures/` folders in waves 7 to 10 are test data, not products. Kinds: `campaign` for a box with a
campaign (`trors`, `gmw`, `mts`, `sm`, `mut_gen`, `mojo`, `next_evol`, `aoa`, `aos`, `shadowland`, `fne`), `scenario`
for scenario packs and boxes without one (`gob`, `twc`, `toafk`, `hood`, `tt`, `cw`, `synthezoid`), `modular` for `ron`,
`hero` for the rest.

### 3.1 Wave-specific shapes

- **Wave 4's reprint rule.** Wave 4's alias layer (`wave4/reprints.ts`) calls `reprintAliases` and then drops the
  aliases of any pair whose card a wave 4 product scripts itself (Nebula's Gamora ally isn't Core's), as its old
  builder did. That needs the products' own modules, so it imports them directly, never a `pack.ts` (every wave 4
  `pack.ts` imports the alias layer).
- **Silk's Quick Quip** (`silk` 52034, `wave5/silk/quick-quip.ts`) was scripted ahead of the Silk pack and merges at
  the end of `WAVE5_ABILITIES`, in no wave 5 pack. The wave 9 silk pack holds it too, so the pack holds every script of
  its cards; `WAVE9_ABILITIES` merges the silk layer as `ownScriptsOf(SILK_BUILTIN_PACK, SILK_QUICK_QUIP)` so the id
  isn't merged twice, and the key order is unchanged.
- **Waves 10 and 11** merge per-card-group modules (`WAVE10_MODULES`, `WAVE11_MODULES`). A module belongs to the product
  its group starts with (`cw/…`, `fne/…`), which is also its cards' set code; `wave10ModulesOf(product)` /
  `wave11ModulesOf(product)` pick a product's modules in list order, and each `pack.ts` merges them. Each product's
  modules sit together in the list, so building the registry from the packs keeps its order. The module lists stay:
  coverage tests read their `skipped` maps. `wave10/builtin-packs.test.ts` and `wave11/builtin-packs.test.ts` pin that
  the packs reproduce the module merge exactly.
- **Separated identities** (SP//dr, 31001a): the identity's support and upgrade sides carry refs that `abilityRefIds`
  leaves out, and the alter-ego card (31002b) has no record of its own. `builtinPackProblems` reads both sides
  (`scriptRefsOf`) and counts `separatedIdentity.alterEgoCardNumber` as one of the pack's card numbers.

## 4. Gaps found

These are what the SDK can't express yet. Each is the same list that limits community content, so closing one helps
both.

1. **Campaigns aren't in the packs.** The campaign boxes are `kind: "campaign"`, but their campaign definitions are
   still in `packages/cards/src/campaigns/`, with code beyond plain data (GMW Balanced's rules, composed sets, expert
   helpers). `PackInput` has a `campaigns` field; a built-in pack can carry its box's `CampaignDefinition` once the
   parts that are code become named, registered pieces, like setup recipes (gap 2).
2. **Scenario setup is still code.** Built-in scenarios are set up by the wave builders (`wave1Scenario` …
   `wave11Scenario`, `playableScenario`, the Civil War leaders, Fear No Evil's villain options). `scenarioWithPacks` is
   for installed packs only: it treats its packs as custom content and refuses base-game ids. The retrofit plan's
   answer is named setup recipes the engine registers and pack data names; until then a built-in pack can't be started
   through the SDK's scenario path.
3. **The client's pool isn't built from the packs yet.** `POOL_CARDS` and `POOL_DEPS` (`packages/client/src/content/
   pool.ts`) still come from the wave exports. Now that every product has moved, assemble them from `BUILTIN_PACKS` with
   the merge helpers installed packs use (plan phase 3), behind the fingerprint check, and check first-load time on the
   iPhone SE and the Pixel. `builtinGameDeps(BUILTIN_PACKS)` already holds the same entries as `WAVE11_ABILITIES` (the
   playable registry), and one game per wave on it matches the same game on the wave's own deps, but not in the same
   key order: each reprint alias sits in its pack instead of one layer per wave. The engine iterates registries
   (`select.ts`), so building `POOL_DEPS` from the packs changes the key-order fingerprint and needs its own check.
4. **No `content-packs/builtin/` folders.** The plan's open decision is whether to generate built-in pack folders in
   the store layout (`pack.json`, `cards/*.json`, …) from today's sources, or keep defining them in place. This work
   keeps them in place; generating them is a later step if Quin picks it.
5. **Unscripted abilities.** Only Synthezoid Smackdown's eight competitive leader-card refs are unscripted (competitive
   mode isn't shipped), pinned in `mod-sdk/src/builtin.test.ts`'s `KNOWN_UNSCRIPTED`. A new gap goes there, not a pack
   left out.
6. **Scripts no card names.** A script a rule or another card grants (GMW Balanced's Nebula's Ship guard, AoS's and
   Falcon's granted abilities, Fear No Evil's granted Boost and When Defeated) passes `defineBuiltinPack` by its
   `<card code>.<slug>` id, so `builtin-packs.test.ts` pins the full list; a new one is added there on purpose, which
   also catches a script left behind by a renamed ref.
7. **Cross-product dependencies are declared.** Every product depends on Core; the only other dependency is AoS's
   Thunderbolts scenario, which draws its modular sets from the Black Panther, Silk, Falcon and Winter Soldier packs.
   `PRODUCT_REQUIRES` (`mod-sdk/src/builtin.test.ts`) lists it, a test drops each declared dependency and expects a
   defect (so the list stays minimal), and a pack naming a product it doesn't declare fails. A card id shared across
   products would be reported; none is. A store pack's `requires.packs` is the same idea; a built-in pack's
   dependencies could move into its manifest the same way.
