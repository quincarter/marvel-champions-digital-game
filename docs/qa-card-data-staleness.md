# QA: committed card data against a fresh emit (2026-10-13)

**Status (2026-10-13):** the 20 class A-bug values below are corrected (owner answer 60B: in their own change against `main`) and each has a test in `packages/content/src/data/qa-staleness.qa.test.ts`. The corrections were taken hunk by hunk from a fresh emit; the A-neutral, A-regress and class B differences were left as they are, so a whole-pack re-emit still shows them. Found while re-running Kang's tests and not fixed here: all four copies of Kang's Dominion (11023) start in the encounter deck, where Kang's Arrival 1A sets them aside, so a stage 3's Forced Response finds none to tuck.

The audit as written, when nothing had been fixed: For each pack with a raw cache and a registered curation, `pnpm --filter @mc/content ingest -- --pack <p> --offline` was run alone, `git diff -- packages/content` captured, and the diff reversed with `git apply -R`. The working tree under `packages/content` was clean after every pack.

Packs: 62 raw caches. 58 audited. `fne`, `jj`, `luke_cage`, `synthezoid` have no curation (the ingest refuses them) and no data directory, so there is nothing to compare. 32 audited packs have no difference at all.

Classes:

- **A-bug**: gameplay data, committed value wrong, emit right (checked against the raw record and, where a scan exists, the scan).
- **A-neutral**: gameplay field differs but nothing observable changes.
- **A-regress**: committed value right, emit wrong (generator gap).
- **B**: cosmetic or provenance only (provenance files, art path extension or reprint choice, `printedCardId` on non-Civil-War stages, the "fetched" date in a file header, comments).

## Per pack (hunks)

| Pack      |  A-bug | A-neutral | A-regress |      B | Notes                                                                            |
| --------- | -----: | --------: | --------: | -----: | -------------------------------------------------------------------------------- |
| bkw       |      0 |         0 |         0 |      1 | provenance `duplicateOfCardId`                                                   |
| cap       |      0 |         0 |         0 |      3 | provenance                                                                       |
| core      |      2 |         4 |         0 |      7 | Standard/Expert classification; 01050 refs; 3 `completionLoses`                  |
| drs       |      0 |         2 |         0 |      1 | 09004, 09028 refs; provenance                                                    |
| falcon    |      0 |         0 |         0 |     35 | `.jpg` to `.png` only                                                            |
| gambit    |      1 |         0 |         0 |      0 | 37025 hazard                                                                     |
| gmw       |      2 |         0 |         0 |      0 | 16108, 16126 hazard                                                              |
| gob       |      0 |         2 |         2 |      4 | 02006a/b refs (regress); `completionLoses` on 02005, 02018 + art                 |
| hlk       |      0 |         0 |         0 |      1 | provenance                                                                       |
| hood      |      0 |         0 |         0 |      3 | art extension                                                                    |
| ironheart |      0 |         0 |         0 |      1 | 29022 art reprint choice                                                         |
| mojo      |      2 |         0 |         0 |      0 | 39036 acceleration, 39064 hazard                                                 |
| msm       |      0 |         0 |         0 |      2 | provenance                                                                       |
| mts       |      1 |         0 |         0 |      0 | 21189b acceleration                                                              |
| mut_gen   |      1 |         0 |         0 |      5 | 32031a flip face mental resource; 5 `printedCardId`                              |
| ncrawler  |      0 |         0 |         0 |      1 | 48017 art reprint choice                                                         |
| nebu      |      1 |         1 |         0 |      0 | 22033 `maxWithTrait`; second ref dropped (same hunk)                             |
| next_evol |      0 |         1 |         2 |      5 | 40041 refs; `randomVillainName` dropped on 2 scenarios; printedCardId            |
| phoenix   |      1 |         0 |         0 |      0 | 34002a flip face physical resource                                               |
| sm        |      4 |         0 |         0 |      0 | 27105, 27174a, 27190, 27191 icons                                                |
| stld      |      0 |         1 |         0 |      0 | 17011 refs                                                                       |
| thor      |      0 |         0 |         0 |      1 | provenance                                                                       |
| toafk     |      5 |         2 |         0 |     14 | 11018-11021, 11049 encounter sets; two comment-only; printedCardId + art         |
| tt        |      0 |         0 |         0 |      1 | `printedCardId`                                                                  |
| wolv      |      0 |         0 |         0 |      1 | 35021 art reprint choice                                                         |
| x23       |      0 |         0 |         0 |      1 | 43027 art reprint choice                                                         |
| **Total** | **20** |    **13** |     **4** | **87** | a gob hunk holding both `completionLoses` and an art path counts in both columns |

No difference at all (32 packs): angel, ant, aoa, aos, bp, cw, cyclops, deadpool, drax, gam, hercules, iceman, jubilee, magneto, nova, psylocke, qsv, rogue, ron, scw, silk, spdr, spiderham, storm, trors, twc, valk, vision, vnm, warm, winter, wonder_man, wsp. The `duplicateOfCardId` rewrites in the task brief are real (bkw, cap, drs, hlk, msm, thor) but class B: only `wave9-hero-pack-decks.test.ts` reads that field outside provenance. spiderham and vision showed no difference today.

## Class A differences, with verdicts

### A-bug: committed data wrong, emit right (20 hunks, 18 cards and 2 sets)

Scheme icons (raw `scheme_*` field present; scans read for 27190, 27105, 16108, 39036, 27174a and agree). The engine counts icons on any card in play (`rules.ts` `printedIconsOn`; audit.ts for acceleration and hazard), so each is a live rules effect:

| Card                                     | Missing icon | What a player sees                                                                                                                                        |
| ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27105 Team Leader (sm attachment)        | crisis       | The main scheme can be thwarted while Team Leader is attached to a Sinister Six villain.                                                                  |
| 27174a Public Outcry (sm environment)    | acceleration | Standard-mode Bad Publicity adds no extra threat each round.                                                                                              |
| 27190 Venom (sm ally)                    | hazard       | No extra encounter card is dealt while Venom is in play.                                                                                                  |
| 27191 Symbiote Suit (sm upgrade)         | hazard       | Same, while the suit is in play.                                                                                                                          |
| 16108 Kree Command Ship (gmw env)        | hazard       | Ronan's environment deals no extra encounter card.                                                                                                        |
| 16126 Vandarian Power Stone (gmw attach) | hazard       | Same, while attached.                                                                                                                                     |
| 37025 Guild Business (gambit obligation) | hazard       | An obligation in play deals no extra card.                                                                                                                |
| 39036 Build the Case (mojo obligation)   | acceleration | No extra threat per round while in play.                                                                                                                  |
| 39064 The One with the Breakup (mojo)    | hazard       | No extra encounter card.                                                                                                                                  |
| 21189b Jormungand (mts attachment)       | acceleration | No extra threat per round while attached to Loki. Raw says 1; no scan of the B face exists in `assets` (21189a.png only), so this one rests on raw alone. |

Encounter set membership:

- toafk 11018 Weakened, 11019 Stolen Memories, 11020 Depowered, 11021 Time-Travel Hijinks have `encounterSetIds: []`; raw `card_set_code` is `kang` (villain set, positions 22-28). 11049 Fear of Kang is `mot` (modular, position 4). Player sees: the Kang set's four obligations (7 copies) and Fear of Kang (2 copies) are never shuffled into the built encounter deck. `kang-encounter-set.test.ts` already works around this by relabelling a filler instance; its docblock flags it as a data gap. Fixing it changes Kang's deck size by 7 cards (9 with Master of Time), so any scenario test that counts the deck or seeds a reveal will shift.
- core `standard` and `expert` encounter sets lack `classification`. `difficultySetAlternativesFor` (`scenario-options.ts`) offers replacements by classification, so where a scenario prints Standard II / Expert II (hood and the other "II" sets), Core's Standard and Expert are not offered. `modular-pool.ts` keeps them out of the modular pool through `DIFFICULTY_SET_IDS`, so there is no leak the other way.

Play restriction:

- nebu 22033 Guardians of the Galaxy lacks `playRestrictions.maxWithTrait {TEAM, per player, 1}`. Printed "Max 1 [[team]] card per player". Player sees: a second Team card can be played. The script comment already says "(data)". The same hunk also drops the second ability ref (see A-neutral).

Flip-face resource icons (raw back record has `resource_*`; scans of 32031b and 34002b agree):

- mut_gen 32031a Solid, flipped (Phased, 32031b): mental resource missing. phoenix 34002a Phoenix Force flipped (34002b): physical resource missing. `resources.ts` reads `flipSide.resourceIcons`, so a flipped permanent upgrade contributes no resource today. Low impact.

### A-neutral: field differs, no observable change (13 hunks)

- Ability refs that the emit no longer splits: 01050 Hulk (core), 09004 Magic Blast and 09028 Baron Mordo (drs), 17011 Adam Warlock (stld), 40041 Luck Be a Lady (next_evol), 22033 (nebu). The committed data lists `-constant`, `-constant-2..4` refs for the `[physical] - ...` bullet lines; the emit keeps one ref. Every dropped ref is a `partOf(...)` stub in its script (`aggression.ts`, `drs/kit.ts`, `drs/nemesis.ts`, `star-lord-kit.ts`, `domino/events.ts`, `nebula-pack-cards.ts`), so behaviour is the same. The registry guard (`ability-refs-registered.test.ts`) checks data against the registry, not the reverse, so it stays green. `star-lord-kit.test.ts` and `domino/events.test.ts` name the `-constant-N` ids (titles and `LUCK_PARTS`); check them if the refs are re-emitted. Generator is right: bullets are part of one effect.
- `completionLoses: true` on the final stage of core 01097 (Rhino), 01117 (Klaw), 01139 (Ultron), gob 02005 (Norman Osborn) and 02018 (Green Goblin). Raw text "If this stage is completed, the players lose the game." is correct, but `defeat.ts` `completionLoses()` already loses when there is no next stage, and these are all last stages. Redundant, harmless.
- toafk 11020 and 11049: only a comment dropped and the refs reflowed.

### A-regress: committed right, emit wrong (generator gaps, 4 hunks)

1. **gob 02006a Criminal Enterprise / 02006b State of Madness (2 hunks).** Committed: `02006a.enters-with-infamy` + `02006a.flip`, and `02006b.enters-with-madness` + `02006b.flip` (hand-edited into the generated file, with a comment: two independent mechanisms, one trigger per `AbilityDefinition`). The emit gives one ref each, `02006a.criminal-enterprise-constant` / `02006b.state-of-madness-constant`, which no script registers. Re-emitting as is breaks the Risky Business and Mutagen scripts (`wave1/gob/risky-business.ts`, `schema/wave1.test.ts` fixture) and fails the registry guard. Rule: the clause splitter does not split "enter play with N counters" from "If there are no counters here, flip". Needs a curation override or a splitter rule.
2. **next_evol scenarios `morlock-siege` and `on-the-run`: `randomVillainName: "The Marauders"` dropped (2 hunks).** Neither the curation type nor `normalize/scenarios.ts` carries `randomVillainName` (only `startingVillain`), so the wave 7 hand edit is lost. The client (`random-villain.ts`) uses it to label the random opening villain; without it Morlock Siege (`startingVillain: "random"`) names its `villainCardId` villain on the shelf, setup preview and modular-sets card, promising a villain the board may not show. On the Run falls back to the trait label ("Marauder"). Needs a `randomVillainName` field on the scenario curation.

### Pure drift (class B, 87 hunks)

- Provenance `duplicateOfCardId` rewrites: bkw, cap, drs, hlk, msm, thor.
- Art path extension `.jpg` to `.png` (both files exist in `assets/card-art/bundles/cards`): falcon (35), hood (3), gob (4), toafk (7).
- Art reprint choice: ironheart 29022, ncrawler 48017, wolv 35021, x23 43027 now point at the original printing's art (`duplicate_of_code`: 27046, 32014, 32048, 36026) instead of another reprint's file; same card name each time, both files exist.
- `printedCardId` on stages of non-Civil-War main schemes (mut_gen 32125-32129, next_evol 40139-40143, toafk 11007-11013, tt 55028). Only the Civil War stage chooser reads it.
- Core: "fetched" date in the file headers (2026-09-12 to 09-13) on six files.

## Recommended fix order

1. **Pack re-emit keeping every line, no other work**: gambit, gmw, mojo, mts, sm, phoenix, mut_gen (the flip-face icon plus printedCardId), and the provenance-only packs bkw, cap, hlk, msm, thor, plus the art-only packs falcon, hood, ironheart, ncrawler, wolv, x23, tt. Each A-bug in these is the whole diff or sits beside B lines. Verify with the pins in `packages/content/src/data/qa-staleness.qa.test.ts` and run the scenario tests that use these cards (icons shift hazard and acceleration counts).
2. **Re-emit plus a test pass**: toafk (deck size grows by 7 or 9 cards; update tests that count Kang's deck, remove the relabel workaround), core (classification; the 01050 ref drop; check `aggression.ts`), drs, stld, nebu (22033 gains a play restriction; `nebula-pack-cards.test.ts` and `cross-hero.test.ts` mention the card), core `completionLoses`. Drop the orphan `partOf` script entries afterwards, or leave them.
3. **Curation or normalizer first, then re-emit**: gob (give 02006a/b their two-ref shape in the curation or teach the splitter, else the emit breaks the scripts), next_evol (add `randomVillainName` to the scenario curation, then the ref drop for 40041 and the `printedCardId` lines come along safely).
4. Delete the `.fails` on each pin in `qa-staleness.qa.test.ts` as its card is fixed.
