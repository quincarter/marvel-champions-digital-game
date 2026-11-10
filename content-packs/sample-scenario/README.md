# The Clockmaker (sample-scenario)

A small, original scenario pack for pack creators to copy. It shows a custom scenario and a custom modular encounter
set, using only primitives the game already has, so it needs no app update to run. It is not a Marvel storyline.

Read it next to `docs/custom-content-packs.md` (§5 the pack format, §6 scripting, §11.2 the SDK, §11.9 scenarios) and
`packages/mod-sdk/README.md`.

## What is in it

| Card code               | Card               | Kind                        | Set       | Script modeled on               |
| ----------------------- | ------------------ | --------------------------- | --------- | ------------------------------- |
| `x.sample-scenario.01`  | The Clockmaker     | villain, stages I and II    | Clockwork | Rhino 01094 (stage II searches) |
| `x.sample-scenario.02a` | Ticking Away       | main scheme, stages 1 and 2 | Clockwork | Underground Distribution 01116a |
| `x.sample-scenario.03`  | Cog Sentry (x2)    | minion (Retaliate 1)        | Clockwork | a keyword only, no script       |
| `x.sample-scenario.04`  | Pendulum Guard     | minion                      | Clockwork | Shocker 01103                   |
| `x.sample-scenario.05`  | Stopped Clocks     | side scheme                 | Clockwork | Breakin' & Takin' 01107         |
| `x.sample-scenario.06`  | Overwind (x2)      | treachery                   | Clockwork | Hard to Keep Down 01104         |
| `x.sample-scenario.07`  | Escapement Plating | attachment (to the villain) | Clockwork | Armored Rhino Suit 01098        |
| `x.sample-scenario.08`  | Jammed Gears       | side scheme                 | Gears     | Bomb Scare 01109                |
| `x.sample-scenario.09`  | Gear Crawler (x2)  | minion                      | Gears     | Hydra Bomber 01110              |

## Layout

```
pack.json             the author-written manifest (the build fills in files, sizes, hashes and dslFeatures)
cards/                one JSON record per card, named after its code
encounter-sets/       one EncounterSet record per set: id `<pack-id>-<name>`, a display name
scenarios/            one Scenario record per scenario: id `<pack-id>-<name>`
campaigns/            one PackCampaign per file: "Clockwork Crisis" (this scenario, then the Core Rhino), id `sample-scenario-crisis`
abilities/index.ts    default export: the pack's abilities, built with the SDK's DSL
CREDITS.md, PERMISSION.md
```

## How it is wired

- `scenarios/sample-scenario-clockwork.json` names the villain and main scheme cards, the scenario's own set
  (`sample-scenario-clockwork`), a recommended modular set (`sample-scenario-gears`, this pack's own) and the base game's
  `standard` and `expert` sets. The villain has two stages, so standard mode is `[1, 2]` and expert mode `[2, 2]`.
- A pack scenario may use only the plain `Scenario` fields (`id`, `name`, `packCode`, the villain, main scheme and set
  lists, `villainStages`, the modular set count). `mc-pack validate` lists any other field it finds.
- Every card that is in a set carries `encounterSetIds`, and every id that starts with the pack's id must have a record
  in `encounter-sets/`. The Gears set is a modular set: it can be picked at any base scenario (the Core Rhino, say) as
  well as at this one.
- The main scheme record is one card (`02a`) with an entry in `stages` per stage; the stage 1 A side carries the Setup.
- A treachery or attachment that names a card writes its exact printed name in the script.

## Building and testing

`packages/mod-sdk/src/sample-scenario.test.ts` builds this pack, validates the built output, and plays the scenario with
a base precon, and the Gears set at the Core Rhino, to an outcome on three seeds each. `mc-pack test` does the same for any
pack. Run it with `pnpm --filter @mc/mod-sdk test`.

## The campaign

`campaigns/sample-scenario-crisis.json` is a two-node linear campaign (docs/custom-content-packs.md §11.10). Winning The Clockmaker
checks `stopped` and records 1 spare `cogs` (between-games instructions); the Rhino node's setup is an in-game effect that
reads both, drawing 1 card per spare cog; winning it adds one more. It carries a minimal story. Its test is
`packages/mod-sdk/src/campaigns.test.ts`.

## Known gaps

- The pack has no card art. A card without a picture is drawn as a text face.
- A pack scenario cannot yet use several villains, set-aside cards, a villain choice or a modular set pool.
