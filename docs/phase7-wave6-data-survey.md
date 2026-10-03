# Wave 6 data survey (cycle 6 in our ids, Mutant Genesis)

Survey only, 2026-10-01, branch `feature/wave-6` at 15b6fe24. No code or data was changed. Packs: `mut_gen` (MC32 box),
`cyclops`, `phoenix`, `wolv`, `storm`, `mojo`, `gambit`, `rogue`. Companion docs: `phase7-wave6-handoff.md`,
`phase7-wave6-sources.md` (written separately). Commands used: `survey.ts --pack <code>` (read-only unless `--json`
is given; I wrote its JSON to the scratchpad only), grep/ls, and a Python read of `raw/marvelcdb/*.json`.

## 1. Where each pack stands

Card counts are the raw MarvelCDB record count, which equals the emitted card count for the six emitted packs (the
emitter keeps one card per MarvelCDB record, a/b faces included).

| Pack      | Raw cache (`raw/marvelcdb/`) | Emitted in `src/data/<pack>/` | Cards | Encounter sets                                                                                     | Scenarios | Starter decks | Curation file                | In `survey.ts` / `ingest` registry                                        | Pool today    |
| --------- | ---------------------------- | ----------------------------- | ----- | -------------------------------------------------------------------------------------------------- | --------- | ------------- | ---------------------------- | ------------------------------------------------------------------------- | ------------- |
| `mut_gen` | yes, 208 records, 2026-09-13 | no                            | -     | -                                                                                                  | -         | -             | none (`curation/mut_gen.ts`) | not registered; surveys "bare" with errors                                | none          |
| `cyclops` | 35                           | yes                           | 35    | `cyclops_nemesis`                                                                                  | 0         | 0             | `cyclops.ts` (32 lines)      | registered                                                                | `DATA_ONLY_*` |
| `phoenix` | 35                           | no                            | -     | -                                                                                                  | -         | -             | `phoenix.ts` (62 lines)      | registered in `survey.ts` only; deliberately not in `ingest-marvelcdb.ts` | none          |
| `wolv`    | 37                           | yes                           | 37    | `deathstrike`, `wolverine_nemesis`                                                                 | 0         | 0             | `wolv.ts` (45)               | registered                                                                | `DATA_ONLY_*` |
| `storm`   | 39                           | yes                           | 39    | `shadow_king`, `storm_nemesis`                                                                     | 0         | 0             | `storm.ts` (78)              | registered                                                                | `DATA_ONLY_*` |
| `mojo`    | 71                           | yes                           | 71    | `crime`, `fantasy`, `horror`, `longshot`, `magog`, `mojo`, `sci-fi`, `sitcom`, `spiral`, `western` | 0         | 0             | `mojo.ts` (61)               | registered                                                                | `DATA_ONLY_*` |
| `gambit`  | 35                           | yes                           | 35    | `exodus`, `gambit_nemesis`                                                                         | 0         | 0             | `gambit.ts` (30)             | registered                                                                | `DATA_ONLY_*` |
| `rogue`   | 35                           | yes                           | 35    | `reavers`, `rogue_nemesis`                                                                         | 0         | 0             | `rogue.ts` (46)              | registered                                                                | `DATA_ONLY_*` |

Notes on the emitted packs:

- Every `scenarios.ts` and `starterDecks.ts` is an empty array. Every curation has `scenarios: []` and
  `starterDecks: []`; the emitted packs are cards plus encounter sets only. `mojo` is a scenario pack (MojoMania: three
  main schemes, villain Mojo plus Spiral/Magog/Longshot sets, per `mojo.ts`'s "Three main scheme B-side images") and
  still has no `Scenario` record, so it is the one non-box pack whose scenario data is missing outright. Each hero pack
  also lacks its precon (every wave 5 hero pack has one, `WAVE5_STARTER_DECKS`).
- Pack release dates are in the emitted `packs.ts`: cyclops 2022-09-30, wolv/storm/mojo 2022-11-11, gambit/rogue
  2023-02-24. `phoenix.ts` says 2022-09-30 (Hall of Heroes Jean Grey/Phoenix page). Verify cyclops vs phoenix, since
  the two are the same date; MarvelCDB `pack_name` for mojo is "Mojo Mania", our `Pack.name` is "MojoMania" (check the
  sources doc for the printed form before renaming).
- The MarvelCDB code prefixes are not release order: cyclops 33, phoenix 34, wolv 35, storm 36, gambit 37, rogue 38,
  mojo 39, mut_gen 32.
- All six curations register the cycle as `{ id: "cycle6", name: "Cycle 6", order: 6 }`, and so do the emitted
  `packs.ts` (`CYCLOPS_CYCLE` etc. - six duplicate `Cycle` constants, one per pack). Compare sm/nova, which use
  `{ id: "cycle5", name: "Sinister Motives", order: 5 }`. gmw's curation comment (lines 14-16) documents the same
  "internal id differs from FFG numbering" case, so the id stays and only the name changes.

## 2. Why `mut_gen` and `phoenix` are not emitted

Both have a complete raw cache (`mut_gen.json` 208 records, `phoenix.json` 35, fetched 2026-09-13 from
`marvelcdb.com/api/public/cards/<code>`), so neither needs a new fetch. (`emit.ts` is only the TypeScript
serializer; the pipeline entry point is `scripts/ingest-marvelcdb.ts` with its `REGISTERED_CURATIONS`, and
`survey.ts` has its own copy of that map.)

**`phoenix`** is blocked by a single record. Burning Hunger (34028, the obligation) has no `text` or `real_text` field
at all in the raw record, so `validateCard()` rejects it (empty obligation text). `survey.ts --pack phoenix` reports
clean (35 cards, zero issues) because the survey never runs `validateCard`; `ingest-marvelcdb.ts` has a comment block
(~line 132) explaining why `phoenix` is left unregistered, and `curation/phoenix.ts` carries the same reasoning plus
one correction (Phoenix Force 34002a dash cost). The earlier passes said a second source was needed. **That source now
exists locally:** `assets/card-art/bundles/cards/34028.png` is present (I read it). It is legible and reads:
"Give to the Jean Grey player. When Revealed: If you have the UNLEASHED trait, search the encounter deck, discard pile,
and set-aside area for Dark Phoenix and reveal her. Then, remove Burning Hunger from the game. If you have the
RESTRAINED trait, remove 1 power counter from Phoenix Force and this card gains surge. Discard this card." That is my
reading of one scan, not a transcription to commit: the data agent should transcribe it again per the HoH image
transcription convention and note `34028.png` as evidence. The `Correction` type's `textReplace` is find/replace over
existing text, so a from-scratch text field needs a small `types.ts` + `normalize` change (the curation header
already names this). Also check how the normalizer treats "UNLEASHED"/"RESTRAINED" as traits (they are identity
traits Jean Grey's kit changes).

**`mut_gen`** has no curation file and fails normalization under `bareCuration` with 21 lines (survey run today):

- 3 main scheme B sides missing numbers: 32063b and 32087b "missing target threat", 32125b "missing acceleration".
- 1 upgrade without a cost: 32031a (Shadowcat's Phased-form upgrade side; the dash/`specialCost` pattern, same as
  phoenix 34002a).
- 2 "ally without a cost" or "support without a cost" lines on campaign double-sided cards: 32171b, 32172b.
  (32171a/32172a are the campaign side schemes; their b sides are player cards.)
- 32066 (Robert Kelly ally): no ATK and no THW; needs a `cardNotes` entry (printed dashes). He is an ally Shadowcat
  and Colossus protect: see the Sabretooth scenario text (MC32 p. 7).
- 32080 (minion): ATK and scheme absent; needs `cardNotes`.
- Attach rules the parser does not recognise (4 cards never become a card at all): 32077 and 32103 ("Attach to a
  [Sentinel] minion ... and give it a tough status card"), 32107 ("Attach to your identity if a copy of Targeted for
  Elimination is not attached to you"), and 32170 (attachment with no attach rule, likely the same
  "attach clause inside When Revealed" shape sm solved with `Correction.impliedAttachHost`).

Not in the survey because it is not an error, but a schema decision: 28 cards have `card_set_code: null` in raw
(player-side basics/hero cards and the 20 campaign player cards), and "campaign" faction cards (25: 171-175 are the
five double-sided encounter-side campaign cards, 176-195 the role upgrades, see "Campaign cards" below). The raw set
codes are `magneto_villain`, `mansion_attack`, `project_wideawake`, `sabretooth`, `master_mold`, `shadowcat`,
`colossus`, `brotherhood`, `acolytes`, `future_past`, `mut_gen_campaign`, `brawler`/`commander`/`defender`/
`peacekeeper` (role sets), `colossus_nemesis`, `shadowcat_nemesis`, `mystique`, `zero_tolerance`, `sentinels`.
`brawler`, `commander`, `defender` and `peacekeeper` are four role sets, 5 upgrades each (MC32 p. 5 says 5 per role).

The box has 16 villain records (stage chains for Sabretooth, Sentinel, Master Mold, Magneto plus the four one-card
Brotherhood villains Avalanche, Blob, Pyro and Toad, 32121-32124; the Brotherhood scenario is a multiple-villain setup),
26 main scheme records, 2 heroes (Colossus 32001a, Shadowcat 32030a). That matches the box contents in MC32
(five scenarios: Sabretooth, Project Wideawake, Master Mold, Mansion Attack, Magneto).

## 3. Data-only test and `DATA_ONLY_*` exports

- `data-only.test.ts` asserts `PACKS` has exactly 19 entries, the six cycle 6 packs (cyclops, gambit, wolv, rogue,
  mojo, storm) among them, each asserted `cycleId === "cycle6"` (`expect(cycleOf(code), code).toBe("cycle6")`). The
  test comment says "Phoenix is not in this pool yet - blocked, see curation/phoenix.ts". When wave 6 moves these six
  out, the `PACKS` list, the "19 packs" count and this cycle-6 loop all change: that test is the one that must shrink
  (cycle 6 removed, 13 packs left) in the same commit as the move, exactly as wave 5 did for cycle 4.
- `index.ts` (lines ~472-588): `export *` for each pack, imports of `*_CARDS`/`*_ENCOUNTER_SETS`, then
  `DATA_ONLY_CARDS` and `DATA_ONLY_ENCOUNTER_SETS` (19 packs, bp, angel, storm, psylocke, jubilee, cyclops, gambit,
  ncrawler, magneto, winter, falcon, silk, rogue, wolv, iceman, wonder_man, x23, deadpool, mojo). There is no
  data-only export for scenarios or starter decks. Packs not emitted (`mut_gen`, `phoenix`) appear nowhere in
  `index.ts` (the string "phoenix" occurs only as a comment elsewhere; grep found `mut_gen` in neither).
- `index.ts` header comment on `CAMPAIGNS` states MC32 has only raw MarvelCDB cached and is not ingested.
  `CAMPAIGNS` today: `[TRORS_CAMPAIGN, GMW_CAMPAIGN, MTS_CAMPAIGN, SM_CAMPAIGN]`.

## 4. How wave 5 moved data-only packs into `WAVE5_*`

From `index.ts` (lines ~340-440) and `wave5.test.ts`:

1. `sm` was newly emitted (new `src/data/sm/`, with hand-authored `campaign.ts` listed in curation
   `handAuthoredModules`). `nova`/`ironheart`/`spiderham`/`spdr` were already emitted data-only and were lifted out of
   `DATA_ONLY_*`.
2. A "Wave 5" block placed before `PLAYABLE_CARDS` (source-order matters because top-level `const`s run in order)
   re-exports each pack (`export * from "./sm/index.js"` ...), imports the `*_CARDS`, `*_ENCOUNTER_SETS`,
   `*_STARTER_DECKS`, `SM_SCENARIOS` and `SM_CAMPAIGN`, and defines `WAVE5_CARDS` (Core + the packs' cards, in release
   order), `WAVE5_ENCOUNTER_SETS` (without Core's), `WAVE5_SCENARIOS`, `WAVE5_STARTER_DECKS`.
3. `PLAYABLE_CARDS` appends `WAVE5_CARDS.slice(CORE_CARDS.length)`; `CAMPAIGNS` gains `SM_CAMPAIGN`.
4. The packs' imports and spreads were deleted from `DATA_ONLY_CARDS`/`DATA_ONLY_ENCOUNTER_SETS`, and the doc comments
   updated ("moved into `WAVE5_*`"). `silk` (also cycle 4) stayed data-only because it was not scripted.
5. `wave5.test.ts`: (a) data integrity per pack (`validateCard` over every card), (b) per-scenario checks
   (`validateScenario`, encounter sets registered, villain/main scheme ids resolve), (c) starter decks
   (`validateStarterDeck`, 40 cards, verified provenance, hero-kit cards present at printed quantity), (d) campaign
   record (`validateCampaign`, scenario order, `campaignSpecific` sets, prohibited records), (e) "pool wiring" block
   (`WAVE5_CARDS` is Core plus the packs with no duplicate ids, the pool version is deterministic and differs from
   Core's, `PLAYABLE_CARDS` includes the wave, the non-wave pack stays out). `pool-version.ts` and `catalog*.ts` also
   know packs (see `catalog-codes.ts`; not read in detail, check at the wiring step).
6. `data-only.test.ts` edits: remove the pack from `PACKS`, update the count and the "no id collides with Core,
   waves 1-5" list (add `WAVE6_CARDS`), adjust the cycle assertion comments.

Wave 6 mirrors this with `WAVE6_CARDS` (Core + mut_gen, cyclops, phoenix, wolv, storm, mojo, gambit, rogue; release
order, which is NOT the MarvelCDB code order) etc. Mojo as a scenario pack contributes `WAVE6_SCENARIOS` and an
encounter-set group; mut_gen contributes the scenarios, `MUT_GEN_CAMPAIGN` and the box precons (Colossus, Shadowcat;
the MC32 rulebook has them). The wave 5 comment says "Declared before `PLAYABLE_CARDS`" - same constraint here.

## 5. "Cycle 6" cycle names

Six `packs.ts` define `<PACK>_CYCLE: Cycle = { id: cycleId("cycle6"), name: "Cycle 6", order: 6 }`, and six curations
carry the same literal. To rename, change the curation `cycle` field to `{ id: "cycle6", name: "Mutant Genesis",
order: 6 }` and regenerate with `pnpm --filter @mc/content ingest -- --pack <code> --offline`; the id must not
change (`data-only.test.ts` and the pool-version hash read it; `grep cycle6` hits only the content package: `cards`
and `client` have none). The handoff says to confirm the name against RRG 1.8 Appendix VI; the sources doc owns
that. `data-only.test.ts` asserts the `cycleId`, never the name, so renaming is safe against it. Whether the
non-box-named cycle matches how other cycles are named: cycle 5 = "Sinister Motives" (box name) is the pattern.

## 6. MC32 campaign cards and rules

Rulebook: `docs/campaign-modes/mc32_mutant_genesis_rulebook_v5-compressed.pdf`, converted at
`docs/campaign-modes/markdown/mc32_mutant_genesis.md` (936 lines), log sheet
`docs/campaign-modes/log-sheets/mc32_mutant_genesis_campaign_log.pdf`. MC32 pp. 4-5 (the page headings in the
markdown):

- Cards 171-195 are campaign-specific: 171-175 are the five double-sided encounter campaign cards (raw
  `mut_gen_campaign`, faction `campaign`, 171a Frightened Police, 172a Enemy of My Enemy, 173a Find the Prisoners,
  174a Surprise Attack, 175a Magneto's Fortress; the a sides are side schemes, the b sides are player upgrades or
  allies, per the survey's 32171b support and 32172b ally lines); 176-195 are 20 player cards. Raw has them as `campaign` faction, set code null.
- Campaign Roles (p. 5): four roles with 5 upgrades each (Brawler, Commander, Defender, Peacekeeper; raw set codes
  `brawler`, `commander`, `defender`, `peacekeeper`; the role-to-aspect association is in the markdown, read it at
  the data step). Each player picks a different role at Scenario 1, earns the role's upgrades by defeating each
  scenario's campaign side scheme, takes one random upgrade into play at the start of each game, and "use it or lose
  it" (removed at the end of the game). Role also allows 1 event and 1 upgrade from the role's aspects added outside
  deck size.
- Expert campaign: record remaining hit points (capped at base HP), defeated players rejoin by an acceleration
  token. Expert-only setup/victory lines.
- Future Past modular set is used throughout the campaign (the future-Sentinel deck set aside, cards accumulate in
  the campaign log). Mystique/Brotherhood/Sentinels/Zero Tolerance modular sets are scenario-specific.
- Order is fixed: Sabretooth, Project Wideawake, Master Mold, Mansion Attack, Magneto (win all five).

For comparison, `sm`'s sixteen campaign cards are ordinary `SM_CARDS` entries that carry `specificTo: { kind:
"campaign", ... }` (index.ts comment), and `Campaign` records live in `<pack>/campaign.ts`
(`packages/content/src/schema/sets.ts` line ~326: `boxCode`, `packCode`, `scenarioIds`, `campaignSetIds`,
`perSeatSetIds`, `prohibited`, `logSheetReference`). `packages/cards/src/campaigns/` has the engine side
(`sm.ts`, `sm-campaign-cards-availability.test.ts`); there is no `mut_gen` there, which is the ability agents' step.

## 7. Card scans under `assets/card-art/`

`assets/card-art/bundles/cards/<code>.png` (5144 files in all; manifest `hall-of-heroes-manifest.tsv` lists the
cards re-fetched from Hall of Heroes; none of the wave 6 codes were looked up there; it has 467 lines in total).
Coverage versus raw record codes (a code counts as present if `<code>.png` or its a/b-stripped form exists; only the
pack's own prefix was compared):

| Pack      | Raw records | Records with no scan | Missing codes                                                |
| --------- | ----------- | -------------------- | ------------------------------------------------------------ |
| `mut_gen` | 208         | 4                    | 32050, 32052, 32053, 32054                                   |
| `cyclops` | 35          | 3                    | 33024, 33025, 33026                                          |
| `phoenix` | 35          | 4                    | 34023, 34025, 34026, 34027 (34028 Burning Hunger is present) |
| `wolv`    | 37          | 5                    | 35020, 35021, 35024, 35025, 35026                            |
| `storm`   | 39          | 7                    | 36021, 36023, 36024, 36025, 36027, 36028, 36029              |
| `gambit`  | 35          | 6                    | 37016, 37017, 37018, 37022, 37023, 37024                     |
| `rogue`   | 35          | 5                    | 38017, 38020, 38021, 38022, 38023                            |
| `mojo`    | 71          | 0                    | none                                                         |

Caveats: the missing codes cluster in the 3-digit range 16-29 of each hero pack, which are probably encounter cards
(nemesis, obligation or modular), so the check is crude: it does not tell a double-sided card whose scan is a single
`<code>.png` from a card that truly lacks art. 32050, 32052-32054 sit in the Master Mold/Mansion Attack block. Do
a proper code-by-code check at emit time: `normalize/art.ts`'s `withLocalArt` and the survey category "no artwork
reference for a printed face" are the real tests, and the six emitted packs normalized without that error. Scans are
gitignored and not redistributable (CLAUDE.md IP boundary); do not wire them into versioned data.

## 8. Schema gaps and risks I can see

Nothing was run through `validateCard`, so these are inferences from the raw data and the rulebook.

1. Obligation text from scratch (Burning Hunger): `Correction` only does find/replace. Small `types.ts` plus
   `normalize` change, or add a `textOverride` field.
2. Campaign roles: `Campaign` has no notion of role sets, "earned role upgrades" or per-role aspect access. May need
   an optional field, or can live entirely in `@mc/cards`' `CampaignDefinition` (like MTS's System Shock). Decide
   with game-rules-architect; ingestion only needs the four role sets to emit as encounter-set-like groups with
   `specificTo` campaign.
3. Shadowcat's extra forms ("Phase form", MC32 p. 3: additional hero forms that do not count against the
   once-per-turn flip) and Phoenix's Unleashed/Restrained traits: identity-state data. Check what `HeroIdentityCard`
   already supports (wave 5 added `progressingIdentity` for Ironheart; wave 4's `otherFaceId`). The 32030a Phased
   form is a separately emitted card.
4. The mut_gen raw has `Permanent` and `Setup`; both are already keywords in `schema/keywords.ts`/glossary.
   Checked for new keyword/mechanic names in the MC32 rulebook (glossary page 3: Permanent, Setup): no unrecognised
   keyword name found by grep, but the keyword list in `schema/keywords.ts` was not diffed against all 208 cards.
5. Attach shapes with "give it a tough status card" (32077, 32103) and "if a copy ... is not attached to you" (32107)
   probably need `Correction.impliedAttachHost`/a new attach-host qualifier ("a Sentinel minion without Energy
   Barrier attached" resembles `withoutAttachmentNamed`; "identity if no copy attached to you" is a conditional
   host).
6. Brotherhood of Mutants: four villain records (Avalanche, Blob, Pyro, Toad, 32121-32124) in one scenario; wave 4
   notes (`phase7-wave4.md` ~line 698) flag it as the second user of the "keyword in the victory display" open item.
   `multipleVillains` scenarios exist (sm's Sinister Six): reuse that shape.
7. Main scheme B sides 32063b, 32087b, 32125b missing threat numbers: the same "main scheme stage is not a printed
   A/B pair" family sm solved with `normalizeLetteredSchemeChain`; look at the raw first (they may be an a/b chain
   with an "NA/NB" quirk or a data hole needing a scan).
8. Mojo's ten encounter sets include per-genre sets (`crime`, `fantasy`, `horror`, `sci-fi`, `sitcom`, `western`)
   plus `spiral`, `magog`, `longshot`; `Scenario` needs the set composition for MojoMania (`mojo.ts` records no
   scenario); read the Hall of Heroes page for its setup rules.

## 9. Ordered data steps for the wave (one agent each)

Dependencies are in order; steps that touch different files can be parallel (at most 3).

1. **Phoenix 34028 text.** Add a from-scratch text field to `Correction` (or `textOverride`), curate Burning Hunger
   from `34028.png` (re-transcribe, cite the scan), register `PHOENIX_CURATION` in `ingest-marvelcdb.ts`, run
   `ingest -- --pack phoenix --offline`, run `validateCard` over the result. Files: `curation/types.ts`, `normalize/`,
   `curation/phoenix.ts`, `ingest-marvelcdb.ts`, new `src/data/phoenix/`.
2. **Schema/gap decisions for `mut_gen`** (game-rules-architect or this agent, write nothing yet but a short list):
   role sets, Shadowcat forms, the conditional attach hosts, setup/victory campaign data for the Campaign record.
   Output: the §8 items 2, 3, 5, 6, 7 settled in a short section of `docs/phase7-wave6.md`.
3. **`curation/mut_gen.ts` pass 1:** the 21 survey lines (3 main scheme B sides, 32031a/32171b/32172b costs,
   32066 and 32080 cardNotes, the four attach rules), the box's villains/main schemes, encounter set names, the cycle
   record, `handAuthoredModules: ["campaign"]`, release date from the sources doc. Register in both
   `ingest-marvelcdb.ts` and `survey.ts`; the pass is done when `survey.ts --pack mut_gen` is clean.
4. **`curation/mut_gen.ts` pass 2 (scenarios):** five `Scenario` records (Sabretooth, Project Wideawake, Master Mold,
   Mansion Attack, Magneto), expert-mode sets, modular/required sets (Future Past, Brotherhood, Mystique, Sentinels,
   Zero Tolerance); verified against MC32 pp. 7-19.
5. **mut_gen starter decks and campaign record:** Colossus and Shadowcat precons (MC32), plus the hand-authored
   `src/data/mut_gen/campaign.ts` (`MUT_GEN_CAMPAIGN`: boxCode MC32, five scenario ids, campaign sets, role/campaign
   cards `specificTo`, `logSheetReference`). Add the campaign-specific tests (as in `wave5.test.ts`).
6. **Emit `mut_gen`** (`ingest -- --pack mut_gen --offline`), typecheck, add a `wave6.test.ts` data-integrity
   describe for it (`validateCard` over 208 cards, scenario checks, campaign record). Not wired into the pool yet.
7. **Hero packs' precons:** `cyclops`, `phoenix`, `wolv`, `storm`, `gambit`, `rogue` starter decks (one agent per
   2-3 packs; source from the sources doc/Hall of Heroes lists, all 40 cards, `verified` provenance). Re-emit.
8. **`mojo` scenario curation:** the MojoMania `Scenario` records (three villain/main-scheme stages and the genre
   sets) and its starter-deck-or-none ruling; re-emit `mojo`.
9. **Rename the cycle:** change the six existing curations' `cycle` (plus `phoenix`, `mut_gen`) to "Mutant Genesis"
   once the sources doc confirms, regenerate all eight packs, check `git diff` shows only the six `packs.ts` files'
   name changes. (Can run with 7 or 8.)
10. **`WAVE6_*` exports:** in `index.ts` add the wave 6 block before `PLAYABLE_CARDS` (as in wave 5): `export *`
    for the eight packs, `WAVE6_CARDS`/`WAVE6_ENCOUNTER_SETS`/`WAVE6_SCENARIOS`/`WAVE6_STARTER_DECKS`, add
    `WAVE6_CARDS.slice(CORE_CARDS.length)` to `PLAYABLE_CARDS`, register the campaign in `CAMPAIGNS` only when its box
    campaign step lands (wave 5 did it with the box step), remove the six packs from `DATA_ONLY_*`.
    Update `data-only.test.ts` (PACKS 19 -> 13, comments) and add the "pool wiring" describe to `wave6.test.ts`.
    Check `pool-version.ts`/`catalog-codes.ts` for per-pack lists. Note per `MEMORY`'s wave-2 release gating: wire the
    wave into the client's playable pool in its own step, and keep scripted-card gating (`unscriptedCards`) in mind:
    until `@mc/cards` has a `wave6` module, these cards will remain unplayable even in `WAVE6_*`.
11. **Hand-off to ability-scripting-engineer / the QA agent:** per-hero plain-language ability notes (Shadowcat's
    Phase form, Colossus's Tough interactions, Phoenix's Unleashed/Restrained, Gambit's deck manipulation, Storm's
    Weather Deck, Mojo's genres, role upgrades) kept in the curation `scriptingNotes`, written per pack as part of
    steps 3-8 rather than as a separate pass.

## 10. Open questions for the main session

- Is Phoenix's release date (curation says 2022-09-30, shared with Cyclops) right? Hall of Heroes lists it; check
  the sources doc.
- Should `mojo`'s emitted name stay "MojoMania" or become "Mojo Mania" (MarvelCDB's `pack_name`)?
- The role-set data (step 2) is the biggest unknown; the Campaign roles may be a `@mc/cards` concern only.
