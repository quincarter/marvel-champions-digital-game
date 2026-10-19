# Phase 7 working spec: Synthezoid Smackdown (MC57, cycle 10), delivered in the wave 11 PR

This is the shared brief for every agent adding the Synthezoid Smackdown scenario pack (`synthezoid`, MC57). The model
is `docs/phase7-wave10.md` and its section numbers are kept (§0 sources, §1 schema, §2 setup, §3 primitives, §4
rulings and questions, §5 other agents, §6 later passes, §7 card tables, §8 build order). Wave 1 to 11 §3 primitives
are assumed. The definition of done is `docs/wave-definition-of-done.md`. The data survey is
[phase7-synthezoid-survey.md](phase7-synthezoid-survey.md) (what is in the pack, what the raw cache lacks, how Civil War
models the same mechanics). If you change a decision here, update this file in the same change. Agents do not edit
statuses or open questions; they report, and the main session flips them.

**Owner decision (2026-10-19):** Synthezoid Smackdown ships in the wave 11 PR (#251), **placed chronologically after
the Civil War products and before Wonder Man**, never grouped with Fear No Evil in progression, release order, the
playable pool's cycle, menus or campaign placement. This replaces the owner's 2026-10-11 answer 2A (a separate PR;
`docs/phase7-wave10.md` §4.1 Q2, `docs/phase7-wave10-sources.md` Q1). The main session edits those two lines; this file
does not.

**What the pack is.** A scenario pack of 81 raw records and no heroes: two leaders (She-Hulk for registration, Vision
for resistance, four stages each), four main scheme stages, ten encounter sets (two leader sets of 10 cards, eight
modular sets of 5), eight competitive-only leader player cards and a reprinted Standard PvP set. It continues Civil War:
MC56 p. 17 and MC57's last page point at each other.

| Pass  | Scope                                                                                                   | State       |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------- |
| **1** | **All of the pack's cooperative content: data, two scenarios, the 18 modular and leader sets' scripts** | **written** |
| 2     | The eight leader player cards and the PvP copies (§6): data now, scripts when competitive mode ships    | placeholder |

- **Data state (read 2026-10-18, branch `feature/wave-11`):** `synthezoid` is raw cache only
  (`packages/content/raw/marvelcdb/synthezoid.json`, fetched 2026-09-13); there is no `src/data/synthezoid` and no
  curation file. Another agent is editing the `fne` curation and data now; this spec touches none of it.

## 0. Sources

- **RRG 1.8**, `mc_rulesreference_v18_compressed.md` (pages from the footer markers): Amplify Icon p. 7, Attach To p. 8,
  Crisis Icon p. 14, Find p. 19, Flip p. 20, Labeled Ability p. 26, Overkill p. 31, Patrol p. 32, Stalwart p. 40, Star Icon
  p. 40, Steady p. 41, Villainous p. 47, Appendix VI p. 71. The page numbers other than p. 70 are copied from the earlier
  wave specs and not re-read here; **checked this session:** Appendix V,
  "Synthezoid Smackdown Scenario Pack" on p. 70, lines 5182 to 5190.
- **Errata (current text, printed text kept):**
  - **Moon Knight #65 (57065):** "When Revealed: Resolve the 'When Revealed' ability of the topmost treachery in the
    encounter discard pile. (Limit once per phase.)" Added "(Limit once per phase.)".
  - **Phased Out #76 (57076):** "Action: Choose an attachment on the enemy leader with the text 'Hero Action' or 'Hero
    Response' and discard it." Changed "Hero Interrupt" to "Hero Action". Card is competitive only.
- **FFG rulings after 1.8** (`marvel-champions-rulings-post-rrg-1-7.md`): **March 19, 2026, Ruling 1** (Phased Out is
  meant to discard "Hero Action", agreeing with the erratum; checked). January 11, 2026 R1 (no Registration modular set
  with a Resistance leader), the June 2 and July 9, 2026 rulings on "enemy leader" (outside Civil War the enemy leader is
  the villain; July 9 R3, checked at line 1026) and the Civil War leader rulings of wave 10 §3.22. None names another
  Synthezoid card (grep for "Synthezoid" returns only the Phased Out question).
- **The MC57 rulebook** (20 pages), `https://hallofheroeslcg.com/wp-content/uploads/2025/12/mc57_rulebook-web.pdf`,
  read this session by text extraction. **It is not in the repo**; D0 below adds it as
  `docs/campaign-modes/mc57_rulebook-web.pdf` (its page numbers are printed pages). Used for: content p. 3, cooperative
  clarifications p. 4, the two preconstructed scenarios pp. 6 and 7, featured keywords p. 8 (Hinder, Incite, Patrol,
  Permanent, Piercing, Stalwart, Villainous, Amplify; no new keywords), competitive setup and play pp. 9 to 17, FAQ
  p. 18. It is FFG's product rules text: it governs where RRG 1.8 is silent and yields where they conflict.
- **MC56** (`docs/campaign-modes/markdown/mc56_civil_war.md`): the custom scenario steps and "Further customization"
  (pp. 4 to 5), co-op clarifications p. 6, FAQ p. 20.
- **Scans** (`assets/card-art/bundles/cards/`, gitignored, read directly): 57012, 57016, 57054, 56128a (survey §4).
- **Repo evidence for chronology:** §1 lists every file.

## 1. Chronology and schema decisions

### 1.1 Where it sits

Release order across the product line, with the codes that already exist in the repo:

| Order | Product                  | Code         | Released (source)                                                                                          | `cycleId` / `order` | Today's export |
| ----- | ------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------- | ------------------- | -------------- |
| 1     | Civil War                | `cw`         | 2025-10-17 (`data/cw/packs.ts`)                                                                            | `cycle10` / 10      | `WAVE10_*`     |
| **2** | **Synthezoid Smackdown** | `synthezoid` | **2025-12-05, unchecked** (HoH: "December, 2025"; US date from FFG and Asmodee; select markets 2025-11-21) | **`cycle10` / 10**  | **none yet**   |
| 3     | Wonder Man (MC58)        | `wonder_man` | 2026-02-20 (`data/wonder_man/packs.ts`)                                                                    | `cycle10` / 10      | `WAVE10_*`     |
| 4     | Hercules (MC59)          | `hercules`   | 2026-02-20 (`data/hercules/packs.ts`)                                                                      | `cycle10` / 10      | `WAVE10_*`     |
| 5     | Fear No Evil (MC60)      | `fne`        | 2026-07-24 (`data/fne/packs.ts`)                                                                           | `cycle11` / 11      | `WAVE11_*`     |

- **Cycle.** Hall of Heroes' own navigation names the Civil War cycle "Cycle 10 Civil War" and lists the scenario pack
  between Civil War and Wonder Man (`hallofheroes-llms.txt` lines 28, 119, 136, 150). The data model has no cycle
  between 10 and 11, so the pack joins `cycleId("cycle10")` (`name: "Civil War"`, `order: 10`) exactly as `wonder_man`
  and `hercules` do. A `cycle11` pack would put it after Hercules in every ordering, which is what the owner forbids.
- **Order inside the cycle** is the pack's `releaseDate`, as every ordering that reads `Cycle.order` already breaks ties
  (`view/roster-shelves.ts` lines 145 to 181: "Inside a shelf, packs sort by `releaseDate`"). Release dates alone place
  the pack between Civil War and Wonder Man. The array order below must agree, because several places read an array and
  not the date.
- **Wave naming.** "Wave" in this repo is a delivery batch and a pool constant; the cycle is the chronology. This pack
  is wave 11's delivery and cycle 10's content. The exports follow the cycle (§1.2); only the PR, the changie fragments
  and the handoff section follow the wave.

### 1.2 The exact fields and files that encode chronology

Each line says what to write. "Today" is what the repo has (read this session).

1. **`packages/content/scripts/marvelcdb/curation/synthezoid.ts`** (new): `SYNTHEZOID_CURATION: PackCuration` with
   `packCode: "synthezoid"`, `cycle: { id: "cycle10", name: "Civil War", order: 10 }`, `pack: { name: "Synthezoid
   Smackdown", releaseDate: "2025-12-05", releaseDateSource }` (the source line states the Hall of Heroes month, the FFG
   and Asmodee dates and the November 21 market date, as `curation/cw.ts` does for its date), `outDir:
   "src/data/synthezoid"`, `exportPrefix: "SYNTHEZOID"`.
2. **`packages/content/scripts/ingest-marvelcdb.ts`** (import at line 83 and map at lines 154 to 167) and
   **`packages/content/scripts/marvelcdb/survey.ts`** (import at line 78 and map at lines 145 to 150): register
   `synthezoid`. Today neither lists it.
3. **`packages/content/src/data/synthezoid/packs.ts`** (generated): `SYNTHEZOID_CYCLE` and `SYNTHEZOID_PACK` (the same
   shape as `CW_CYCLE`, `CW_PACK`).
4. **`packages/content/src/data/index.ts`** (lines 756 to 800, the "Wave 10" block): `export * from
   "./synthezoid/index.js"`; import `SYNTHEZOID_CARDS`, `SYNTHEZOID_ENCOUNTER_SETS`, `SYNTHEZOID_SCENARIOS`; then
   - `WAVE10_CARDS = [...CORE_CARDS, ...CW_CARDS, ...SYNTHEZOID_CARDS, ...WONDER_MAN_CARDS, ...HERCULES_CARDS]`;
   - `WAVE10_ENCOUNTER_SETS = [...CW_ENCOUNTER_SETS, ...SYNTHEZOID_ENCOUNTER_SETS, ...WONDER_MAN_ENCOUNTER_SETS,
     ...HERCULES_ENCOUNTER_SETS]`;
   - `WAVE10_SCENARIOS = [...CW_SCENARIOS, ...SYNTHEZOID_SCENARIOS]`;
   - `WAVE10_STARTER_DECKS` unchanged (the pack has no hero);
   - the block's comment and the `DATA_ONLY_CARDS` comment (line 917) name the pack and say why it is in the wave 10
     arrays: `PLAYABLE_CARDS` concatenates `WAVE10_CARDS.slice(CORE_CARDS.length)` before `WAVE11_*`, so that is the only
     position that puts the pack after Civil War and before Wonder Man in the pool order. **`WAVE11_*` is not touched.**
5. **`packages/cards/src/modular-pool.ts`** (line 66 to 67 lists `WAVE10_ENCOUNTER_SETS`, line 147 lists
   `WAVE10_SCENARIOS`) and **`packages/cards/src/playable/index.ts`** (lines 202 and 264 to 267, `isWave10Scenario`
   reads `WAVE10_SCENARIOS`): no edit; they follow the arrays. A test proves it (§8.6).
6. **`packages/cards/src/playable/scenario-options.ts`**: `civilWarSidesOffer` (lines 262 to 273) lists a side's leaders
   by `WAVE10_SCENARIOS.filter(side)` order, so She-Hulk follows Captain Marvel and Vision follows Spider-Woman;
   `civilWarModularSets` (lines 280 to 320) lists sided sets in `WAVE10_ENCOUNTER_SETS` order after Civil War's. No edit.
7. **`packages/client/src/content/pool.ts`**: import `SYNTHEZOID_CYCLE`, `SYNTHEZOID_PACK`; add `SYNTHEZOID_PACK` to the
   `POOL_PACKS` array **between `CW_PACK` and `WONDER_MAN_PACK`** (lines 340 to 342), and `[SYNTHEZOID_PACK,
   SYNTHEZOID_CYCLE]` to `POOL_PACK_CYCLES` between `[CW_PACK, CW_CYCLE]` and `[WONDER_MAN_PACK, WONDER_MAN_CYCLE]`
   (lines 412 to 414). This one is not optional: `scenarioCycleOf` (`progression/unlocks.ts` line 362) reads
   `POOL_HERO_SHELF_PACKS`, which is derived from `POOL_PACK_CYCLES`, so a pack missing there has **no cycle and its
   scenarios fall outside the wave lock**. `POOL_ENCOUNTER_SETS` (line 204) filters `WAVE10_ENCOUNTER_SETS` and follows.
8. **`packages/client/src/progression/unlocks.ts`** (lines 226 to 237, the `cycle10` row): no new row and no new hero
   reward. The pack's two scenarios open with the Civil War row's gate (`campaignWin: aos`), through `scenarioCycleOf`.
   Doc comment names the pack. `docs/progression.md` line 37 gets a clause.
9. **`packages/client/src/view/new-in-box-model.ts`** (`BOXES`, line 51): no new row; the pack's entries land on the
   Civil War page (`unlockKey: "cycle10"`). Entries introduced here carry an `introducedIn` tag that says "Synthezoid
   Smackdown" so they read as added after the box (§5.5).
10. **`packages/content/src/data/pool-version.ts`**: the pool version is a hash of the data, so it moves by itself;
    `POOL_VERSION` is bumped once for the PR's whole content (definition of done §5), not by this task.
11. **Docs:** `PLAN.md` (the Wave 10 and Wave 11 lines, 658) and `docs/phase7-wave10-sources.md` §1 "Order" say the
    pack is cycle 10, between the two; `docs/phase7-wave11-handoff.md` line 45 drops "its own PR" (and
    `docs/phase7-wave10-handoff.md`, if it carries the same words; a grep for "Synthezoid" there found none). The main
    session edits them.

Nothing else reads the release order found this session: the campaign list (`CAMPAIGNS`, `data/index.ts` line 893) never
gets a record (the pack has no campaign, the same as MC56; the comment above it, line 885, says so for Civil War), and the
unlock gate list stays one row.

### 1.3 Sides on the new encounter sets

`EncounterSet.side` (wave 10 §1.3), curated per set in `curation/synthezoid.ts` `encounterSets` with the `sided(...)`
helper `curation/cw.ts` uses. The side is the leader's (MC57 p. 3 colors; MC57 pp. 6 and 7):

- registration: `she_hulk_leader`, `synthezoid_registration`, `shield_ops`, `thunderbolts_modular`, `taskmaster_modular`,
  `deadly_duo`, and the PvP copy of §1.6;
- resistance: `vision_leader`, `synthezoid_resistance`, `young_avengers`, `scarlet_twins`, `moon_knight_modular`,
  `royal_guard`, and its PvP copy.

Because the side rule is data-driven (`modularPickProblem`, `scenario.side` against `set.side`), the eight new sets are
at once legal at Iron Man and Captain Marvel (registration) or Captain America and Spider-Woman (resistance), and Civil
War's sixteen are legal at She-Hulk and Vision. MC57 p. 6 and p. 7: "The ... sets can be removed from this scenario
and/or added to other scenarios when using the scenario customization rules." Nothing to ask.

### 1.4 Scenario records: two, ids by the convention

`registration-she-hulk` and `resistance-vision` (the `registration-iron-man` and `resistance-captain-america`
convention, wave 10 §1.4). `ScenarioCuration` fields (`curation/types.ts` lines 389 to 429; `fiveCardScenario` in
`curation/cw.ts` is the helper to copy):

| Field                             | She-Hulk                                                                           | Vision                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `villainSetCode`                  | `she_hulk_leader` (leader card 57001, four stages)                                 | `vision_leader` (57040, four stages)                                            |
| `mainSchemeSetCode`               | `synthezoid_registration`                                                          | `synthezoid_resistance` (see Q1 for the stage pool)                             |
| `recommendedModularSetCodes`      | the four registration sets of the pack; `modularSetCount: 4`, `{ min: 3, max: 4 }` | the four resistance sets of the pack                                            |
| `standardSetCodes`                | `["standard"]` (Core's; `expertSetCodes: ["expert"]`)                              | same                                                                            |
| `villainStages`                   | `{ standard: [1, 2], expert: [3, 4] }` (MC57 pp. 6 and 7)                          | same                                                                            |
| `side`                            | `"registration"`                                                                   | `"resistance"`                                                                  |
| `recommendedMainSchemeStageCodes` | `["57005b", "57006b"]` (Enforce the Law, Mighty Avengers; MC57 p. 6)               | `["57044b", "57045b"]` (Protect Secret Identities, Expose Overreach; MC57 p. 7) |

The packCode of both records is `synthezoid` (`scenarioCycleOf` reads it, §1.2 item 7). The leader's side scheme is
found by the stage 1A Setup, like Civil War's (wave 10 §1.5): She-Hulk's is Legal Practice 57012, Vision's is Just
Passing Through 57054; neither is a `signatureSideSchemeCardId`.

### 1.5 Main schemes

The four A faces (57005a, 57006a, 57044a, 57045a) repeat Civil War's A faces word for word, and the four B faces repeat
the text of four Civil War stages of the other side (survey §2). They are emitted as the pack's own two
`MainSchemeCard`s, `synthezoid_registration` and `synthezoid_resistance`, each with two stages (one number 1, one number 2) and `printedCardId` on each stage (the B face's code), as wave 10 §1.2 asks for Civil War's. They are not merged into
Civil War's cards: a pack's data never edits an earlier pack's generated file, and the cross-pack stage pool is built
from `EncounterSet.side` at read time (§3 M1, Q1).

### 1.6 The reprinted Standard PvP set

57036 to 57039a/b and 57078 to 57081a/b are the Civil War cards printed again, with `duplicate_of_code` naming
56125 to 56128a and 56203 to 56206a (checked). Decision: emit them as cards of their own with
`CardProvenance.duplicateOfCardId` (what the normalizer does with every reprint, `raw-types.ts` lines 38 to 43), through
`setRecodes` into two side-tagged `competitiveOnly` sets: `standard_pvp_registration_mc57` (57036 to 57039a) and
`standard_pvp_resistance_mc57` (57078 to 57081a), named "Standard PvP (Registration, Synthezoid Smackdown)" and the
resistance twin. Why not drop them: no record is dropped silently, a MarvelCDB decklist or a printed-collector-number
lookup that names 570xx must resolve, and the cost is eight inert cards. Why separate sets: `modularPickProblem` and
the engine key sets by id, and one id cannot be two sides. Choosing Sides takes **4 per player** starting threat from
56128a (scan read this session; survey §4), with `otherFaceId` to Now It's Personal. Scripted once (wave 10 §1.8: one
module, both ids registered).

### 1.7 Corrections the data agent owes for this pack

Listed in §8.1 D3: the two errata (§0), the starting threat of Choosing Sides, "Mass form." not read as the identity-form
keyword, the implied attach host of Dense, the side field, the two scenario records and the PvP recode.

## 2. Per-scenario setup needs

MC57 pp. 3 to 4 and 6 to 7; cooperative play only (competitive mode is not built; `createGame` refuses it,
wave 10 §1.9).

### 2.1 She-Hulk (registration; 57001 to 57004, set 57007 to 57012)

- I: 1 SCH, 2 ATK, 16 per player. II: Steady, 1/3, 20. III: 1/3, 20. IV: Steady, 2/3, 24.
- I and III "Setup: The enemy team finds a copy of Superhuman Strength and attaches it to She-Hulk." Two copies exist;
  "a copy" leaves the choice to the enemy team (identical cards, so no real choice). II and IV: "Deal each player an
  encounter card. She-Hulk cannot take damage this phase."
- Every stage: "Forced Response: After an alter-ego changes to hero form, deal 1 damage to that hero."
- Set: Superhuman Strength x2, Focused Rage x2, One-Two Punch x2, Ground Stomp x2, Gamma Slam, Legal Practice.
- Encounter deck (MC57 p. 6): She-Hulk's set, S.H.I.E.L.D. Ops, Thunderbolts, Taskmaster, Deadly Duo, Standard
  (expert adds the Expert set, RRG "Expert Set", p. 19). Main scheme deck: Enforce the Law (1B) on Mighty Avengers (2B).

### 2.2 Vision (resistance; 57040 to 57043, set 57046a to 57054)

- I: 1 SCH, 1 ATK, 14 per player. II: Steady, 1/2, 18. III: 1/2, 18. IV: Steady, 2/2, 22.
- I and III "Setup: The enemy team finds Vision's mass form attachment and attaches it to Vision, Dense side faceup."
  Every stage: "Forced Response: After resolving step 1 of the villain phase, flip Vision's mass form attachment." II and
  IV: "Deal each player an encounter card. Vision cannot take damage this phase."
- Dense (57046a, ATK 1) and Intangible (57046b, SCH 1) are one permanent double-sided card. Setup attaches it at stage I
  (standard) or III (expert), the stages a game starts on; it stays when II or IV reveals.
- Encounter deck (MC57 p. 7): Vision's set, Young Avengers, Scarlet Twins, Moon Knight, Royal Guard, Standard. Main scheme
  deck: Protect Secret Identities (1B) on Expose Overreach (2B).

### 2.3 What stages II and IV do mid-game

They reveal during the villain phase when the earlier stage is defeated (wave 10 §3.7, exists-verify); MC57 p. 18's FAQ
(competitive only) describes the same reveal. Verify at the expert leaders in the QA game (§8.6).

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card. Statuses come from searches by name (2026-10-18)
of `packages/engine/src/spec.ts`, `effects.ts`, `select.ts`, `trigger-events.ts`, `keywords.ts`, `resolve/*` and the
content schema; **nothing in this file is started**. Status words are wave 10 §3's: **exists (verify)**, **exists
(compose)**, **extend**, **new**; a **dependency** is work another agent is doing now. The pack needs far less than Civil
War did: the team scaffolding, the unique-rule extension, the leader refs and the hinder condition all shipped in wave 10.

| §   | Primitive                                                                                        | Needed by                                                             | Status                        |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------- |
| M1  | A scenario's stage choices drawn from every main scheme card of its side                         | the two scenario records; Civil War's eight; builder; random creation | **extend** (content, cards)   |
| M2  | "Mass form." is a label, not the identity-form keyword                                           | 57046a, 57046b                                                        | **new** (data)                |
| M3  | Flip a permanent attachment; the current face's printed ATK or SCH and title are read            | 57046a/b, 57047, 57048, 57050, 57052, 57053                           | exists (verify)               |
| M4  | "The Dense / Intangible attachment is in play" by current face                                   | 57049, 57051 to 57053, 57075                                          | exists (verify)               |
| M5  | A response on an encounter attachment with a typed-resource cost and a flip                      | 57047, 57048                                                          | exists (verify)               |
| M6  | Resolve the When Revealed of the topmost treachery of the encounter discard pile, once per phase | 57065 (with the erratum)                                              | exists (verify), maybe extend |
| M7  | Discard from the encounter deck until a treachery, then resolve its When Revealed                | 57068                                                                 | exists (compose)              |
| M8  | The leader activates without a boost card                                                        | 57020                                                                 | exists (verify), maybe extend |
| M9  | "Attach to X. Otherwise, attach to the enemy leader."                                            | 57023, 57024, 57066                                                   | exists (verify), data parse   |
| M10 | An Alter-Ego Response on a side scheme, cost "exhaust your identity"                             | 57012                                                                 | exists (verify)               |
| M11 | A Forced Interrupt when you play a card: cancel its effects, then discard the obligation         | 57063                                                                 | exists (verify)               |
| M12 | Villainous                                                                                       | 57022 Taskmaster                                                      | dependency                    |
| M13 | "If [condition], [X] your leader. Otherwise, [Y]" in a cooperative game                          | 57025                                                                 | exists (verify); B settled    |
| M14 | Choose an attachment by the label of its ability ("Hero Action", "Hero Response")                | 57076 (competitive only)                                              | **new**, deferred             |
| M15 | Reusable as is (checked by name)                                                                 | the rest of §7                                                        | exists (compose)              |

### M1 Stage choices from every main scheme card of the side

- **Text.** MC56 line 428: "Select one of the four main scheme stage 1s from the chosen side. Each stage 1 has the
  same side A and a different side B." MC57 p. 3: "2 Main Schemes: 1 stage 1 and 1 stage 2" per side, whose A faces
  repeat Civil War's. With the pack there are five stage 1s and five stage 2s per side.
- **Today.** `Scenario.mainSchemeCardId` names one card; a custom scenario's options are "every stage of that number
  from `mainSchemeCardId`" (wave 10 §1.4), and `mainSchemeStagesOffer(scenario, wave10MainSchemeCard(scenario))` (cards
  `playable/scenario-options.ts` line 364) reads one card. Civil War's `registration` and `resistance` cards hold eight
  stages each; the pack's cards would hold two.
- **Build (default A of Q1).** A stage offered at a leader is every stage of the leader's side across every
  `MainSchemeCard` whose encounter set has that `side`, in `WAVE10_*` order (Civil War's, then the pack's). The scenario
  record keeps `mainSchemeCardId` as the A face and the recommended stages (§1.4). `MainSchemeState.stageOrder` already
  walks a chosen order through a card (wave 10 §3.2) but is per card; the engine task is the one-card limit: a main
  scheme deck made of stages of several cards of one side, with each stage keyed by `printedCardId`.
- **Tests.** The builder at She-Hulk offers 5 and 5 stages; at Iron Man the same five; a game with Civil War's 1B and
  the pack's 2B starts and advances; a saved choice survives a re-emit (`printedCardId`); the validators refuse a stage of
  the other side.

### M2 "Mass form." is a label

- **Text.** 57046a Dense: "Permanent. Mass form."; 57046b Intangible: "Permanent. Mass form." and a Forced Interrupt.
  57040 and 57042 name it ("Vision's mass form attachment").
- **Problem.** `keywords.ts` line 200 reads a line "X form." as the `form` keyword (`formType: "mass"`) that "grant[s] an
  identity unique forms" (RRG 1.8 "Form, Change Form", p. 21; the hero Vision 26002 and Mutant Genesis 32031a/b use it).
  On these two encounter attachments it grants nothing.
- **Build.** A curation correction that keeps the printed text and tells the parser to emit no `form` keyword for these
  two codes (`ignoreKeywords`, or a typed `label` keyword the engine ignores and queries read; whichever the curation
  types support, D3). "Vision's mass form attachment" is then "the attachment on Vision with the label" (a query the
  scripts compose from `host` and `named`, or the card's two face titles).
- **Test.** Emitting the pack gives 57046a/b no `form` keyword; the hero Vision 26002 still has it; no identity gains an
  extra form from an attached Dense.

### M3 to M5 The flipping attachment (Vision)

- **M3.** `EffectSpec flipCard` with `otherFaceId` exists (cannot-flip, accusation and campaign tests use it). Verify on a
  _permanent_ attachment: the flip keeps its host, its permanence (never defeated, never leaves play, text never blanked;
  MC57 p. 8 "Permanent"), and the stat modifier the new face prints applies to Vision from then on: ATK 1 (Dense) or SCH
  1 (Intangible) at the leader, as an attachment's printed ATK or SCH always does. Verify "flip" is not "turn facedown"
  (RRG 1.8 "Flip", p. 20). Also verify the Forced Response after step 1 reads `villainPhaseBegins`-style step-1 timing as
  Public Outrage 56122b does (`cards/wave10/cw/main-schemes/registration.ts` line 166).
- **M4.** "If the Dense attachment is in play" means the attachment's current face is titled Dense; `faceNamed` exists
  (`spec.ts`). Verify against the flipped card, not the printed back.
- **M5.** Solar Gem: "Hero Response: After you make a basic attack against Vision, spend [energy] [physical] resources
  → discard this card and flip Vision's mass form attachment." Vision's Cape the same with [energy] [mental]. A player
  response on an attachment attached to the leader with a cost of two named resource types (spent from the player's
  resources) is `paidWith` and `spendResources` plus an ability on an encounter card; verify it can be triggered by the
  player. Both cards are unique; Solar Gem prints stalwart (not star), Cape retaliate 1.
- **Settled by the text (no question):** Density Control (57050), "if this activation is a scheme, flip ... to Intangible;
  an attack, to Dense. Then, if Vision's mass form attachment flipped, discard this card": if the attachment is already
  on the named face nothing flips, so the card is not discarded and waits for the next activation. It has surge.

### M6 and M7 Resolving another card's When Revealed

- **M6.** Moon Knight (current text): "Resolve the 'When Revealed' ability of the topmost treachery in the encounter
  discard pile. (Limit once per phase.)" `EffectSpec resolveSpecials` with `which: "whenRevealed"` and its `count` binding
  exist (Teenage Superheroes 57058 and wave 4 Citywide Crisis use the same). Verify: selecting the _top_ treachery of the
  encounter discard pile (the discard order the engine keeps, treacheries only); a treachery with a surge or incite
  keyword does not make Moon Knight's own surge; the limit once per phase per card instance, and that a second
  Moon Knight in play counts separately (a single printed copy exists, unique). With no treachery in the discard pile
  the ability does nothing. Not a reveal: "no When Revealed announced, no surge" (spec.ts line 3180 comment).
- **M7.** Khonshu's Avatar (57068) When Defeated: "Discard cards from the top of the encounter deck until a treachery is
  discarded. Resolve that card's 'When Revealed' ability." `discardEncounterUntil` plus `resolveSpecials`; compose.

### M8 A leader activation with no boost card

- Justice Like Lightning: "Each minion activates against the player it is engaged with. Otherwise, the enemy leader
  activates against you. Do not give it a boost card for this activation." `EffectSpec enemyActivation` exists; the "no
  boost card" option was not found by name (searched `giveBoostCard`, `adjustBoostCount`, `cancelBoostIcons`); it exists
  as `enemyActivates(..., { noBoost: true })` (verified 2026-10-19). "Otherwise" is true when no minion is in play at
  all, as Street Defenders reads the same sentence.

### M9 Attach with a fallback host

- Taskmaster's Sword and Shield: "Attach to Taskmaster. Otherwise, attach to the enemy leader." Crescent Dart: "Attach to
  Moon Knight. Otherwise, attach to the enemy leader." Wave 2's data survey counts an "ifAble attach host" gap that was
  not individually re-checked (`docs/phase7-wave2-data.md` line 311). Verify the parser reads an OR of two hosts with the
  first preferred, and that the engine attaches when the first host is not in play. Mad Jack's Platform ("Attach to a
  minion of the enemy team's choice. Otherwise, this card gains surge.") is the Resistance Fighter 56191 shape and reuses
  its curation. Sword and Shield each carry "Hero Action: Spend [mental] [physical] resources → discard this card" (M5's
  cost shape).

### M10 to M13 Smaller verifications

- **M10.** Legal Practice: "Threat cannot be removed from this scheme by heroes or allies." (`canRemoveThreatFrom` rule on
  a side scheme) and "Alter-Ego Response: After you change form, exhaust your identity → remove 3 threat from this
  scheme." A player's alter-ego response, with an exhaust cost, removing threat that is not a thwart, from a scheme the
  first rule protects against heroes and allies only. Verify both together: the response removes the threat (the
  identity is neither a hero nor an ally), a thwart by a hero cannot.
- **M11.** Spellcasting 57063: "Forced Interrupt: When you play a card, cancel its effects and discard it. Then, discard
  this card." Verify with an event, an ally (put into play, "cancel its effects" against an ally has no effect; the card
  is discarded as the text says) and an upgrade; and that the obligation is then discarded.
- **M12.** Taskmaster (57022): Retaliate 1, Toughness, **Villainous**. RRG 1.8 p. 47 and MC57 p. 8. The engine work is
  `packages/engine/src/resolve/villainous.ts` and `villainous-friendly-character.test.ts`, untracked in the working tree
  now (another agent). The Taskmaster scripting task waits on it landing; it does not write it.
- **M13.** Mimicked Move 57025: "If Taskmaster is in play, he attacks your leader. Otherwise, give the enemy leader a tough
  status card and a facedown boost card." Settled by the rules expert (2026-10-19, was Q2): in a cooperative game "he attacks
  your leader" cannot resolve (MC57 p. 4), so the "Otherwise" sentence resolves even with Taskmaster in play (RRG 1.8
  "Otherwise" p. 31: "an effect that cannot at least partially resolve"); outside Civil War "enemy leader" is the villain
  (ruling July 9, 2026 R3). Same pattern as wave 10 §3.6 Venom 56087.

### M14 Deferred

Phased Out (57076) chooses "an attachment on the enemy leader with the text 'Hero Action' or 'Hero Response'". No query
by ability label was found (`hasAbility`, `abilityLabel`, `hasLabel`, `withAbility` in `spec.ts` and `select.ts`). The
card is competitive only; build the query when competitive mode ships, and keep the data's current text correct now.

### M15 Reusable as is (checked by name, run nowhere yet)

Hinder X and the main scheme "gains hinder 2 [per_hero]" (wave 10 §3.13); Steady, Retaliate, Toughness, Patrol, Guard,
Quickstrike, Incite, Surge, Stalwart, Overkill, Piercing, Ranged (`keywords.ts`); `gainsKeyword` for "The enemy leader
gains steady", "She-Hulk gains stalwart", "Vision gains retaliate 1" (wave 9 §3.33); `giveStatus` (stun, confuse, tough)
on "your leader or you"; `dealIndirectDamage`, `distinctCardTypes`, `discardDeckUntil`; `superlative` for "the highest-cost
ally or support"; `grantTraitUntil` and `hasTrait` for Blood Debt's Hunted (wave 10 §3.16); "first minion revealed each
round gains surge" (round-history reads, wave 10 §3.23); "Allies enter play exhausted"
(`No Going Back 56124b`); a +1 or +2 ATK while the enemy leader attacks (`Secret Avengers 56142b`); `enemyTeamDecider`
and the grim-rule prompt (wave 10 §3.5). The leader refs (`leader`, `team`) and the cooperative "your leader cannot
resolve" fallback (wave 10 §3.6, owner Q11 = A).

## 4. Open questions (for the user or FFG)

### 4.0 The owner's answers

- **2026-10-19:** the pack ships in the wave 11 PR, after Civil War and before Wonder Man, never with Fear No Evil
  (header). Supersedes wave 10 Q2.
- **Carried from wave 10 §4.0 and applying here:** Q5 = A (a hero of the same name as the leader is allowed in a
  cooperative game: She-Hulk and Vision exist as heroes); Q6 = A (the first player makes the enemy team's choices, in a
  prompt marked as the enemy's); Q7 = A (modular sets of other products count toward the three or four); Q9 = A (the
  player sets three or four, default four); Q11 = A (a card that cannot resolve in cooperative play does what it can).
  The pack's leaders, modular sets and PvP copy raise none of these again.

### 4.1 Rules questions for the owner

The authority order settles every card in §7 except two. Q1 is a scenario-building rule neither official source reaches;
Q1 has no source that settles it (rules expert, 2026-10-19); A is built. Q2 was settled by the authority order (B; see M13).

| Q   | Question                                                                                              | A (default)                                                                | B                                  | Decision                                                                           |
| --- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Which main scheme stages may a custom leader of a side choose once both boxes are owned?              | Every stage of that side from either box (five stage 1s, five stage 2s)    | Only the leader's own box's stages | open                                                                               |
| 2   | Mimicked Move 57025 in a cooperative game: Taskmaster is in play and "your leader" cannot be attacked | The card does nothing (it is discarded; the "Otherwise" half does not run) | The "Otherwise" half resolves      | **B**, settled by RRG 1.8 "Otherwise" p. 31 + MC57 p. 4 (rules expert, 2026-10-19) |

### 4.2 The questions as asked, with the readings for the rules expert

**1. The stage pool.** MC56's custom steps say "Select one of the four main scheme stage 1s from the chosen side. Each
stage 1 has the same side A and a different side B." (MC56 line 428; the transcription strikes the numbered steps through
but the text reads as above, so the line is unchecked against the PDF.) MC57 adds one stage 1 and one stage 2 per side
whose A faces are Civil War's, and its page 6 says the modular sets "can be ... added to other scenarios when using the
scenario customization rules" without saying anything about main schemes. No ruling covers it (grep of the rulings
transcript and `docs/rulings/` for "main scheme" and "stage" with Civil War finds only wave 10's own entries).
Reading A: the A face is shared, the stage is chosen "from the chosen side", and the sides are colored by side not by box
(MC56 p. 4 "Each side uses different colors to identify its modular sets and main schemes"), so all five apply. Reading B:
"four" counts the box's own stages and the Synthezoid scenarios are built from their own two. A is built (M1); B is the
smaller change (the scenario's own card only) and is a switch in the builder. The precon recommendations of §1.4 are
the same under both.

**2. Mimicked Move.** Printed: "If Taskmaster is in play, he attacks your leader. Otherwise, give the enemy leader a
tough status card and a facedown boost card." MC57 p. 4: "A card ability that refers to 'your leader' cannot be
resolved. These cards typically have alternate effects that will resolve instead. Do as much as you can." The other
Synthezoid "your leader" cards (Atlas, Songbird, Penance) print an explicit "Otherwise" for the failure, so their
alternate resolves. This card's "Otherwise" is the other branch of an "If", not the failure of the attack. Reading A:
with Taskmaster in play the card has no resolvable effect (Taskmaster does not attack), matching wave 10 Q11 = A
(Darkforce). Reading B: "your leader" cannot be resolved, so the alternate effect resolves: the "Otherwise" half. B
makes the card never do nothing in a cooperative game; A keeps the printed condition. Settled as B: RRG "Otherwise" p. 31
covers an effect that cannot resolve, the "Otherwise" here is its own sentence, and wave 10 Q11 (Darkforce) had no
"Otherwise" clause, so it is not an equivalent case.

### 4.3 Product defaults taken (not rules)

Set by the owner's instruction or the nearest precedent; recorded so nobody rediscovers them:

1. **No new unlock row, no new hero reward.** The two scenarios open with the Civil War row (gate: the Agents of
   S.H.I.E.L.D. campaign win). The pack has no hero to give.
2. **Menus.** The two scenarios appear on Scenario select's Civil War shelf after Civil War's four (the shelf follows
   `WAVE10_SCENARIOS` order) and as the third leader of each side in the builder; the Title's "Civil War!" row is
   unchanged (it opens on the first scenario). The "New in this box" page for Civil War gains the entries.
3. **Random creation** includes the pack's leaders and sets: it draws from the pool by side. A seeded random game built
   before this change picks differently after it (§8.6).
4. **The eight leader player cards and the PvP copies** are data and scripts-skipped with a reason until competitive mode
   exists (wave 10 §7.9, §6).

## 5. What this asks of the other agents

1. **`card-data-pipeline`:** §8.1 D0 to D8. First, because everything else needs the emitted cards.
2. **`game-rules-architect`:** M1 (the one extend), the M3 to M13 verifications as failing tests if any row fails (a
   failure becomes an extend task appended to §8.2), and the answers to Q1 and Q2 recorded here. Not M12 (another agent)
   or M14 (competitive).
3. **`ability-scripting-engineer`:** §8.3, one module per task, under `packages/cards/src/wave10/synthezoid/`.
4. **`rules-qa-engineer`:** §8.5 and §8.6: the pack's audit, the games, the chronology tests, and the re-baselined seeded
   random games.
5. **`game-client-engineer`:** the builder with three leaders and twelve modular sets per side (long lists on a phone,
   `CLAUDE.md` "No tap on finger lift"), card hover on the new faces (`CLAUDE.md` "Card hover everywhere"), the Civil War
   "New in this box" entries tagged "Synthezoid Smackdown", and Guided mode text for the Dense and Intangible flip (a
   mechanic a player cannot learn from the Core lessons; `docs/guided-mode.md` §3.14).
6. **`content-release-tracker`:** the pack's errata (§0) and the Phased Out ruling are tracked; Moon Knight's
   once-per-phase limit and Phased Out's "Hero Action" go into `current` text.
7. **`encounter-ai-designer`:** none. The leaders are villains and use the existing activation logic.
8. **`code-reviewer`:** per piece, as `CLAUDE.md` says.

## 6. Later passes (placeholders)

- **Pass 2 (competitive):** when competitive mode ships (`docs/competitive-mode-plan.md`), the eight leader player cards
  (57032 to 57035, 57074 to 57077) and the PvP copies (57036 to 57039a/b, 57078 to 57081a/b) get scripts. M14
  (the labeled-ability query for Phased Out) is built then. Their data is emitted now and each card is registered as
  skipped with the reason "competitive mode not shipped" (wave 10 §7.9 and the `cw/competitive/*` modules are the model).
- **Not planned:** a campaign (the pack has none), a hero, a Team-Up.

## 7. Card coverage (pass 1)

Codes are MarvelCDB's; every card is scripted once in the module named, and a reprint (57036 to 57039a, 57078 to 57081a)
is registered to the Civil War module's ability with its own id. "Verify" rows use §3 numbers.

### 7.1 She-Hulk (registration; `she_hulk_leader`)

| Id                           | Card                       | Needs                                                                                        |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| 57001 to 57004               | She-Hulk I to IV           | Setup (I, III), When Revealed + Steady + no damage (II, IV), the Forced Response (all); §2.1 |
| 57007 Superhuman Strength x2 | attachment                 | Forced Interrupt: this attack gains overkill, discard; Boost: reveal; M15                    |
| 57008 Focused Rage x2        | attachment                 | stalwart; Forced Response after she schemes: discard                                         |
| 57009 One-Two Punch x2       | treachery                  | When Revealed by form; tough status                                                          |
| 57010 Ground Stomp x2        | treachery                  | exhaust each character you control; surge if none                                            |
| 57011 Gamma Slam             | treachery                  | discard the highest-cost ally or support, threat equal to its cost; surge if none            |
| 57012 Legal Practice         | side scheme (3 per player) | M10                                                                                          |

### 7.2 Vision (resistance; `vision_leader`)

| Id                                                                   | Card                           | Needs                                                                                               |
| -------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| 57040 to 57043                                                       | Vision I to IV                 | Setup (I, III), When Revealed (II, IV), the flip Forced Response; M3, M4                            |
| 57046a / 57046b Dense / Intangible                                   | permanent mass form attachment | M2, M3; Intangible's Forced Interrupt: reduce damage to Vision by 1                                 |
| 57047 Solar Gem, 57048 Vision's Cape                                 | attachments (unique)           | M5                                                                                                  |
| 57049 Mass Increase                                                  | attachment                     | while Dense is in play: prevent all damage from an attack on Vision, stun the attacker, discard; M4 |
| 57050 Density Control                                                | attachment (surge)             | flip to Intangible on a scheme activation, to Dense on an attack; discard if flipped                |
| 57051 Solar Beam x2, 57052 Superdense Strike, 57053 Phase Disruption | treacheries                    | M4, enemy team exhausts or discards an upgrade                                                      |
| 57054 Just Passing Through                                           | side scheme (3 per player)     | When Defeated: confuse your identity, else stun it                                                  |

### 7.3 Registration modular sets (5 cards each)

| Set (`id`)                            | Cards                                                                                                 | Needs                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| S.H.I.E.L.D. Ops (`shield_ops`)       | 57013 Operator x2, 57014 Strategic Overwatch, 57015 Rapid Response, 57016 Homeland Security           | Patrol; tough statuses; "first minion revealed each round gains surge" |
| Thunderbolts (`thunderbolts_modular`) | 57017 Atlas, 57018 Songbird, 57019 Penance, 57020 Justice Like Lightning, 57021 The Thunderbolts      | "stun/confuse/damage your leader, otherwise you"; M8                   |
| Taskmaster (`taskmaster_modular`)     | 57022 Taskmaster, 57023 Sword, 57024 Shield, 57025 Mimicked Move, 57026 Taskmaster's Academy          | M5, M9, M12, M13 (Q2)                                                  |
| Deadly Duo (`deadly_duo`)             | 57027 Jester, 57028 Jack O'Lantern, 57029 Mad Jack's Platform, 57030 Jester's Yo-Yo, 57031 Deadly Duo | discard the top 3 and count types; attach by the enemy team's choice   |

### 7.4 Resistance modular sets (5 cards each)

| Set (`id`)                          | Cards                                                                                        | Needs                                                                             |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Young Avengers (`young_avengers`)   | 57055 Patriot, 57056 Hawkeye, 57057 Stature, 57058 Teenage Superheroes, 57059 Young Avengers | Toughness, Guard; resolve each minion's When Revealed; gained piercing and ranged |
| Scarlet Twins (`scarlet_twins`)     | 57060 Speed, 57061 Wiccan, 57062 Superspeed, 57063 Spellcasting, 57064 Superpowered Siblings | Quickstrike, Incite 1; M11                                                        |
| Moon Knight (`moon_knight_modular`) | 57065 Moon Knight, 57066 Crescent Dart x2, 57067 Fist of Khonshu, 57068 Khonshu's Avatar     | M6, M7, M9                                                                        |
| Royal Guard (`royal_guard`)         | 57069 Janus, 57070 Amir, 57071 Atlanteans, 57072 Blood Debt, 57073 The Royal Guard           | Hunted trait; the enemy team deals Blood Debt                                     |

### 7.5 Main schemes (`synthezoid_registration`, `synthezoid_resistance`)

| Id                               | Stage                                      | Needs                                                                                                                                           |
| -------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 57005a / 57044a                  | 1A Superhero Registration Act / Resistance | "Contents" (read by the builder) and Setup: find the leader's side scheme and reveal it (cooperative branch); the competitive branch is skipped |
| 57005b Enforce the Law           | 1B, target 7 per player, +1 per player     | hinder 2 with more than one player; the enemy leader gains steady (text of 56200b)                                                              |
| 57044b Protect Secret Identities | 1B                                         | hinder 2; [star] Forced Response after step 1: each player discards the top 3 (text of 56122b)                                                  |
| 57006a / 57045a                  | 2A (flavor only)                           | none                                                                                                                                            |
| 57006b Mighty Avengers           | 2B, target 9 per player                    | the enemy leader gets +1 ATK while attacking (+2 undefended); players lose if completed (text of 56142b)                                        |
| 57045b Expose Overreach          | 2B                                         | allies enter play exhausted; players lose if completed (text of 56124b)                                                                         |

### 7.6 Set aside for pass 2 (competitive only)

| Id                | Card                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| 57032 to 57035    | You're Out of Order!, She-Hulk Smash, Make Me Angry, Legal Counsel (She-Hulk)                                  |
| 57074 to 57077    | Calculated Risk, Synthezoid Strike, Phased Out, Android Assistance (Vision)                                    |
| 57036 to 57039a/b | Righteous Cause, Whatever It Takes, Targeted Strike x2, Choosing Sides / Now It's Personal (registration copy) |
| 57078 to 57081a/b | the same five (resistance copy)                                                                                |

## 8. Build order (pass 1)

Data first, then the engine item, then scripting three modules at a time, then QA. One task per agent, one commit per
task (`CLAUDE.md`, "How to split work across agents"). Nothing waits on an open question except where it says so; the
defaults are built.

### 8.1 Data (`card-data-pipeline`)

- **D0.** Add `docs/campaign-modes/mc57_rulebook-web.pdf` (the Hall of Heroes insert, §0) and a markdown transcription
  `docs/campaign-modes/markdown/mc57_synthezoid_smackdown.md` the way `mc56_civil_war.md` is, noting that the diagram
  pages (pp. 10 to 11) come out scrambled. Update `docs/campaign-modes/markdown/index.md`.
- **D1.** `curation/synthezoid.ts` with the cycle, pack, release date and source line (§1.2 item 1); register it in
  `scripts/ingest-marvelcdb.ts` and `scripts/marvelcdb/survey.ts` (§1.2 item 2). Dry-run the survey.
- **D2.** Emit `src/data/synthezoid/` (`pnpm --filter @mc/content ingest -- --pack synthezoid [--offline]`): leaders as
  four-stage villains (§2), two main scheme cards with two stages each and `printedCardId` (§1.5), the ten sets, the
  eight leader player cards (competitive), the reprints with `duplicateOfCardId` (§1.6), and the obligations as
  encounter-set cards (Spellcasting, Blood Debt).
- **D3.** Corrections, each cited:
  1. Errata: Moon Knight 57065 `current` text adds "(Limit once per phase.)"; Phased Out 57076 `current` text reads "Hero
     Action" or "Hero Response" (RRG 1.8 p. 70, lines 5182 to 5190; rulings March 19, 2026 R1). Printed text stays.
  2. Choosing Sides 57039a and 57081a: starting threat 4 per player (from 56128a, scan read; survey §4).
  3. "Mass form." on 57046a/b is not the `form` keyword (M2).
  4. Dense 57046a has no "Attach to" sentence: Vision's Setup attaches it (`impliedAttachHost: "ownWhenRevealed"`, the
     `ownSetup` helper in `curation/cw.ts`).
  5. The `Attach to X. Otherwise, attach to the enemy leader.` parse (M9) and Mad Jack's Platform's chooser (the
     Resistance Fighter shape).
  6. `cardNotes` for the 18 scan-less faces (survey §4) and for the unchecked side-scheme thresholds.
- **D4.** `encounterSets` sides (§1.3) and the two PvP `setRecodes` (§1.6).
- **D5.** The two `ScenarioCuration` records (§1.4); validators pass (`validateScenario`: side, main scheme set side,
  `recommendedMainSchemeStageCodes` names one stage of each number).
- **D6.** Scan check against the images that exist: read the 70 local faces; the boost icons of 57046a/b, the other seven
  side-scheme thresholds, and every card whose raw text carries a `[star]` or a `[per_hero]` (survey §4). Findings go
  to `docs/phase7-synthezoid-scan-check.md`, a `typo(...)` correction for each mismatch.
- **D7.** Chronology wiring (§1.2 items 4 and 7), the content tests (§8.5 T1 to T4), the `fne` data left alone.
- **D8.** The owner's list for the PR: scans for the 18 faces (main scheme faces, the PvP reprints), art for the two
  leaders' scenarios if the client needs a scenario picture, music for the two leaders (Civil War's four are missing it
  too, `PLAN.md` line 658).

### 8.2 Engine queue (`game-rules-architect`, one agent at a time)

1. **M1:** the stage pool across the side's main scheme cards (`mainSchemeStagesOffer`, the builder offer, `stageOrder`
   across cards, validators, random creation). Content and cards touch `playable/scenario-options.ts`, `wave10/setup.ts`,
   `random-civil-war.ts` and the validator in `schema/validation.ts`; the last is in another agent's modified-file list
   (`git status`, 2026-10-18), so this task starts when that agent has committed.
2. **M3 to M5** as one verification test file, `packages/engine/src/mass-form-flip.test.ts` (or the cards package's own
   module test); a failure becomes an extend task here.
3. **M6, M8, M9, M10, M11, M13:** each its own failing-or-passing test in the owning scripting task; extend tasks
   are appended here when a row fails.
4. **M12** is the other agent's. **M14** waits for competitive mode.

### 8.3 Scripting queue (`ability-scripting-engineer`)

Module paths are under `packages/cards/src/wave10/synthezoid/`, mirroring `wave10/cw/{main-schemes,leaders,modular,
competitive}`. **Why `wave10/` and not `wave11/`:** the registry, the coverage guard (`wave10/card-groups.ts`
`CARD_GROUPS`), `wave10Scenario` and `wave10/setup.ts`'s encounter set list are already the Civil War leaders' home, and
`playable/index.ts` answers a Civil War leader through `wave10Playable`; the data is in the `WAVE10_*` arrays (§1.2), so
the abilities register next to them. A `wave11/` home would make `wave11Scenario` (built for Fear No Evil's
main-scheme-is-the-scenario shape) own two Civil War leaders and put cycle 10 under `WAVE11_ABILITIES`. No file is
shared with the agents editing `wave11/` and the engine's villainous and campaign code. "Waits on" lists §8.2 numbers
and D tasks.

**The scaffold**

1. `wave10/card-groups.ts` (group keys `synthezoid/...` for the 88 faces), `wave10/modules.ts` (the registries), the
   coverage guard, `wave10/setup.ts` for the two scenarios, `wave10/index.ts` exports, `wave10/cards.ts` comment. Waits on
   D2, D5, D7.

**The main schemes**

2. `synthezoid/main-schemes/registration.ts` (57005a/b, 57006a/b) and 3. `synthezoid/main-schemes/resistance.ts`
   (57044a/b, 57045a/b): each reuses the Civil War stage script under its own ids after a diff of the printed text. Wait
   on 1.

**The leaders**

4. `synthezoid/leaders/she-hulk.ts` (57001 to 57004, 57007 to 57012). Waits on 1, M10.
5. `synthezoid/leaders/vision.ts` (57040 to 57043, 57046a/b to 57054). Waits on 1, §8.2 item 2, M2.

**Registration modular sets**

6. `synthezoid/modular/shield-ops.ts` (57013 to 57016). Waits on 1.
7. `synthezoid/modular/thunderbolts.ts` (57017 to 57021). Waits on 1, M8.
8. `synthezoid/modular/taskmaster.ts` (57022 to 57026). Waits on 1, M9, M12, Q2.
9. `synthezoid/modular/deadly-duo.ts` (57027 to 57031). Waits on 1.

**Resistance modular sets**

10. `synthezoid/modular/young-avengers.ts` (57055 to 57059). Waits on 1.
11. `synthezoid/modular/scarlet-twins.ts` (57060 to 57064). Waits on 1, M11.
12. `synthezoid/modular/moon-knight.ts` (57065 to 57068). Waits on 1, M6, M9.
13. `synthezoid/modular/royal-guard.ts` (57069 to 57073). Waits on 1.

**Set aside**

14. `synthezoid/competitive/leader-cards.ts` (57032 to 57035, 57074 to 57077) and `synthezoid/competitive/standard-pvp.ts`
    (57036 to 57039a/b, 57078 to 57081a/b): registered as skipped with the reason "competitive mode not shipped" (§6).
    Waits on 1.

### 8.4 Scenario assembly and the client

- **S-1** (`@mc/cards`): the two records reach `playableScenario` and `wave10Scenario`; `civilWarSidesOffer` lists three
  leaders per side; `civilWarModularSets` lists twelve sided sets per side. Waits on D7 and M1.
- **S-2** (`@mc/client`): `pool.ts` (§1.2 item 7), the builder and Scenario select with the longer lists, the "New in this
  box" entries, hover, Guided text for Dense and Intangible, art or the scenario picture placeholder. Waits on S-1.

### 8.5 Tests (colocated, `docs/phase7-wave10-qa-*.md` style audits for the dated QA file)

Chronology (the owner's constraint, so each is a test and not a comment):

- **T1** (`@mc/content`): `SYNTHEZOID_CYCLE.id === "cycle10"`, `order === 10`; `SYNTHEZOID_PACK.releaseDate` is after
  `CW_PACK.releaseDate` and before `WONDER_MAN_PACK.releaseDate`; no synthezoid card, set or scenario is in any `WAVE11_*`.
- **T2** (`@mc/content`): in `PLAYABLE_CARDS` the first `synthezoid` card is after the last `cw` card and before the
  first `wonder_man` card, and the first `fne` card is after the last synthezoid card; the same order for
  `WAVE10_ENCOUNTER_SETS` and `WAVE10_SCENARIOS`.
- **T3** (`@mc/client`): `POOL_PACKS` and `POOL_PACK_CYCLES` list `synthezoid` between `cw` and `wonder_man`;
  `scenarioCycleOf` returns `"cycle10"` for both scenarios; a player before the Agents of S.H.I.E.L.D. win has them
  locked exactly as Civil War's four.
- **T4** (`@mc/cards`): `civilWarSidesOffer()` lists She-Hulk after Captain Marvel and Vision after Spider-Woman;
  `civilWarModularSets` lists Civil War's sets before the pack's.

Data and scripting:

- **T5:** every one of the 88 faces is in `CARD_GROUPS` exactly once and has a test naming it (coverage guard);
  `KNOWN_SKIPPED` has a reason for each of the 18 competitive faces and the 4 reprint faces.
- **T6:** the errata cards' `current` text differs from `printed`, and `printed` is as printed (57065, 57076).
- **T7:** Choosing Sides emits 4 per player; Dense and Intangible emit no `form` keyword; the PvP reprints carry
  `duplicateOfCardId` and resolve to Civil War's ids.
- **T8:** each module's tests, with M3 to M13 proven before a module relies on them; each Civil War stage the four new
  main scheme stages copy is diffed against its twin's printed text.

### 8.6 Rules QA and games (`rules-qa-engineer`)

`docs/phase7-synthezoid-qa.md`: the pack audited card by card against its text, MC57, RRG 1.8, the errata and rulings
(§0). Games, each seeded and replayed to a deep-equal outcome:

1. She-Hulk, standard and expert, one hero and two heroes, to a win and to a main scheme loss. Expert reveals III and
   IV; a stage II or IV reveal mid-villain-phase (§2.3).
2. Vision, standard and expert, the same four outcomes; at least one game where Dense and Intangible flip through step 1
   of the villain phase at least three rounds; one where Solar Gem is used (flip by response) and one where Density
   Control flips and is discarded.
3. A custom game per side mixing both boxes: She-Hulk with three Civil War registration sets and the pack's stage 1B
   on a Civil War stage 2B; Spider-Woman with the pack's Moon Knight and Royal Guard sets; Iron Man with the pack's Thunderbolts
   set (Q1 default A).
4. A Moon Knight game where the discard pile holds a treachery with a When Revealed that needs a choice, and the limit
   once per phase is exercised; a Taskmaster game once M12 has landed.
5. Seeded random creation: every existing seeded random Civil War test is **re-baselined deliberately**, one by one,
   because the side's pool of leaders, sets and stages grows (§4.3 item 3); a changed pick is expected, a changed rule
   is not.
6. Hero vs same-name leader (Vision hero against Vision, She-Hulk hero against She-Hulk; owner Q5 = A) and the unique
   rule for Hawkeye, Wiccan and Moon Knight minions against the hero-pack allies (wave 10 §3.8).
7. Precon e2e: both preconstructed scenarios exactly as MC57 pp. 6 and 7 build them (leader stages, the pack's two
   stages, the four sets, the Standard set).

Definition-of-done mapping (`docs/wave-definition-of-done.md`): §1 this spec; §2 D-tasks (no precon: the pack has no
hero; `WAVE10_*` exports and `PLAYABLE_CARDS`); §3 scripting guard and no unexplained skip; §4 the QA file above (§4b
custom decks does not apply: no hero, no deck rule; the aspect and basic cards are competitive); §5 `pool.ts`,
`POOL_VERSION` once, the two scenarios on Title and Scenario select in the browser, Guided text for the flip; §6 none (no
campaign); §7 no new `UNLOCK_WAVES` row, `docs/progression.md` clause; §8 a changie fragment per landed step, `Content`
and `Added` kinds, with `changie new` calls a second apart, written by the main session.

### 8.7 Order of work (one line each)

D0, D1, D2 to D6 (data), D7 (chronology wiring and T1 to T4), then in parallel: S-1 and §8.2 item 2, then scripting 1,
then tasks 2 and 3, 4 and 5, 6 to 9, 10 to 13 in groups of three, then 14, S-2, §8.6.
