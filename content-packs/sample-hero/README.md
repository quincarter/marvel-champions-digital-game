# Sample Sentinel (sample-hero)

A small, original test hero for pack creators to copy. It shows each kind of player card done once, using only
primitives the game already has, so it needs no app update to run. It is not a Marvel character.

Read it next to `docs/custom-content-packs.md` (§6 scripting, §11.2 the SDK, §11.3 the template) and
`packages/mod-sdk/README.md`.

## What is in it

| Card code           | Card                       | Kind                         | Script modeled on       |
| ------------------- | -------------------------- | ---------------------------- | ----------------------- |
| `x.sample-hero.01a` | Sample Sentinel / Sam Pell | hero identity (both faces)   | Spider-Man 01001a/b     |
| `x.sample-hero.02`  | Rook                       | signature ally               | Black Cat 01002         |
| `x.sample-hero.03`  | Sentinel Slam (x3)         | signature event              | Swinging Web Kick 01005 |
| `x.sample-hero.04`  | Workshop                   | signature support            | Aunt May 01006          |
| `x.sample-hero.05`  | Sentinel Cell (x2)         | signature upgrade (Uses)     | Web-Shooter 01008       |
| `x.sample-hero.06`  | Overdue Notice             | obligation                   | Eviction Notice 01165   |
| `x.sample-hero.07`  | Rust Warden                | nemesis minion (Quickstrike) | Vulture 01167           |
| `x.sample-hero.08`  | Held for Ransom            | nemesis side scheme          | Highway Robbery 01166   |
| `x.sample-hero.09`  | Shock Wave (x2)            | nemesis treachery            | Sweeping Swoop 01168    |

`decks/sample-hero-justice.json` is a 40-card precon: the signature cards plus Core Set Justice and basic cards (Spider-Man's starter list, with extra copies up to each card's deck limit) from
the Core Set. A deck may name base-game card codes.

## Achievements

`pack.json` carries four example `achievements` (docs/custom-content-packs.md section 11.12): data-only conditions on this
hero, worth no points, shown in the Trophy Room under the pack. Copy the shape; `mc-pack validate` checks the ids.

## Layout

```
pack.json              the author-written manifest (the build fills in files, sizes, hashes and dslFeatures)
cards/                 one JSON record per card, named after its code
abilities/index.ts     default export: the pack's abilities, built with the SDK's DSL
decks/                 the precon
art/hero.svg           placeholder art, named in pack.json's `pictures`
CREDITS.md, PERMISSION.md
```

## How the hero is wired

- The identity record is one card with a `hero` and an `alterEgo` face. Each face lists its ability by id. Ability ids
  are `<card code>.<slug>`; the alter-ego face's uses `01b` (`x.sample-hero.01b.quiet-study`), as the base game does.
- `obligationCardId` is the obligation's card code. `nemesisEncounterSetId` is `sample-hero-nemesis`, and the three
  nemesis cards (07, 08, 09) carry `"encounterSetIds": ["sample-hero-nemesis"]`. At setup the engine shuffles the
  obligation into the encounter deck and sets the nemesis cards aside, matching them by that id. The id only has to be
  unique, so prefix it with your pack id.
- Signature cards use `"aspect": "hero:x.sample-hero.01a"`.
- A treachery that names a card (Shock Wave names Rust Warden) writes the exact printed name in the script.

## Building and testing

`packages/mod-sdk/src/sample-pack.test.ts` builds this pack with `buildPack`, validates the built output, and plays the
precon headless against the Core Rhino scenario. Run it with `pnpm --filter @mc/mod-sdk test`.

## Known gaps

- A pack cannot declare an encounter set's display name; the client may show `sample-hero-nemesis` as the set's id until
  packs can ship encounter set records.
- `abilities/index.ts` imports `@mc/mod-sdk`, which this repo's test config aliases to the SDK's source.
