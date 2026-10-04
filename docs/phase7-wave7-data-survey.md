# Wave 7 data survey (cycle 7 in our ids, NeXt Evolution)

Survey only, 2026-10-04, branch `feature/wave-7`. No code or data was changed. Packs: `next_evol` (MC40 box),
`psylocke`, `angel`, `x23`, `deadpool`. Companion docs: `phase7-wave7-handoff.md`, `phase7-wave7-sources.md`
(written separately). Commands used: `survey.ts --pack <code>` (JSON to the scratchpad only), a Python read of
`raw/marvelcdb/*.json`, and an offline regen of the four emitted packs in a scratch copy of `packages/content`
(`scratchpad/data-survey/content/`, with `assets` symlinked so `withLocalArt` finds the scans). Nothing was written into
the repo. Model: `phase7-wave6-data-survey.md`.

## 1. Where each pack stands

Card counts for the emitted packs are emitted cards; for `next_evol` the raw record count is given (emitted count is
lower: each main scheme stage is a pair of raw records, 40077 plus 40077a and so on, that the normalizer merges, as
`mut_gen` went 208 raw to 192 emitted).

| Pack        | Raw cache (`raw/marvelcdb/`) | Emitted in `src/data/<pack>/` | Cards              | Encounter sets                  | Scenarios | Starter decks | Curation file                  | Registry (`ingest-marvelcdb.ts` / `survey.ts`) | Pool today    |
| ----------- | ---------------------------- | ----------------------------- | ------------------ | ------------------------------- | --------- | ------------- | ------------------------------ | ---------------------------------------------- | ------------- |
| `next_evol` | yes, 216 records, MarvelCDB  | no                            | - (raw 216)        | -                               | -         | -             | none (`curation/next_evol.ts`) | not registered; bare survey gives 40 lines     | none          |
| `psylocke`  | 33 records                   | yes                           | 33                 | `psylocke_nemesis`              | 0         | 0             | `psylocke.ts` (45 lines)       | registered in both                             | `DATA_ONLY_*` |
| `angel`     | 33 records                   | yes                           | 32 (3-face merged) | `angel_nemesis`                 | 0         | 0             | `angel.ts` (35)                | registered in both                             | `DATA_ONLY_*` |
| `x23`       | 40 records                   | yes                           | 40                 | `x23_nemesis`                   | 0         | 0             | `x23.ts` (47)                  | registered in both                             | `DATA_ONLY_*` |
| `deadpool`  | 58 records                   | yes                           | 58                 | `deadpool_nemesis`, `dreadpool` | 0         | 0             | `deadpool.ts` (31)             | registered in both                             | `DATA_ONLY_*` |

Notes:

- The four emitted packs normalize with zero survey issues. All four `Cycle` records read `{ id: "cycle7", name:
"Cycle 7", order: 7 }` in both `packs.ts` and the curation. Rename the name only to "NeXt Evolution" (the id stays;
  `data-only.test.ts` line ~117 asserts `cycleId` only). `mut_gen.ts` is the model (its curation header, line 17).
- Release dates in the curations: psylocke and angel 2023-09-22, x23 and deadpool 2023-11-17. The sources doc gives
  the box as August 18, 2023 (Hall of Heroes).
- `data-only.test.ts` has `PACKS` of 13 including the four (cycle 7 assertion at line ~117). When wave 7 moves them
  out, the list, the count and that assertion change in the same commit, as wave 6 did.
- `index.ts`: `DATA_ONLY_CARDS` and `DATA_ONLY_ENCOUNTER_SETS` hold `ANGEL`, `PSYLOCKE`, `X23`, `DEADPOOL` among 13
  packs. A `WAVE6_*` block exists; a `WAVE7_*` block does not.
- Every emitted `scenarios.ts` and `starterDecks.ts` is an empty array. No pack has a precon yet.

## 2. Offline regen of the four emitted packs (scratch only)

`ingest-marvelcdb.ts --pack <p> --offline` run in the scratch copy; `diff -r` against the committed
`src/data/<pack>/`:

| Pack       | Result vs committed                                |
| ---------- | -------------------------------------------------- |
| `psylocke` | identical (33 cards)                               |
| `deadpool` | identical (58 cards)                               |
| `angel`    | one card differs: Elixir 42011 (see below)         |
| `x23`      | one card differs: Self-Isolation 43028 (see below) |

Without the `assets` symlink `psylocke` fails ("41002a: no artwork reference for the card front"): the regen depends
on the local scan `41002a.png` through `withLocalArt`, as the curation says. A checkout without art cannot regenerate
it. No image-extension drift was seen.

Drift is from the wave 6 parser changes (#94 touched `parse-text.ts`), not from raw data:

- **Elixir 42011** (committed vs regen). Committed has `playRestrictions: { requiresIdentityTrait: trait("X-FORCE OR
X-MEN") }` and abilities `[42011.elixir-response]`. Regen drops the play restriction and emits
  `[42011.elixir-constant, 42011.elixir-response]`. The committed value is a bogus single trait named "X-FORCE OR
  X-MEN"; the regen moves "Play only if your identity has the X-Force or X-Men trait" into a constant ability for the
  scripter. Regen is the better data, but it is an either-trait restriction the schema cannot express as a
  `requiresIdentityTrait` (the single-trait ones, Pete Wisdom 41018 and IPAC, still parse). Consider an `anyOf` trait
  list on `playRestrictions` (section 5).
- **Self-Isolation 43028**: abilities `[43028.obligation]` becomes `[43028.self-isolation-constant,
43028.self-isolation-response]` (the obligation text now parses into a constant ability plus a Response). Ability ids
  change; grep found no reference to either id in `packages/cards`, `engine` or `client`, so nothing breaks today.

Regen should be done once, in the step that renames the cycle, and the two diffs reviewed by hand. The deadpool and
psylocke regen then shows only the cycle name change.

## 3. Errata: printed equals current in three emitted or soon-emitted cards

MarvelCDB carries an `errata` field on exactly three cards in these five packs. All three have `text == real_text`
(the current wording), and the curations have `errata: []`, so the committed `text.printed` equals `text.current`.
That breaks the printed-versus-current rule for these cards.

| Card                        | MarvelCDB `errata`                               | RRG 1.8 (printed page)             | Printed wording (scan)                                                                                          |
| --------------------------- | ------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 40092 Inhibitor Collar      | "Changed reminder text to rules text." (RRG 1.6) | Appendix V, NeXt Evolution (p. 68) | Scan `40092.png` reads "Action: ... discard this card. _(Any player can do this.)_" in italics as reminder text |
| 43036 Front Line Specialist | "Changed hero to identity." (RRG 1.6)            | listed at md line 5132             | not read; the "hero" to "identity" reversal needs the scan                                                      |
| 44041 'Pool-ized            | "Added Attached ally engages its controller."    | Deadpool Hero Pack (p. 68)         | Scan `44041.png` has no "Attached ally engages its controller." sentence                                        |

Each needs an `Errata` entry with `printedReplace` (the shape `core.ts` line ~202 uses). The sources doc table lists
two more NeXt Evolution errata, "Suit Up (#17)" and "Mission Team (#171A)". **Those are not in this cycle.** They are
Age of Apocalypse cards (`aoa` 45017 and 45171a; raw text "can be attached to that ally" and "Mission Team ... Reduce
the cost of the next ally"), filed under a "NeXt Evolution Expansion" heading in the RRG md (lines 5092 and 5096).
Ignore them for wave 7; flag the RRG heading to the sources doc owner and to the `aoa` wave.

## 4. `next_evol` in detail

### 4.1 Raw records by encounter set and card type

216 records, codes 40001 to 40204 (a/b suffixed records for two-sided cards). Pack name "NeXt Evolution", wave 7.

Player side (set code = hero kit or null):

| Set (`card_set_code`) | Records | Codes / content                                                                                                                   |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `cable`               | 16      | hero 40001a (+b Nathan Summers); 40002-40013 (4 event types, 2 support, 5 upgrade, PSS Technovirus Purge 40006); obligation 40031 |
| `cable_nemesis`       | 5       | 40032 Stryfe (minion), 40033 Back to the Future (side scheme), 40034 Telekinetic Force Field, 40035, 40036 (treacheries)          |
| `domino`              | 14      | hero 40037a (+b Neena Thurman); 40038-40049; obligation 40065 Memories of Armageddon                                              |
| `domino_nemesis`      | 5       | 40066 Topaz, 40067 Not My Lucky Day, 40068 Prototype, 40069 Superpower Feedback (x2)                                              |
| null (aspect + basic) | 33      | 40014-40030 Leadership/Aggression/Protection, 40050-40064 Justice/basic, 40204 Hope Summers (basic ally)                          |

Encounter side:

| Set                                       | Records   | Villain / main scheme / other                                                                                                                                                                                                     |
| ----------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marauders`                               | 7         | villains 40070a-40076a (Arclight, Blockbuster, Chimera, Greycrow, Harpoon, Riptide, Vertigo); b sides are nested `linked_card`                                                                                                    |
| `morlock_siege`                           | 17        | main schemes 40077/40077a (Knock, Knock), 40078/40078a (Mutant Massacre); Morlock ally 40079 (x4); 40080 Hide!; environment Routed 40081a; attachments 40082, 40083; side schemes 40084-40087; treacheries 40088, 40089           |
| `military_grade`                          | 4         | 40090-40092 attachments, 40093 The Senator's Support (side scheme)                                                                                                                                                                |
| `mutant_slayers`                          | 9         | minions 40094-40100 (Marauders), side scheme 40101, treachery 40102                                                                                                                                                               |
| `on_the_run`                              | 11        | main schemes 40103/a, 40104/a; Hope's Captor 40105a; 40106, 40107 attachments; 40108, 40109 side schemes; 40110, 40111 treacheries                                                                                                |
| `nasty_boys`                              | 6         | minions 40112-40116, side scheme 40117 Get Nasty                                                                                                                                                                                  |
| `juggernaut`                              | 11        | villain 40118-40120 (I-III, single cards); main scheme 40121/a; Juggernaut's Helmet 40122a; 40123 Head of Steam; side scheme 40124; treacheries 40125-40129                                                                       |
| `hope_summers`                            | 2         | ally 40130, side scheme 40131 Captive Hope                                                                                                                                                                                        |
| `black_tom_cassidy`                       | 4         | minions 40132, 40133 (Creeping Willow x4), side scheme 40134, treachery 40135                                                                                                                                                     |
| `mister_sinister`                         | 20        | villains 40136-40138 (I-III); main schemes 40139 (1), 40140-40142 (three stage 2s), 40143 (3), each with an "a" record; 40144 Sinister Disguise; minion 40145; side scheme 40146; treacheries 40147-40150                         |
| `flight` / `super_strength` / `telepathy` | 4 / 4 / 5 | attachments 40151-40154 (40154 is really a treachery), 40155-40158 (40158 is a treachery), 40159 Telepathy + obligations 40160 Manufactured Drama, 40161 Sowing Discord + treachery 40162                                         |
| `stryfe`                                  | 22        | villains 40163-40165 (I-III); main schemes 40166/a, 40167/a; Stryfe's Grasp 40168a; attachments 40169-40173; minion 40174 Zero; side schemes 40175, 40176; treacheries 40177-40179                                                |
| `extreme_measures`                        | 5         | minions 40180-40183 (Strobe, Tempo, Thumbelina, Wildside), side scheme 40184                                                                                                                                                      |
| `mutant_insurrection`                     | 5         | minions 40185-40188, side scheme 40189                                                                                                                                                                                            |
| `next_evol_campaign`                      | 14        | faction `campaign`, set code `next_evol_campaign`: 40190a-40195a player side schemes (b sides are environments), 40196 Pouches (resource, x4), 40197 Safehouse (support), minions 40198-40201, side scheme 40202, treachery 40203 |

Totals by raw type: heroes 2, aspect/basic ally 14 (+2 encounter allies), player side schemes 18 raw (12 hero/aspect/
basic plus the 6 campaign ones), villains 13 (7 Marauders + 6 staged), main scheme records 38 (stage records plus
a-records).

### 4.2 Heroes and card ranges

- **Cable (40001a/b, Nathan Summers).** Signature 40002-40013 (cards 2 to 13) plus Technovirus Purge 40006 (a
  `player_side_scheme`). Obligation 40031 Technovirus Resurgence (Give to the Nathan Summers player; attaches to
  Technovirus Purge). Nemesis set `cable_nemesis` 40032-40036 (matches the rulebook p. 22 nemesis list). Alter-ego
  text: "You may include player side schemes from any aspect"; raw `deck_options: [{type: ["player_side_scheme"]}]`
  on 40001a. Hero 12 HP, 2/2/2; alter-ego hand size 5, per scan.
- **Domino (40037a/b, Neena Thurman).** Signature 40038-40049 (12 cards); obligation 40065; nemesis 40066-40069.
  Hero 9 HP, THW 1 / ATK 2 / DEF 3.
- Aspect cards 40014-40023 Leadership (Caliban 40014, Fantomex 40015, Sunspot 40016, Mission Planning 40017, Call for
  Backup 40018 [PSS], E.V.A. 40021, Uncanny X-Force 40022, Mission Leader 40023), Aggression Lock and Load 40019
  (PSS), Protection Establish Perimeter 40020 (PSS), Justice 40050-40055, basic 40024-40030 and 40056-40064.
  Raw type for the Cable cards 40014-40016 and 40050-40051 allies: faction codes are the aspects.
- `duplicate_of_code` (reprints of earlier prints): 40030 Sidearm (23035), 40052 Even the Odds (30014), 40055
  Overwatch (30019), 40061-40063 Energy/Genius/Strength (01088-01090). 40061-40063 have no scan and no `imagesrc`; the
  reprint path (as `x23` 43022-43024) covers them, confirm at emit.

### 4.3 The five scenarios (rulebook `mc40_next_evolution.md`, pages 9-20)

"Required" below means the box lists the set in the scenario's Encounter Deck line and says it cannot be removed.
All five use Core's Standard set (and Expert set in expert mode).

| #   | Scenario (our id)                   | Villain deck (standard / expert)                              | Main scheme deck                                                                                                 | Own + required sets                                                                       | Recommended / modular                                            | Set aside at setup                                                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Morlock Siege (`morlock-siege`)     | 7 Marauders, A sides / B sides; random order, defeat 3 to win | Knock, Knock (40077); Mutant Massacre (40078)                                                                    | `morlock_siege`                                                                           | `military_grade`, `mutant_slayers` (two modular sets, removable) | Hide! 40080 and the 4 Morlocks 40079; Routed 40081 into play                                                                    |
| 2   | On the Run (`on-the-run`)           | one random Marauder (A / B)                                   | Gotta Get Away (40103); Escaping with Hope (40104)                                                               | `on_the_run`, `mutant_slayers` (required)                                                 | `military_grade`, `nasty_boys`                                   | Hope's Captor 40105a attached to the villain, Confident side up; the villain's same-title minion and the other villains removed |
| 3   | Juggernaut (`juggernaut`)           | Juggernaut I, II / II, III                                    | The Unstoppable Juggernaut (40121)                                                                               | `juggernaut`, `hope_summers` (required)                                                   | `black_tom_cassidy` (required in campaign mode only)             | Juggernaut's Helmet 40122a attached; Hope Summers into play under the first player                                              |
| 4   | Mister Sinister (`mister-sinister`) | Mister Sinister I, II / II, III                               | Sinister Intent (40139); Sinister Experiments 40140, 40141, 40142 (one removed at random); Sinister Ends (40143) | `mister_sinister`, `hope_summers`, `flight`, `super_strength`, `telepathy` (all required) | `nasty_boys`                                                     | `flight`, `super_strength`, `telepathy` sets set aside; Hope Summers into play                                                  |
| 5   | Stryfe (`stryfe`)                   | Stryfe I, II / II, III                                        | Uncontrollable Power (40166); Left to Your Fate (40167)                                                          | `stryfe`, `hope_summers` (required)                                                       | `extreme_measures`, `mutant_insurrection`                        | Stryfe's Grasp 40168a revealed; Hope Summers into play                                                                          |

Scenario shape notes for the curation (shapes that already exist in `curation/types.ts`):

- Scenarios 1 and 2 are the Kang / Mansion Attack shape: seven one-card villains sharing `card_set_code: marauders`.
  `villainCardCode: "40070a"` with `setAsideVillainCardCodes` for the other six, `expertVillains` for the b sides,
  `startingVillain: "random"` (used by `mut_gen` Mansion Attack). Scenario 1 wins by three villains under Routed (a
  card ability: `victory: "cardAbility"`); scenario 2 by defeating the villain twice (Hope's Captor flips and resets
  its HP). Both are book rules in main scheme and attachment text, not scenario data.
- Hope Summers (`hope_summers`) is `extraModular: true` (field exists): "can be used with any scenario but does not
  count toward the number of modular encounter sets" (MC40 p. 5), and the ally 40130 is "not a basic card".
- Flight, Super Strength, Telepathy are required in scenario 4 but "may be used in other scenarios", so they are
  ordinary modular sets that scenario 4 lists in `additionalEncounterSetCodes`. Check `setAsideCardCodes` /
  `separateGameAreas` for the set-aside part; "the setup keyword is ignored in this scenario" (MC40 p. 16) is
  engine/scripting text, not data.
- Standard villain stages: Marauders `[1,1]` both modes; staged villains `[1,2]` standard, `[2,3]` expert (as
  `mut_gen`).
- Expert main scheme B sides exist for every a-record (the Marauders contents text says "side B for expert mode").
- Sinister Experiments need a main scheme "random stage 2" setup: Sinister Intent 40139 advances to a random stage
  2A; check `normalize/main-schemes.ts` for a stage chain where stage 2 has three alternatives (Tower Defense / sm
  Sinister Six precedent; may need a new `MainSchemeStage` alternative field - section 6).

### 4.4 Modular sets

Seven box modular sets: `military_grade`, `mutant_slayers`, `nasty_boys`, `black_tom_cassidy`, `extreme_measures`,
`mutant_insurrection` (ordinary), `hope_summers` (extra). Plus the three sub-sets of scenario 4 (`flight`,
`super_strength`, `telepathy`). `telepathy` carries two scenario obligations, 40160 and 40161.

**Obligation `encounterSetIds`:** the wave 6 fix (`normalize/encounter-cards.ts`, comment above `encounterSetIds`)
empties it only when the obligation's set is a hero kit. So 40031 and 40065 (sets `cable`, `domino`) come out `[]` and
40160/40161 (set `telepathy`) come out `[telepathy]`, correct without further work. Confirm after emit.

### 4.5 Campaign cards

Rulebook p. 6 says "cards 190-203 are campaign-specific"; the same page says cards 196 "BASIC / CAMPAIGN (7/17)".
Raw has faction `campaign` and set `next_evol_campaign` for 14 records (40190a-40203) and the basic ally 40204 Hope
Summers is **prohibited** in the campaign.

| Card         | What                                        | Campaign log pairing                         |
| ------------ | ------------------------------------------- | -------------------------------------------- |
| 40190a/b     | Assemble the Team / Team Assembled          | encounter card Malice 40199                  |
| 40191a/b     | Establish Safehouse / Safehouse Established | Vanisher 40201                               |
| 40192a/b     | Gear Up / Geared Up                         | Overburdened 40203                           |
| 40193a/b     | Mission Prep / Mission Prepped              | Scrambler 40200                              |
| 40194a/b     | Practice Maneuvers / Practiced Maneuvers    | Lady Mastermind 40198                        |
| 40195a/b     | Prepare Defenses / Prepared Defenses        | Under Pressure 40202                         |
| 40196, 40197 | Pouches (resource, x4), Safehouse (support) | rewards of Geared Up / Safehouse Established |

The a sides are player side schemes (4 starting threat per hero by the rulebook callout, "4 [per_hero]"; the raw has
`base_threat: 4`, no per-hero flag - verify against `40190a.png`); the b sides are campaign environments. The b side
of each is only in the nested `linked_card`. Existing `mut_gen` pattern (32171a side scheme with `otherFaceId` to a
support) covers the two-type flip. Rulebook campaign mechanics for `NEXT_EVOL_CAMPAIGN` (hand-authored
`campaign.ts`, `handAuthoredModules: ["campaign"]`): persistent-damage expert rules, the log (Marauders Defeated,
Hope Summers's damage in scenarios 3 and 4, Morlocks Saved, six side scheme rows with Scenario Chosen and Earned),
prohibited card 40204. Log sheet: `docs/campaign-modes/log-sheets/mc40_next_evolution_campaign_log-compressed.pdf`.
Mojo's and `mut_gen`'s `campaign.ts` are the models.

### 4.6 Suspect or missing MarvelCDB text (card codes)

Missing text (scan needed or by design empty):

- 40140a, 40141a, 40142a, 40167a: the a record has no `text` (the stage text sits on the unsuffixed record). Normal for
  this raw shape, not a gap.
- 40196 Pouches: no text, by design (resource only).
- 40139b: threat values absent (section 4.8).

Wrong text (confirmed or very likely typos; each needs a `textReplace` correction citing the scan):

| Code(s)                    | MarvelCDB text                         | Likely print                                    | Status                                                                                                                                         |
| -------------------------- | -------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 40170, 40171, 40172, 40173 | "Attach to your identify."             | "Attach to your identity."                      | **scan 40170 read: prints "identity"**; parser rejects the typo today (the four "unrecognized attach rule" lines)                              |
| 40144, 40145               | "Minister Sinister"                    | "Mister Sinister"                               | typo; **not caught by the survey**: 40144's attach host parses as a named card "Minister Sinister" that never matches. Verify and correct both |
| 40121, 40121a              | back text "Home Summers"               | "Hope Summers"                                  | typo in the Setup sentence                                                                                                                     |
| 40188                      | "After Samarai attacks"                | "Samurai"                                       | typo (card is Samurai)                                                                                                                         |
| 40130                      | "Hope Summer's base THW and base ATK"  | rulebook p. 5 prints "Hope Summers's"           | verify; apostrophe error                                                                                                                       |
| 40037a                     | "count each printed [wild] icon twice" | printed physical icon                           | **scan 40037a and rulebook p. 2/21 show the physical icon**; MarvelCDB says wild. Real data error; changes Domino's behavior                   |
| 41008 (psylocke)           | "Exhaust Training Regiment"            | "Training Regimen" (card title)                 | typo in the pack already emitted (committed `printed` carries it)                                                                              |
| 40154 High Ground          | type `attachment`                      | **treachery** (scan 40154.png prints TREACHERY) | type error; no `Correction` field for card type (section 6)                                                                                    |
| 40092 Inhibitor Collar     | `attack: -1`                           | scan: red "-1 ATK" stat badge                   | the survey says "needs a cardNotes entry"; it is the attachment stat box, so `Correction.attack: -1` fits                                      |

Unchecked, worth a pass at emit: 40113 Hairbag has an `<hr />` mid-text (keyword line above, Surge, then text); 40133
Creeping Willow, 40174 Zero, 40199 Malice (RRG FAQ p. 56 rules on her attached state).

### 4.7 Double-sided and multi-face cards

- Hero / alter-ego pairs: 40001a/b, 40037a/b (the b records are nested).
- Marauder villains 40070a-40076a: A (standard) and B (expert) sides of one card. 7 cards.
- Main scheme stages with an a record and a nested b record: 40077, 40078, 40103, 40104, 40121, 40139-40143, 40166, 40167. Each stage is two raw records (e.g. 40077 + 40077a/b); only the `...b` side carries the threat numbers.
- Two-state encounter cards: 40081a/b Routed (Standard Mode Only / Expert Mode Only), 40105a/b Hope's Captor (Confident
  / Desperate), 40122a/b Juggernaut's Helmet / Juggernaut Exposed, 40168a/b Stryfe's Grasp / Living Bomb (side scheme
  to side scheme, threat 4 fixed and 3), 40190a-40195a / b (side scheme to environment).
- Staged villains without a/b: Juggernaut, Mister Sinister, Stryfe I-III (40118-40120, 40136-40138, 40163-40165), one
  record per stage.

### 4.8 What `survey.ts --pack next_evol` reports today

40 lines under the bare curation (216 cards). By cause:

| Lines | Codes                                                                            | What it needs                                                                                                                                                                                                                                                                                  |
| ----- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | 40139b                                                                           | Sinister Intent 1B: missing starting threat, target threat, acceleration. Dashed on the card (as `mut_gen` 32125b): `dashedThreatFields: ["startingThreat","targetThreat","acceleration"]`, confirm on `40139b.png`                                                                            |
| 1     | 40034 Telekinetic Force Field                                                    | "Attach to Stryfe. Otherwise, attach to the villain." rejected: "Stryfe" is not this set's villain. Host is the named card Stryfe (the nemesis minion 40032, or the villain in scenario 5) with villain fallback: `ifAble` of `namedCard` and `villain`; a parser or `impliedAttachHost` entry |
| 3     | 40107 Favored Weapon (+ "without an attach rule" and "never turned into a card") | fallback "the [MARAUDER] enemy with the lowest ATK" does not parse: needs a superlative host with a trait filter (pool `enemy`, measure `atk`, trait MARAUDER). Schema already has `namedCard` OR inside `ifAble` (wave2-later-packs test names this card)                                     |
| 2     | 40105a, 40105b Hope's Captor (a/b attachment)                                    | attached by main scheme 40103's Setup, no "attach to": `impliedAttachHost: "mainScheme"`-style host named "the villain", flip pair                                                                                                                                                             |
| 1     | 40122b Juggernaut Exposed                                                        | "attach rule on a attachment" on the flipped face; a flipped-face attachment must not carry its own attach rule                                                                                                                                                                                |
| 2     | 40123 Head of Steam; 40169 Mental Transferal                                     | 40123: attach clause inside When Revealed (`impliedAttachHost` named Juggernaut). 40169: "If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity." conditional host - new shape                                                                              |
| 2     | 40154 High Ground                                                                | really a treachery (type override)                                                                                                                                                                                                                                                             |
| 8     | 40170-40173 (2 lines each)                                                       | "identify" typo correction fixes both lines                                                                                                                                                                                                                                                    |
| 6     | 40190a-40195a                                                                    | player side scheme without a cost: `specialCost: "dash"` each, confirm on the scans                                                                                                                                                                                                            |
| 5     | 40079 (cost), 40130 (cost, ATK, THW)                                             | encounter-set allies: dash cost; Hope Summers's ATK/THW are stars (a `cardNotes` entry, like `mut_gen` 32080 Mystique); Morlock 40079 has ATK 1 THW 1 and HP 5                                                                                                                                 |
| 1     | 40092                                                                            | see 4.6                                                                                                                                                                                                                                                                                        |
| 7     | "record never turned into a card" for 40105a/b, 40107, 40123, 40154, 40169-40173 | consequence of the attach errors above; clear when those are fixed                                                                                                                                                                                                                             |

(The listing sums above 40 because some cards raise two lines.) Everything else, including all 13 main scheme pairs
and the 8 hero/aspect kit groups, normalizes on the bare curation.

### 4.9 Scans

`assets/card-art/bundles/cards/`: every raw record and linked b code has a scan except 40061-40063 (reprint basics),
and 40139-40143 unsuffixed (stage records; the `a`/`b` scans 40139a/b ... exist). `imagesrc` is absent on 40070a-76a,
40081a, 40105a, 40122a, 40139-40143(a), 40168a, 40190a-195a (MarvelCDB has the b side only). Local art
(`withLocalArt`) resolves these. Hero art for Cable and Domino is pending (`art/heroes/_pending/` per the handoff).
Scans are gitignored; do not wire them in.

## 5. Per hero pack

### Common to all four

- No precon / starter deck: the curations have `starterDecks: []`. Source them from the Hall of Heroes "Starter Deck"
  link on each release page (not followed in this survey; sources doc owns the URLs), 40 cards, `verified`.
- Cycle name rename.
- Obligations come out `encounterSetIds: []`, correct for hero-kit obligations.
- No separate decks (no Weather / Invocation-style deck), no new card types beyond what the emitted packs already
  carry (`player_side_scheme`, which three of the four already emit).
- Parser warnings: none (zero survey issues for all four).

### `psylocke` (33 cards, 41001a/b to 41033)

- Two-sided hero/alter-ego, and 41002a/b Psi-Knife / Psi-Katana (double-sided permanent upgrade, x2). 41002a has no
  `imagesrc` (local art path, section 2). 41002a carries `specialCost: "dash"` already.
- Ally Domino 41031 (Leadership) and Angel 41003 (hero) name the cycle's other heroes. Obligation 41025 Body Swapped.
- Nemesis: 41026 Chimera (minion), 41027, 41028, 41029 x2. 41027 Interdimensional Plunder side scheme.
- Typo: 41008 "Regiment" (section 4.6).
- Team-Up: Soaring Hearts 41020 (Angel and Psylocke), a basic event.

### `angel` (32 cards from 33 records)

- Three-faced identity: 42001a Angel, 42001b Warren Worthington III, 42001c Archangel (same shape as `ant` / `wsp`).
  Handled; the regen is identical to the committed file for the hero.
- Cards: 42002-42010 signature (Psylocke ally, Aerial events), 42011-42019 aspect, basic 42020-42023, 42029-42032.
- The only regen drift is Elixir 42011 (section 2). Elixir is "X-Force or X-Men" either-trait: needs the either-trait
  play restriction.
- Nemesis: 42025 Harpoon (minion, Brute Marauder; same name as `next_evol` 40098 minion), 42026, 42027 Harpoon's
  Harpoon (attach to Harpoon, search encounter deck and discard), 42028 Spear Shot x2. Obligation 42024.
- Team-Up: Soaring Hearts 42021 (a reprint of 41020; `duplicate_of_code: 41020`).

### `x23` (40 cards)

- Obligation 43028 Self-Isolation (places Honey Badger facedown under it): regen drift (section 2).
- 43002 X-23's Claws is a dash-cost Permanent upgrade (already curated). 43012 Puncture Wound (`attackedThisTurnBy`):
  data only until the engine has per-turn attack history (curation `cardNotes`).
- New content in this pack: Specialization upgrades 43034-43037 with `Linked (Specialized Training)` and a Specialized
  Training player side scheme 43021; Rictor, Shatterstar, Boom Boom allies; "Keep Them Busy" 43018 is a player side
  scheme with Assault. 43019 / 43020 Assault-granting upgrade. 43036 needs an `Errata` entry (section 3).
- Missing scans 43022-43027 are all reprints (`duplicate_of_code`).
- Nemesis 43029-43033 (Lady Deathstrike; Cybermods attach rule parsed as `namedCard`).

### `deadpool` (58 cards)

- Introduces the 'Pool aspect (code `pool`; already in `CoreAspect`, `CHOOSABLE_PRINTED_ASPECTS`, normalizer
  `PRINTABLE_ASPECTS`). 'Pool cards 44013-44030, 44043-44058, basic 44031.
- Second encounter set `dreadpool` (44037-44042, seven cards). `Crisis of Infinite Deadpools` 44037 reveals the
  set-aside Dreadpool minion and Dreadful Deeds and shuffles the rest of the set-aside set into the deck.
  **Inclusion is conditional**: RRG 1.8 FAQ (md line 4680, printed p. 57): only included if at least one player
  chooses 'Pool as a chosen aspect. Neither the card text nor the schema carries this (no field in `EncounterSet`;
  `engine/src/deck.ts` ~line 232 mentions the FAQ). Needs a schema field, section 6.
- Card-surface "Metagame" upgrades: 44053 Blackout (six spaces matching resource types: 2 energy, 2 mental, 2
  physical per the scan), 44057 Tic-Tac-Toe (3x3 grid, energy row, mental row, physical row), 44056 Rock, Paper,
  Scissors (a beats-diagram over energy, mental, physical and wild). 44058 War. The text refers to "spaces above" and
  "the diagram above", so the per-card layout is data the text does not carry (section 6). Scripting notes should
  record the grid, the six spaces and the beats relation, all read from the scans.
- Out-of-game and history rules: 44046 Break Time ("take a group break ... heal 1 damage ... for every minute you were
  away", Alliance), 44028 Git Gud ("if you did not win your previous game of Marvel Champions"). Both need a decision
  from the architect (a prompt with a player-entered number of minutes; a stored last-game result), not data.
- Other unusual: 44055 Laser Swords "Counts as 2 restricted cards" (text only; no Restricted keyword; engine
  restricted counting must read it), 44050 Plot Convenience (cards facedown under it, any player), 44049 Deadpool
  Corps Ship, 44021 "I Got This" (reads crisis, acceleration, amplify, hazard icons in play), 44007 Montage (counts
  acceleration tokens), 44001a (adds an acceleration token when defeated).
- Errata: 44041 'Pool-ized (section 3). Its `superlative`-host parse already works.
- Ruling: Exhausting Personality 44003, June 2, 2026 (any player's hero may be exhausted to pay), in the post-1.7
  rulings file; scripting, not data.
- Team-Up: Frenemies 44031 (Cable and Deadpool; `duplicate_of_code: 40026`).

## 6. Schema and parser gaps

Each with the codes that need it. "Parser" means `parse-text.ts` / normalizer; "curation" means an existing curation
field is enough.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                            | Codes                                                                                            | Fix kind                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | No `Correction` field for a card's type: MarvelCDB types a treachery as attachment                                                                                                                                                                                                                                                                                                                                                             | 40154 (maybe 40158: scan not read, text is a treachery "When Revealed: Discard the upgrade ...") | small `types.ts` + normalizer field                                                   |
| 2   | Attach host "Attach to Stryfe. Otherwise, attach to the villain." (named card, villain fallback)                                                                                                                                                                                                                                                                                                                                               | 40034                                                                                            | parser or `impliedAttachHost` ifAble                                                  |
| 3   | Superlative host with a trait filter ("the [MARAUDER] enemy with the lowest ATK")                                                                                                                                                                                                                                                                                                                                                              | 40107                                                                                            | parser + `SuperlativeHost` trait qualifier                                            |
| 4   | Conditional host: "If Stryfe's Grasp is in play, attach to Hope Summers. Otherwise, attach to your identity."                                                                                                                                                                                                                                                                                                                                  | 40169                                                                                            | new host shape or `ownWhenRevealed`-style                                             |
| 5   | Flipped-face attachments: b face with its own "Attach to Juggernaut." and a/b attachments attached by another card                                                                                                                                                                                                                                                                                                                             | 40105a/b, 40122a/b                                                                               | normalizer: do not require an attach rule on the b face; `impliedAttachHost`          |
| 6   | Attach clause inside When Revealed (Juggernaut)                                                                                                                                                                                                                                                                                                                                                                                                | 40123                                                                                            | `impliedAttachHost` (already exists)                                                  |
| 7   | `OffAspectAllowance.anyTrait` is mandatory; Cable's allowance is by card type only (player side schemes from any aspect)                                                                                                                                                                                                                                                                                                                       | 40001a (also the Cable precon's 40019, 40020, 40018)                                             | schema: make the trait list optional                                                  |
| 8   | Either-trait play restriction "Play only if your identity has the X-Force or X-Men trait"                                                                                                                                                                                                                                                                                                                                                      | 42011                                                                                            | `playRestrictions` trait list (committed value is the bogus trait "X-FORCE OR X-MEN") |
| 9   | Encounter set included only when a player chose 'Pool                                                                                                                                                                                                                                                                                                                                                                                          | `dreadpool` set (44037-44042)                                                                    | `EncounterSet` / `Scenario` field                                                     |
| 10  | Per-card board layout for Metagame upgrades (spaces, grid, beats diagram)                                                                                                                                                                                                                                                                                                                                                                      | 44053, 44056, 44057 (44058 reads the boost area)                                                 | card field or scripting note only                                                     |
| 11  | Main scheme stage with alternatives (three stage-2 Sinister Experiments, one removed at random, with their own sets)                                                                                                                                                                                                                                                                                                                           | 40139-40143                                                                                      | check `MainSchemeStage` / `Scenario` support; may need a field                        |
| 12  | Hero stat stars on an encounter ally (Hope Summers: ATK/THW equal your hero's)                                                                                                                                                                                                                                                                                                                                                                 | 40130                                                                                            | `cardNotes` (precedent 32080)                                                         |
| 13  | Encounter-set allies without a cost                                                                                                                                                                                                                                                                                                                                                                                                            | 40079, 40130                                                                                     | `specialCost: "dash"`                                                                 |
| 14  | Dash cost on player side schemes (campaign set)                                                                                                                                                                                                                                                                                                                                                                                                | 40190a-40195a                                                                                    | `specialCost: "dash"`                                                                 |
| 15  | Attachment stat box ATK -1                                                                                                                                                                                                                                                                                                                                                                                                                     | 40092                                                                                            | `Correction.attack: -1`                                                               |
| 16  | `dashedThreatFields` on a 1B with three dashes                                                                                                                                                                                                                                                                                                                                                                                                 | 40139b                                                                                           | curation (`mut_gen` 32125b precedent)                                                 |
| 17  | Printed-versus-current text for three errata                                                                                                                                                                                                                                                                                                                                                                                                   | 40092, 43036, 44041                                                                              | `Errata` entries                                                                      |
| 18  | Text typos                                                                                                                                                                                                                                                                                                                                                                                                                                     | section 4.6                                                                                      | `textReplace` corrections                                                             |
| 19  | New keywords: none. Assault, Alliance, Requirement, Teamwork, Team-Up, Hinder, Incite, Patrol, Steady, Stalwart, Villainous, Setup, Permanent, Linked are all in `schema/keywords.ts` (`assault` was added for this box). The amplify icon on boost cards and `[per_hero]` costs (Team Investigation 40053, "2[per_hero]") are existing data. Confirm `costPerHero` comes out of the normalizer for 40053 and `healed-per-hero` threat values. | -                                                                                                | verify at emit                                                                        |
| 20  | Campaign: environments carried between scenarios, momentum counters, Hope Summers's damage log, six side scheme rows                                                                                                                                                                                                                                                                                                                           | `NEXT_EVOL_CAMPAIGN`                                                                             | hand-authored `campaign.ts` + architect decision on log fields                        |

Not gaps (confirmed handled): three-face identity (angel), `player_side_scheme` card type, 'pool aspect, per-hero
costs, `extraModular`, `startingVillain: "random"`, `multipleVillains`.

## 7. Team-Up cards in the cycle

Per `docs/team-ups.md` and grep of the raw `Team-Up (` text across the five packs:

| Pair               | Card (ids)                    | Packs                   | Pictures folder  | Needs                                                                                                                   |
| ------------------ | ----------------------------- | ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Angel and Psylocke | Soaring Hearts (41020, 42021) | `psylocke`, `angel`     | `angel-psylocke` | both heroes in the cycle                                                                                                |
| Cable and Deadpool | Frenemies (40026, 44031)      | `next_evol`, `deadpool` | `cable-deadpool` | Cable (box) and Deadpool (pack); the box's basic ally Deadpool 40024 lets a Cable deck meet the "Deadpool in play" half |

`docs/team-ups.md` lists only 44031 for Cable and Deadpool; add 40026 (the box's printing, `44031` is the reprint,
`duplicate_of_code: 40026`). The other three picture folders are not yet in `art/teamups/` (check the folder before
the client step).

## 8. Ordered data steps (one agent each)

Dependencies are in order; steps touching different files can run in parallel, at most three.

1. **Errata and text fixes in the emitted packs (small).** `Errata` entries for 43036 and 44041 (read both scans for
   the printed wording; 40092 is in step 4), `textReplace` for 41008 "Regiment". Files: `curation/x23.ts`,
   `deadpool.ts`, `psylocke.ts`. Do not regenerate yet.
2. **Schema and parser prep for `next_evol`.** Gaps 1, 7, 8 (type override, optional `anyTrait`, either-trait play
   restriction); decide 9 and 11 with `game-rules-architect`. Output: a short decisions list in the wave 7 spec.
3. **Parser attach shapes.** Gaps 2 to 6 (40034, 40107, 40169, 40105, 40122, 40123); extend `parse-text.test.ts`.
4. **`curation/next_evol.ts` pass 1 (cards).** Cycle `{ id: "cycle7", name: "NeXt Evolution", order: 7 }`, pack name,
   release date August 18, 2023 (sources doc), `outDir src/data/next_evol`, `handAuthoredModules: ["campaign"]`; every
   correction in 4.6 and 4.8 (typos with scan evidence, 40037a physical icon, 40092 `attack: -1` plus errata,
   `dashedThreatFields` for 40139b, dash costs for 40079, 40130, 40190a-40195a, `cardNotes` for 40130,
   `identityDeckbuilding` for Cable 40001a, off-aspect codes). Register in `ingest-marvelcdb.ts` and `survey.ts`. Done
   when `survey.ts --pack next_evol` is clean.
5. **`next_evol` scenarios.** Five `Scenario` records per 4.3, verified against MC40 pp. 9-18; Marauders random-villain
   shape, `extraModular` Hope Summers, set-aside cards.
6. **`next_evol` starter decks.** Cable / Leadership and Domino / Justice from MC40 p. 22 (both sum to 40; Cable's deck
   uses off-aspect player side schemes 40019 and 40020, so `offAspectAllowanceCodes`).
7. **Hand-authored `src/data/next_evol/campaign.ts`** (`NEXT_EVOL_CAMPAIGN`: boxCode MC40, five scenario ids, campaign
   sets, prohibited 40204, log sheet reference) and emit `next_evol` (`ingest -- --pack next_evol --offline`). Add the
   `wave7.test.ts` data integrity describe (validateCard over all cards, scenarios, starter decks, campaign).
8. **Hero pack precons** for `psylocke`, `angel`, `x23`, `deadpool` (one agent for two packs each), from the Hall of
   Heroes starter deck pages; fills `starterDecks` in each curation.
9. **`deadpool` extras.** 'Pool conditional set (gap 9) and the Metagame scripting notes for 44053, 44056, 44057 (and
   44058), 44046 Break Time, 44028 Git Gud, 44055 Laser Swords in `scriptingNotes`.
10. **Rename the cycle and regenerate** the four packs (curation `cycle` name; regen with the art symlink/checkout);
    review the Elixir 42011 and Self-Isolation 43028 diffs from section 2 by hand; run `data-only.test.ts` and the
    wave tests.
11. **`WAVE7_*` exports** in `index.ts` (before `PLAYABLE_CARDS`, as waves 5 and 6): `export *` for the five packs,
    `WAVE7_CARDS/_ENCOUNTER_SETS/_SCENARIOS/_STARTER_DECKS`, append to `PLAYABLE_CARDS`, `NEXT_EVOL_CAMPAIGN` to
    `CAMPAIGNS` when the campaign step lands, remove the four from `DATA_ONLY_*`, `data-only.test.ts` PACKS 13 to 9
    with its cycle 7 assertion removed and the "no id collides" list extended, `pool-version`/`catalog-codes` check.
    Update `docs/team-ups.md` (add 40026).
12. **Scripting hand-off notes.** Per-hero plain-language notes in each curation's `scriptingNotes` for the cards named
    in sections 4 and 5 (Cable and Domino kits; Psi-Knife/Katana flips; Angel/Archangel; Honey Badger; Deadpool).

## 9. Open questions

- Hall of Heroes starter deck contents for the four packs were not read (sources doc may carry the URLs).
- Whether 40158 "I'll Take That" is also a mis-typed treachery (its text is a pure When Revealed; scan not read).
- Whether the two Domino text differences (40037a wild vs physical) have any other copy elsewhere (the 40037b
  alter-ego text matches its scan).
- Exact emitted card count for `next_evol` (needs the first emit).
- The RRG md heading "NeXt Evolution Expansion" over Suit Up and Mission Team is an RRG labeling error for Age of
  Apocalypse cards (45017, 45171a); worth telling the sources doc owner.
