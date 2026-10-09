# Phase 7 working spec: wave 9 (cycle 9, Agents of S.H.I.E.L.D.)

This is the shared brief for every agent working Phase 7's ninth content wave (`card-data-pipeline`,
`game-rules-architect`, `ability-scripting-engineer`, `encounter-ai-designer`, `rules-qa-engineer`,
`game-client-engineer`). It turns the wave's scope into schema decisions (§1), per-scenario setup needs (§2), a list of
engine primitives with a status each (§3), open questions for the owner (§4), the card coverage tables (§7) and the
build order (§8). The model is `docs/phase7-wave8.md`, and its section numbers are kept (§0 sources, §1 schema, §2
setup, §3 primitives, §4 questions, §5 other agents, §6 later passes, §7 card tables, §8 build order). Wave 1–8 §3
primitives are assumed. The definition of done is `docs/wave-definition-of-done.md`: **the box's campaign ships in this
wave.** If you change a decision here, update this file in the same change. Agents do not edit statuses or open
questions; they report, and the main session flips them.

**Wave 9** is our `cycleId("cycle9")`. RRG 1.8 Appendix VI (p. 71), item 9: "The _Agents of S.H.I.E.L.D._ campaign
expansion, the _Black Panther Hero Pack_, the _Silk Hero Pack_, the _Falcon Hero Pack_, and the _Winter Soldier Hero
Pack_." Packs: `aos` (MC50, with Maria Hill and Nick Fury), `bp`, `silk`, `falcon`, `winter`, and the scenario pack
`tt` (Trickster Takeover), which the owner asked to ship with this wave. The spec is written in passes so each stays
small (the split after 1a is proposed; the main session decides it):

| Pass   | Scope                                                                                                   | State            |
| ------ | ------------------------------------------------------------------------------------------------------- | ---------------- |
| **1a** | **The box in standalone play: new rules and keywords, five scenarios, their modular sets, both heroes** | **written**      |
| 1b     | The MC50 campaign; evidence cards in campaign mode; the Executive Board across scenarios                | not written      |
| 2a     | Black Panther (`bp`), Silk (`silk`)                                                                     | written (pass 2) |
| 2b     | Falcon (`falcon`), Winter Soldier (`winter`)                                                            | written (pass 2) |
| 2c     | Trickster Takeover (`tt`): Forced Action, the per-group icon, Enchantress, Loki                         | not written      |
| 3      | The owner's answers written in and reconciled; §8 extended to the whole wave                            | not written      |

- **Pass 1a's content.** MC50 pp. 3–4 (featured terms and keywords, all-purpose counters, attacks against allies,
  non-scaling villain hit points), the standalone parts of pp. 6, 9, 11, 13, 15, 18, 19 and the FAQ on p. 22; all 195
  raw records of `aos` except what the campaign alone reads: Maria Hill (50001a/b, 50002–50011, obligation 50029,
  nemesis set 50030–50033), Nick Fury (50034a/b, 50035a/b, 50036–50046, obligation 50059, nemesis set 50060–50063), the
  box's aspect and basic cards (50012–50028, 50047–50058), and the encounter sets Black Widow (50064–50079), A.I.M.
  Abduction (50080–50082), A.I.M. Science (50083–50085), Batroc (50086a/b–50097), Batroc's Brigade (50098–50102),
  M.O.D.O.K. (50103a/b–50124), Scientist Supreme (50125–50128), Thunderbolts (50129a/b–50138), Gravitational Pull
  (50139–50142), Hard Sound (50143–50147), Pale Little Spider (50148–50151), Power of the Atom (50152–50155),
  Supersonic (50156–50160), The Leaper (50161–50164), Baron Zemo (50165a/b–50177), S.H.I.E.L.D. (50178–50180),
  S.H.I.E.L.D. Executive Board (50181a/b–50184c) and Executive Board Evidence (50185–50193, as hidden cards only).
  Every record and every nested b face was read by script; 44 scans were read (§0). Sections 0, 1.1–1.14, 2.1–2.7,
  3.1–3.35, questions 1–5, §5, §7 and §8.
- **Not in this pass** (placeholders in §6): the Campaign Instructions boxes on MC50 pp. 9, 11, 13, 15 and 19, the
  campaign log and the expert campaign; the evidence cards' own "Setup" abilities (campaign only, MC50 p. 18: "Ignore
  the text on the lower portion of the evidence card"); the four hero packs (pass 2, below); Trickster Takeover.
  **Forced Action and the per-group icon are Trickster Takeover's** (its insert pp. 4 and 7 per the sources page): no
  `aos` record prints either, and every `*_per_group` field of the raw `aos` cache is empty (checked by script). They
  are pass 2c's.
- **Data state (2026-10-09, HEAD 8d35670b):** `aos` is not emitted (raw cache only); `bp`, `silk`, `falcon` and
  `winter` are data only; no data survey exists yet (`docs/phase7-wave9-data-survey.md`). Nothing of this wave is
  scripted.
- **Passes 2a and 2b's content (written 2026-10-09, HEAD acae896e).** The four hero packs in one pass: `bp` (Black
  Panther / Shuri, 51001a/b to 51042), `silk` (52001a/b to 52038), `falcon` (53001a/b to 53042) and `winter` (Winter
  Soldier, 54001a/b to 54037): 159 raw records and their four alter-ego faces, every one read by script, 32 scans read
  (§0.1). Sections 0.1, 3.36–3.52, questions 6 and 7, §5.1, §7.9–§7.12, §8.1 items 12–17, §8.2 tasks 23–36, §8.3 and
  §8.4 lines 32–63. **No new keyword and no deck-building rule** in the four packs: no identity prints one (raw
  `deck_options` and `deck_requirements` are empty on all four), and the keywords are Team-Up, Linked, Restricted,
  Uses, Requirement, Alliance, Victory, Villainous, Quickstrike, Surge, Guard and Toughness, all of earlier waves. The
  data is emitted: the four packs left the data-only list at this HEAD, and the survey exists
  (`docs/phase7-wave9-data-survey.md` §3 and §6.2).
- **Each hero's defining mechanic (pass 2).** Shuri: "Special" abilities on Black Panther upgrades, resolved one at a
  time by her basic powers and events, each upgrade spendable for a bigger effect (§3.36), and an alter-ego that
  searches for and plays them (§3.37). Silk: encounter cards tucked under the identity, at most four, read by their
  encounter set (§3.39–§3.41). Falcon: the encounter deck's top card faceup in his player phase, and Redwing and his
  Aerial cards discarding it for the icons in its boost area (§3.42–§3.45). Winter Soldier: Cybernetic Arm paying for
  Attack events, which read that payment, and rewards for attacking and defeating an enemy; his kit needs no engine
  change (§3.52), only his pack's Whiteout set does (§3.50).

## 0. Sources

Authorities, in the order they win (RRG 1.8 "The Golden Rules", p. 4: card text and scenario rules beat the Rules
Reference; FFG rulings clarify both):

1. **Card text and product rules.**
   - The Agents of S.H.I.E.L.D. rulebook, `docs/campaign-modes/mc50_rulebook-web.pdf` (24 pages), converted in
     `docs/campaign-modes/markdown/mc50_agents_of_shield.md`, cited as "MC50 p. N" (PDF page = printed page). The Read
     tool could not render PDFs in this session (`pdftoppm` is missing), so pages were read through `pymupdf`: the text
     layer of pp. 3, 4, 9, 11, 13, 15, 18, 19, 22 and 24, and a render of p. 24. **Checked** against the text layer:
     every MC50 quotation in this file. Conversion slips found:
     - p. 4: the "Note" on non-scaling villains ("These 'Forced Interrupt' effects replace the defeating of the
       villain …") is printed at the foot of the page in the markdown; it belongs to "Non-Scaling Villain HP".
     - p. 9: the paragraph "When a hero or ally attacks Black Widow … the attacking player discards the top / card of
       the encounter deck and resolves any 'Preparation' ability on the discarded card before resolving the attack" is
       split in two around the Campaign Instructions box.
     - p. 22: the answer to "Am I considered to have defeated one of these villains" ("No, the forced effects on these
       villains replace the defeating of the villain …") is printed at the foot of the page.
     - p. 24: **the "Evidence Combinations" grid is a picture.** The render shows 27 rows of three icons (nine under
       each board member); neither the markdown nor the text layer has them. They are not transcribed here (§1.12,
       §8.1 item 1). **Unchecked.**
   - **A rulebook sentence that disagrees with the cards.** MC50 p. 18: "reducing Baron Zemo to 0 hit points triggers
     his '**Forced Response**'". The printed cards (scans 50165a, raw 50166a) say "**Forced Interrupt**: When Baron
     Zemo would be defeated, reset his hit points to 12 instead", as MC50 p. 4 does. The card wins (§3.5).
   - Card text: `packages/content/raw/marvelcdb/aos.json`, every record pulled by script. Not an authority on its own.
     **Scans read this session** (`assets/card-art/bundles/cards/`, gitignored), 44 faces: 50001b, 50022, 50034a,
     50034b, 50035a, 50035b, 50062, 50064, 50065, 50066, 50067b, 50068, 50083, 50086a, 50087b, 50088b, 50089b, 50090a,
     50091, 50103a, 50104b, 50105a, 50113, 50120, 50125, 50126, 50129a, 50130a, 50131b, 50133, 50143, 50153, 50156,
     50165a, 50165b, 50167a, 50167b, 50168b, 50169b, 50171, 50181a, 50181b, 50184a, 50185. **A printed-card claim in
     this file is "checked" only for those faces**; every other card is "unchecked (raw data)". The scans disagree
     with the raw cache in the places §1.14 lists.
2. **RRG 1.8** (`mc_rulesreference_v18_compressed.md` for text, the PDF for page numbers; PDF page = printed page,
   confirmed on pp. 6, 48, 64, 65 and 69 through the text layer). Entries this pass leans on: "Activation" (p. 6),
   "All-Purpose Counter" (p. 6), "Attack (Enemy Activation)" (p. 8), "'Cannot'" (p. 11), "Confuse, Confused" (p. 13),
   "Crisis Icon" (p. 14), "Dash (Value)" (p. 15), "Defeat" (p. 15), "Engage" (p. 18), "Find" (p. 19), "First Player"
   (p. 19), "Flip" (p. 20), "Form, Change Form" (p. 21), "Hit Points" (p. 22), "'Instead'" (p. 25), "Permanent"
   (p. 32), "Quickstrike" (p. 36), "Replacement Effect" (p. 37), "Stalwart" (p. 40), "Status Cards" (p. 41), "Steady"
   (p. 41), "Stun, Stunned" (p. 41), "Team-Up" (p. 43), "Tuck" (p. 45), "Uses (X 'Type')" (p. 46), "Victory X"
   (p. 46), "Vulnerable" (p. 48), "'Would'" (p. 48), Appendix II "Setup" (p. 51).
   - **FAQ, "Agents of S.H.I.E.L.D. Expansion"** (pp. 64–65, text layer read, checked): Maria Hill (#1B), p. 64
     (§3.10); Stealth (#35), p. 65 (§3.9).
   - **Errata, "Agents of S.H.I.E.L.D. Expansion"** (p. 69, text layer read, checked). The markdown interleaves this
     block with the X-23 block; the PDF has two entries and no more:
     - "RADIATION EXPOSURE (#171A) The 'SCH' modifier on this card should be a 'THW' modifier."
     - "MACH-IV (#156) Should read: 'Each character without the Aerial trait cannot defend against MACH-IV's attacks.'
       (Changed 'make basic defenses' to 'defend'.)"
     - The "Your identity gets +4 hit points" line is Front Line Specialist (#36), X-23 Hero Pack, not this box.
     - **The RRG's collector number for Radiation Exposure is wrong.** The card is 153 (scan 50153, "Power of the Atom
       (2/6)"); 171 is Reluctant Foe, which has no stat box. The erratum is applied to 50153 (§3.34).
3. **FFG rulings** (`marvel-champions-rulings-post-rrg-1-7.md`, cited by date heading). Every title of the box was
   matched against the file by script. Rulings that name a card or rule of this pass:
   - December 17, 2025 – Ruling 3: "Stealth Suit only triggers when Nick Fury would be attacked" (not an ally he
     controls; §3.9).
   - January 17, 2026 – Ruling 2: Arm Block against the villain Black Widow. "Black Widow's interrupt triggers …
     A.I.M. Grunt is now being attacked by Arm Block, taking the 3 damage", and the prevention still applies to her
     original attack (§3.4).
   - January 26, 2026 – Ruling 2: "Once an all-purpose counter is placed on a card, it gains the type of counter
     defined on the card it occupies" (RRG p. 6; §3.6).
   - January 26, 2026 – Ruling 4 (2) and April 30, 2026 – Ruling 3 (3): Alert Level flipping is not a reveal (§3.16).
   - June 25, 2026 – Ruling 4 (3): "Environments flip, they are not revealed."
   - June 25, 2026 – Ruling 5: finding and revealing a card already in play (the six "Find [minion] and reveal"
     treacheries of scenario 4 use the wave 8 §3.1 primitive).
4. `docs/phase7-wave9-sources.md` and `docs/phase7-wave9-handoff.md` are pointers. Three lines of the sources page are
   superseded here: its §4 lists Forced Action and the per-group icon without saying they are `tt` only; its §2.4
   "possible mismatch" on Zemo is settled above; and its §5.3 gives the Radiation Exposure number as printed in the
   RRG without the correction above.

No ruling of this pass says a printed wording is unintended, and none disagrees with the RRG. The conflicts found are
between the RRG and the rulebook (§4.1 Q1, Q2 and Q5).

### 0.1 Pass 2 sources (the four hero packs)

- **Card text.** `packages/content/raw/marvelcdb/{bp,silk,falcon,winter}.json`, every record and linked alter-ego
  face pulled by script. **Scans read this session** (`assets/card-art/bundles/cards/`), 32 faces: 51001a, 51001b,
  51015, 51016, 51017, 51018, 51036, 51038; 52001a, 52001b, 52005, 52008, 52028, 52031; 53001a, 53001b, 53002, 53005,
  53006, 53008, 53009, 53020, 53023, 53034, 53038; 54002, 54004, 54018, 54027, 54033, 54034, 54035. **A printed-card
  claim of this pass is "checked" only for those faces**; every other card is "unchecked (raw data)". One difference
  from the raw cache: Infiltration 51015 prints "remove 1 threat" (raw: "remote").
- **No hero pack insert is in the repo.** The starter decks are the printed decklist cards the data survey read
  (§6.2 there); the four modular set names are on the cards themselves ("Techno (1/6)" on 53038, "Whiteout (1/6)" and
  "(2/6)" on 54034 and 54035, checked; Extreme Risk and Growing Strong from the raw set codes, unchecked).
- **RRG 1.8 FAQ** (p. 65, text layer read, checked): "Black Panther Hero Pack": The Elephant's Trunk (#7), Target
  Spotter (#38); "Falcon Hero Pack": Redwing (#2). No FAQ entry names Silk or Winter Soldier. The "Black Panther"
  retaliate entry elsewhere in the FAQ is Core's card.
- **RRG 1.8 errata** (p. 70, text layer read, checked): "Silk Hero Pack": Eidetic Memory (#8); "Winter Soldier Hero
  Pack": S.H.I.E.L.D. Deputy (#33). None for Black Panther or Falcon.
- **RRG glossary pages** of this pass were taken from the markdown's page footers by script, not from the PDF:
  "Alliance" (p. 6), "Amplify Icon" (p. 7), "Attach To" (p. 8), "Cost" (p. 13), "Deal, Deal an Encounter Card"
  (p. 15), "Defend, Defense" (p. 15), "Encounter Deck" (p. 17), "Encounter Set" (p. 18), "Find" (p. 19), "'For Each'"
  (p. 20), "'Instead'" (p. 25), "Limit" (p. 27), "Linked (Card Title)" (p. 27), "Look, Looked-At" (p. 27), "Move"
  (p. 30), "'Otherwise'" (p. 31), "Player Card" (p. 33), "Player Side Scheme" (p. 34), "Replacement Effect" (p. 37),
  "Resource Ability" (p. 37), "Scenario-Specific Card" (p. 39), "Special" (p. 40), "Star Icon" (p. 40), "'Swap'"
  (p. 42), "Team-Up" (p. 43), "Traits" (p. 45), "Tuck" (p. 45), "Unique Icon" (p. 45), "Victory X" (p. 46).
- **FFG rulings.** Every card title and identity name of the four packs was matched against the rulings file by script
  and each hit read: December 17, 2025 – Rulings 1 (2) and 2; January 17, 2026 – Rulings 2 and 3; January 26, 2026 –
  Ruling 6; March 6, 2026 – Rulings 1 and 2; March 19, 2026 – Ruling 5; April 30, 2026 – Ruling 3 (3); June 2, 2026 –
  Ruling 2 (2); June 25, 2026 – Ruling 1; July 9, 2026 – Ruling 2; August 3, 2026 – Ruling 4 (3). §3.51 says where
  each lands. The Captain America rulings of January 11, 2026 are about the Civil War leader's shield, not these
  cards.
- **No ruling of this pass says a printed wording is unintended**, and none disagrees with the RRG. Two errata change
  printed text (§3.41, §3.51). Ruling January 26, 2026 – Ruling 6 answers a question that named three cards by naming
  one (§4.1 Q6).

## 1. Schema decisions (owner: `game-rules-architect`)

> Status: **proposed (2026-10-09), nothing landed.** Searched `packages/content/src/schema` and `packages/engine/src`
> for each shape below. This pass asks for **two schema additions** (§1.6 a card's defined counter types, §1.12 the
> evidence grid) and otherwise reuses what is there.

### 1.1 Vulnerable

`"vulnerable"` is already a `KeywordInstance` (`schema/keywords.ts`) and a glossary entry marked `box: "later"`. Eight
cards print it: 50083, 50093, 50094, 50098, 50125, 50126, 50172, 50178. The glossary's box becomes this cycle when the
keyword lands (§3.1). **No schema change.**

### 1.2 Preparation: an ability label, not a boost ability

Ten records print "**Preparation**:" under the rule where a boost ability sits: 50068–50073 and 50076–50079. MC50 p. 9:
"These abilities are **not** resolved when the cards are turned faceup as boost cards." The data agent emits each as an
`AbilityReference` whose label is "Preparation", never as a boost ability and never with a boost star; the engine side
is §3.2. The same word is a **trait** on player upgrades (50010, 50042, 50043, 50045, 50050–50052, 50058, and Handspring
50149 on the encounter side): a trait and a label are different fields, and "Preparation card" in card text (50046,
50047, 50058, 50150) always means the trait. **No schema change** if `AbilityReference.label` already carries a free
label; the data agent confirms and reports.

### 1.3 Villains

- **Black Widow** (50064–50066): one `VillainCard`, stages I/II/III, hit points 13, 16 and **20** per player (scans;
  the raw cache has 13 for stage III, §1.14), `villainStages: { standard: [1, 2], expert: [2, 3] }`.
- **Batroc** (50086a/b), **M.O.D.O.K.** (50103a/b), **Citizen V** (50129a/b): one stage each with an A and a B face,
  "Flip [villain] (A) to [villain] (B) for expert mode" (MC50 pp. 11, 13, 15). The wave 8 shape: two one-stage records
  joined by `ScenarioVillain.sideBCardId`, the face chosen by the mode. Batroc and M.O.D.O.K. print hit points
  **without** the per player icon (8 / 12 and 10 / 14, scans 50086a, 50103a): `hp` is a fixed `ScalingValue`.
  Citizen V is 12 / 16 per player.
- **Baron Zemo**: two cards with two faces each. 50165a "A1" (12 hit points, fixed) flips to 50165b "A2" (18 per
  player, traits Thunderbolt and Unmasked); 50166a "B1" (16, fixed) flips to 50166b "B2" (18 per player, steady).
  Standard uses card 165, expert card 166 (MC50 p. 18: "Remove Baron Zemo (A1) and add Baron Zemo (B1)"). The flip is
  the main scheme's (50169a), not a stage advance: one villain record per card with two faces joined by
  `otherFaceId`, `stageLabel` "A1" / "A2" / "B1" / "B2". **No schema change.**

### 1.4 Main schemes

| Scheme                              | Faces   | Start         | Target        | Acceleration  | Notes                           |
| ----------------------------------- | ------- | ------------- | ------------- | ------------- | ------------------------------- |
| The Widow's Web 50067a/b            | 1A / 1B | 2 per player  | 10 per player | +X per player | X is the villain's stage number |
| Infiltrate A.I.M. Island Embassy 87 | 1A / 1B | 6 per player  | 12 per player | +1 per player | `completionLoses`; left at 0    |
| Locate Missing Person 50088a/b      | 2A / 2B | 3 per player  | 10 per player | +1 per player | `completionLoses`; 2A is blank  |
| Extract Captives 50089a/b           | 3A / 3B | 12 per player | 18 per player | +1 per player | `completionLoses`; win at 0     |
| Upgrading Adaptoids 50104a/b        | 1A / 1B | 1 per player  | 7 per player  | +1 per player | completion replaced (§3.18)     |
| Apprehending Rogue Agents 50130a/b  | 1A / 1B | 1 per player  | 11 per player | +1 per player | `completionLoses`               |
| Zemo's Manipulations 50167a/b       | 1A / 1B | 2 per player  | 12 per player | +2 per player | `completionLoses`               |
| The Accusation 50168a/b             | 2A / 2B | dash          | dash          | dash          | both faces only a When Revealed |
| Fighting Zemo 50169a/b              | 3A / 3B | 0             | 12 per player | +2 per player | threat from its When Revealed   |

Checked by scan: 50067b, 50087b, 50088b, 50089b, 50104b, 50167b, 50168b (three dashes), 50169b. The others are raw
data. The Widow's Web's acceleration is `printedX` with the X read from `ValueSpec villainStageNumber` (1, 2 or 3; both
exist). The Accusation's three dashes are `dashedValues` (exists). **No schema change.**

### 1.5 Double-sided cards whose faces differ in type

| Card                             | Face a                 | Face b                           | Same type? (RRG "Flip", p. 20) |
| -------------------------------- | ---------------------- | -------------------------------- | ------------------------------ |
| Assault / Stealth 50035a/b       | upgrade, suit form     | upgrade, suit form               | yes: tokens stay               |
| Alert Level 50090a/b             | environment, trait Low | environment, trait High          | yes: tokens stay               |
| Justice, Like Lightning 50131a/b | environment            | environment (Thunderbolt Backup) | yes: the attached minion stays |
| Holding Cell 50105a/b–50108a/b   | environment            | ally (four different allies)     | no: tokens are discarded       |
| Board Members 50181a/b–50183a/b  | environment, setup     | attachment, permanent            | no: see §4.1 Q1                |

Each is two records joined by `otherFaceId`, as wave 8's Overseer and Prelate faces are. Alert Level's two faces carry
different traits (`Low.` / `High.`), which the cards that read "on its [High] side" need (§3.16).

### 1.6 Counter types a card defines (new field)

RRG "All-Purpose Counter" (p. 6): a moved counter "gains the type defined on the new card it occupies. If the new card
does not define a type, it is considered only an 'all-purpose counter'." A `uses` keyword defines a type and is
already data. Cards of this box define a type in their text without the keyword: lock counters (Holding Cell
50105a–50108a), secret counters (Board Members 50181a/b–50183a/b), parley counters (Jolt 50133). **Proposed:**
`BaseCard.definedCounterTypes?: readonly string[]`, emitted by the normalizer from "N [type] counter(s)" in a card's
own text and omitted when the only type is its `uses` keyword's (the engine reads both, §3.6). The Douglass (50019)
prints "Uses (3 operation counters)" and a cost of "1 operational counter": one type, `operation`, with a correction
note.

### 1.7 Stats: a missing value in the raw cache is a printed 0

Scans 50062, 50083, 50120, 50133 and 50143 print **0** where the raw record has no `attack` or `scheme` (Leviathan
Soldier SCH 0★, A.I.M. Scientist SCH 0 and ATK 0, A.I.M. Jailer SCH 0, Jolt SCH 0, Songbird SCH 0★ and ATK 0★), and scan
50022 prints cost 0 for Grant Ward. None is a dash. The normalizer emits 0 for these and for every other `aos` record
with the field missing (50028, 50045, 50049, 50058, 50004, 50024–50027: cost 0; unchecked), and `dashedStats` only
where a scan shows a dash (Rescued Captive 50091's cost; the four Inhuman allies' costs, unchecked).

### 1.8 Icons printed on cards that are not schemes

An acceleration icon on a minion (A.I.M. Scientist 50083, scan), on an attachment (Focusing Crystal 50115) and on an
obligation (Arrest Warrant 50179); an amplify icon on an attachment (Solid Sound Constructs 50144). RRG "Acceleration
Icon" (p. 5) counts every icon **in play**, whatever it is printed on. `BaseCard.amplifyIcons` is on every card;
`schemeIcons` must be accepted on a minion, an attachment and an obligation (wave 8 §1.8 did this for an obligation).
The data agent confirms the validator and reports; **no new field**.

### 1.9 Victory –1

Rescued Captive 50091, Scientist Supreme 50125 and Monica Rappaccini 50126 print "Victory –1." (scans).
`KeywordInstance victory.value` already takes a negative whole number. **No schema change.**

### 1.10 Scenario records

| Scenario     | Villain record(s)          | Main scheme ids        | Required sets                                                                | Modular sets                                        |
| ------------ | -------------------------- | ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| Black Widow  | 50064–50066                | 50067a                 | Black Widow, Standard                                                        | 2: A.I.M. Abduction, A.I.M. Science                 |
| Batroc       | 50086a (`sideBCardId` 86b) | 50087a, 50088a, 50089a | Batroc, Standard                                                             | 2: A.I.M. Science, Batroc's Brigade                 |
| M.O.D.O.K.   | 50103a (103b)              | 50104a                 | M.O.D.O.K., Standard                                                         | 1: Scientist Supreme                                |
| Thunderbolts | 50129a (129b)              | 50130a                 | Thunderbolts, Standard                                                       | `{ base: 1, perPlayer: 1 }`, restricted pool (§2.5) |
| Baron Zemo   | 50165 (standard), 50166    | 50167a, 50168a, 50169a | Baron Zemo, S.H.I.E.L.D. Executive Board, Executive Board Evidence, Standard | 2: Scientist Supreme, S.H.I.E.L.D.                  |

- `Scenario.modularSetCount` already takes `{ base, perPlayer }` and `Scenario.modularSetPool` a restricted list
  (`schema/sets.ts`, wave 6 §3.63). The Thunderbolts pool is every modular set that holds an Elite, Thunderbolt minion:
  in this box Gravitational Pull, Hard Sound, Pale Little Spider, Power of the Atom, Supersonic and The Leaper
  (MC50 p. 15). The pool is derived from card data (trait query), so a later product's qualifying set joins without an
  edit.
- **S.H.I.E.L.D. Executive Board** outside the campaign (MC50 p. 6): "can be used … as a modular encounter set. When
  used this way, place two secret counters on each Board Member environment during setup. This set does not count
  toward the required number of modular encounter sets." That is the existing "add to any scenario, never counted"
  flag (`schema/sets.ts`, the Longshot rule, wave 6 §3.63). In the Baron Zemo scenario the set is required.
- **Executive Board Evidence** is never a modular choice and never in a deck (`setup.ts` refuses evidence cards
  already); only the Baron Zemo scenario lists it.
- `setAsideCardIds`: the four Rescued Captive copies (Batroc); the Holding Cell cards and the Adaptoid environments
  (M.O.D.O.K., §2.4); the chosen Thunderbolt minions (§2.5); Baron Zemo's Sword is **not** set aside (50169a finds it).

### 1.11 Maria Hill's deck rule; Super Spies

- 50001b: "You may include the maximum number of copies of 3 S.H.I.E.L.D. supports in your deck from aspects other
  than your chosen aspect" (scan). The field exists for exactly this FAQ (`schema/cards/identity.ts`, RRG p. 64):
  `IdentityDeckbuilding.offAspectPackages: [{ cardType: "support", trait: "S.H.I.E.L.D.", titles: 3 }]`. The data
  agent sets it; the rule is §3.10.
- Super Spies 50024: "Team-Up (Maria Hill and Nick Fury). Max 1 per deck." Raw `quantity: 2`, `deck_limit: 1`: two
  copies in the box, one in each starter deck.

### 1.12 Evidence cards and the combination grid (new data)

`EvidenceCard` exists (`schema/cards/evidence.ts`), with `evidence: "means" | "motive" | "opportunity"` and an
optional `evidenceIcon`. The standalone Baron Zemo scenario needs two things the schema does not hold yet:

- `evidenceIcon` on all nine cards (read from the scans; 50185 Medical Records is the caduceus folder, scan), and
- the grid of MC50 p. 24: **27 rows of (means, motive, opportunity) → board member**, nine per board member.
  **Proposed:** `EvidenceCombination { means: CardId; motive: CardId; opportunity: CardId; boardMember: CardId }` and
  an exported `AOS_EVIDENCE_COMBINATIONS` of 27 rows beside the pack's data, validated to be a bijection on the 27
  triples with nine rows per board member. The engine reads it through the scenario record, never by name (§3.29).
  **Not transcribed and unchecked:** the grid is a picture (§0); the data agent reads it from a 300 dpi render with
  the nine evidence scans beside it, and a second reader confirms it, because one wrong cell changes who the mole is.

### 1.13 Reprints

Energy 50025, Genius 50026, Strength 50027 and Under Surveillance 50053 carry titles of Core Set cards. The data agent
confirms the text matches and lists them in the wave's `reprints.ts`; unchecked here.

### 1.14 Corrections the data agent owes for this box

1. Black Widow III 50066: hit points **20** per player (scan), not the raw 13.
2. Monica Rappaccini 50126: the printed keywords are "Victory –1. Vulnerable." (scan). The raw text adds a
   "Villainous." that is not on the card; she gains villainous only "while Scientist Supreme is in the victory
   display".
3. Radiation Exposure 50153: the −1 SCH box is a **−1 THW** box (RRG p. 69 erratum, printed there as "#171A"; the scan
   shows −1 SCH and −1★ ATK).
4. MACH-IV 50156: "cannot defend against MACH-IV's attacks" (RRG p. 69; the scan has "cannot make basic defenses").
5. §1.7's zeros.
6. Typos to normalize, with a provenance note each: "Attack to Black Widow" on 50068–50070 (scan 50068 prints "Attach
   to Black Widow"); "Batrocs's Brigade" on 50087a; "Aggresion" on 50193; "search you deck" on 50056; "operational
   counter" on 50019; the set title "M.O.D.O.K" without its last period.
7. Strong Inhuman 50108b: the raw label is "Forced **Interrupt**: After this card leaves play", where the other three
   Inhuman allies have "Forced Response". Read the scan and record which is printed; the script follows the trigger
   word "After" either way.
8. Black Widow I: MC50 p. 2's callout reads "resolve each 'Preparation' ability discarded this way"; the printed card
   (scan 50064) reads "on that card". The card wins; same meaning.

## 2. Per-scenario setup needs

RRG 1.8 Appendix II (p. 51) with the wave 1–8 engine. The Campaign Instructions boxes are pass 1b's; in a standalone
game none of them applies.

### 2.1 The five scenarios

| Scenario     | Main scheme deck                        | Needs (§3)                           |
| ------------ | --------------------------------------- | ------------------------------------ |
| Black Widow  | The Widow's Web (1 stage)               | 3.1–3.4, 3.20, 3.33, 3.35            |
| Batroc       | three stages, left by removing threat   | 3.1, 3.5, 3.7, 3.13–3.16, 3.33, 3.35 |
| M.O.D.O.K.   | Upgrading Adaptoids (1 stage, replaced) | 3.1, 3.5, 3.6, 3.17–3.20, 3.25, 3.35 |
| Thunderbolts | Apprehending Rogue Agents (1 stage)     | 3.21–3.25, 3.33, 3.34, 3.35          |
| Baron Zemo   | three stages, advanced by choice        | 3.1, 3.5, 3.26–3.31, 3.35            |

### 2.2 Black Widow (MC50 p. 9; 50067a)

1. Appendix II steps 1–9 as usual. The villain deck is Black Widow I and II (II and III in expert mode).
2. The encounter deck is the Black Widow set (50068–50079, 19 cards), A.I.M. Abduction, A.I.M. Science, Standard, the
   Expert set in expert mode, and the obligations.
3. 50067a **Setup**: "Each player searches the encounter deck for a minion and puts it into play engaged with them.
   (Shuffle.)" Each player's own choice, in player order; put into play, not revealed (no When Revealed, no surge),
   but "engages" (quickstrike on A.I.M. Commando 50072 answers an engagement; RRG "Quickstrike", p. 36, and every player
   is in alter-ego form at setup, so it does not attack). One shuffle after the last search.
4. Flip to 1B: 2 per player threat. No When Revealed.

**In play.** The villain's Forced Interrupt (§3.4) turns every attack on her into a draw from the encounter deck.
Stage II and III place 2 and 3 per player threat when revealed.

### 2.3 Batroc (MC50 p. 11; 50087a)

1. Villain: Batroc (A), 8 hit points; (B), 12, in expert mode. One stage. **The players do not win by defeating him**
   (§3.5).
2. 50087a **Setup**: "Set each Rescued Captive ally aside. Put the Alert Level environment into play, Low side faceup.
   In expert mode, place 2[per_hero] threat on Alert Level." The four copies of 50091 are never in the encounter deck.
3. 1B: 6 per player. "When the last threat is removed from this scheme, advance to stage 2A" (§3.14).
4. 2B: 3 per player. Each time the last threat is removed a Rescued Captive enters play and the players choose:
   advance, or 3 per player more threat (§3.14).
5. 3A **When Revealed**: Alert Level on High → each player is dealt 1 facedown encounter card; on Low → remove all
   threat from it and flip it to High. Either way, 2 per player threat on Alert Level in expert mode.
6. 3B: 12 per player. Win at no threat; lose when completed (18 per player) or with no Rescued Captive in play.

### 2.4 M.O.D.O.K. (MC50 p. 13; 50104a)

1. Villain: M.O.D.O.K. (A), 10 hit points, retaliate 1; (B), 14, retaliate 2, steady.
2. 50104a **Setup**, in order: "Create the Holding Cell deck (see rulebook p. 13)": the four cards 50105–50108,
   shuffled, Holding Cell side faceup, "The top card of this deck is in play", and it enters play with 2 per player
   lock counters (§3.17). "Put 1 random Adaptoid environment into play (2 environments instead in expert mode) and set
   the others aside" (50109–50112). "Each player searches the encounter deck for a copy of Adaptoid and reveals it"
   (four copies of 50113; with four players all four are in play).
3. 1B: 1 per player, target 7 per player. Its completion is replaced (§3.18).
4. **Winning.** MC50 p. 13: free all four Inhuman allies, "and then … reduce M.O.D.O.K.'s hit points to zero". On the
   card: "if a Holding Cell is in play, remove 2 lock counters from it and reset … Otherwise, the players win the
   game."

### 2.5 Thunderbolts (MC50 p. 15; 50130a)

1. Villain: Citizen V (A), 12 per player; (B), 16 per player.
2. 50130a **Setup**: "Choose 1 modular set, plus 1[per_hero] additional modular sets, each with an Elite, Thunderbolt
   minion. Set each of those minions aside and shuffle the rest of their encounter sets into the encounter deck.
   Reveal the Justice, Like Lightning environment." Players + 1 sets from the pool of §1.10 (two to five of the box's
   six). The Thunderbolts set's own Jolt 50133 is a Thunderbolt but not Elite: she stays in the deck.
3. 50131a **When Revealed**: "Each player reveals a random set-aside Thunderbolt minion. Reveal and attach the
   remaining set-aside Thunderbolt minion faceup here. In expert mode, give each of these minions a tough status
   card. Flip this card." Players + 1 minions, so exactly one remains; revealing it resolves its When Revealed and
   keywords for the first player, and it is attached, not engaged (§3.21). The flip to Thunderbolt Backup is a flip,
   not a reveal.
4. 1B: 1 per player, target 11 per player.

### 2.6 Baron Zemo, standalone (MC50 pp. 18–19; 50167a)

1. Villain: Baron Zemo A1 (12, fixed); B1 (16, fixed) in expert mode.
2. Encounter deck: Baron Zemo (50170–50177), the three A.I.M. Interference cards of the Executive Board set
   (50184a–c), Scientist Supreme, S.H.I.E.L.D., Standard. **In a standalone game no Adaptoid, Adaptoid environment or
   surviving Thunderbolt is added**: those are the campaign's setup (MC50 p. 19, pass 1b).
3. 50167a **Setup**: "Prepare the evidence (see rulebook p. 18)." MC50 p. 18: "If you are **not** playing in campaign
   mode, follow the steps under 'Preparing the Evidence' on page 5": the nine evidence cards are split by kind into
   three piles of three; each pile is shuffled and one card of each goes, unseen, to the A.I.M. pile; the other six
   are shuffled together into the S.H.I.E.L.D. pile, unseen (§3.29).
4. "Put each Board Member environment into play. If not playing campaign mode, place 2 secret counters on each Board
   Member environment." The three environments also print the setup keyword; they enter play once.
5. 1B: 2 per player, target 12 per player, +2 per player. The Response at the end of each player phase gains evidence
   or advances (§3.29).
6. 2A, 2B, 3A, 3B: the accusation, its penalties, Zemo's flip to his Unmasked face with his sword, the mole attached
   to him and the threat for it (§3.26, §3.29). **The players win by defeating the Unmasked Zemo** (A2 and B2 have no
   reset).
7. **Losing:** 1B or 3B completed; three Board Member attachments in play (50181b–50183b; MC50 p. 19).

### 2.7 The modular sets of this pass

All ordinary modular sets with no setup step of their own: A.I.M. Abduction (50080–50082), A.I.M. Science
(50083–50085), Batroc's Brigade (50098–50102), Scientist Supreme (50125–50128), S.H.I.E.L.D. (50178–50180), and the six
Thunderbolt sets (50139–50164). A Thunderbolt set used in another scenario shuffles its Elite minion into the deck
with the rest. The Executive Board set as an extra set is §1.10.

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-09) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`trigger-events.ts`, `state.ts`, `effects.ts`, `keywords.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl`, the
content schema and the wave 8 spec. **Nothing of this wave is started: every row is "not started"**, and the word after
it says what kind of work it is: **exists (verify)** (found by name and doc comment, its behavior for this card not
run: the scripting agent proves it in a test before relying on it, and a failure becomes an extend here); **exists
(compose)** (several existing pieces, no engine change); **extend** (an existing primitive needs one more case);
**new**. Each section is one agent, one commit. Searches that found nothing are named, so nobody repeats them.

| §    | Primitive                                                                                         | Needed by                                                                    | Status (all not started) |
| ---- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| 3.1  | Vulnerable                                                                                        | 50083, 50093, 50094, 50098, 50125, 50126, 50172, 50178                       | new                      |
| 3.2  | Preparation: a labeled ability that is not a boost ability, resolved from the discard pile        | 50064–50066, 50068–50073, 50076–50079                                        | extend                   |
| 3.3  | An ability a rule gives to every encounter card that does not print one of that label             | 50070, 50074                                                                 | new                      |
| 3.4  | The attack in progress as a Preparation reads it; the villain's Forced Interrupt                  | 50064–50066, 50068, 50071–50073, 50076, 50079                                | extend                   |
| 3.5  | "Would be defeated … reset his hit points to N instead": fixed hit points, never defeated         | 50086a/b, 50103a/b, 50165a, 50166a, 50114–50119                              | exists (verify)          |
| 3.6  | All-purpose counters: any type, retyped by the card they land on, a uses card emptied by a move   | 50001a, 50002, 50005, 50007, 50011, 50024, 50029, 50030, 50031, 50033, 50113 | extend                   |
| 3.7  | Threat on a card that is not a scheme; threat removed from a card as a cost of a chosen size      | 50034a, 50035a/b, 50036–50046, 50059, 50090a/b                               | extend                   |
| 3.8  | A suit form: a permanent double-sided upgrade as an additional form; a forced change on attack    | 50034a/b, 50035a/b, 50037, 50038, 50059                                      | exists (verify)          |
| 3.9  | An attack that becomes a scheme; one threat of that activation placed elsewhere                   | 50035b                                                                       | extend                   |
| 3.10 | Deck building: an all-or-nothing off-aspect package; Team-Up with "Max 1 per deck"                | 50001b, 50024                                                                | exists (verify)          |
| 3.11 | A choice of cards capped by their combined printed cost                                           | 50004, 50005                                                                 | extend                   |
| 3.12 | Looking at every dealt encounter card and the top of the deck, and swapping them                  | 50051                                                                        | extend                   |
| 3.13 | An enemy attack on an ally: chosen by a superlative, redirected by the main scheme                | 50089b, 50096, 50120                                                         | exists (verify)          |
| 3.14 | Main scheme stages left by removing the last threat: forced, by choice, and a win at no threat    | 50087b, 50088b, 50089b                                                       | exists (verify)          |
| 3.15 | Allies the scenario owns: set aside, put into play under any player, not removable by abilities   | 50091, 50105b–50108b                                                         | exists (verify)          |
| 3.16 | An environment that holds threat, flips at a threshold and loses the game at one                  | 50090a/b, 50093–50097                                                        | exists (compose)         |
| 3.17 | A scenario deck whose top card is in play, flips to an ally and comes back to the bottom          | 50105a/b–50108a/b                                                            | extend                   |
| 3.18 | Environments that change every card of a title; a main scheme whose completion is replaced        | 50104b, 50109–50113                                                          | exists (compose)         |
| 3.19 | An ally held on a side scheme under no player's control                                           | 50121                                                                        | exists (verify)          |
| 3.20 | An ally that would leave play tucked under a scheme instead; X from a tucked card's printed cost  | 50080–50082, 50100, 50119                                                    | extend                   |
| 3.21 | A minion attached to an environment: in play, engaged with nobody, swapped as the round ends      | 50130b, 50131a/b                                                             | extend                   |
| 3.22 | Setup that picks sets by the minion they hold; each player reveals a random set-aside minion      | 50130a, 50131a                                                               | exists (verify)          |
| 3.23 | A villain that cannot be defeated below a victory display count; an activation given up to heal   | 50129a/b                                                                     | exists (verify)          |
| 3.24 | Every player engages the next player's minions at once                                            | 50135, 50136, 50164                                                          | extend                   |
| 3.25 | Damage that goes somewhere else: threat off a scheme, onto the attachment, back at the attacker   | 50092, 50117, 50146, 50149, 50154                                            | exists (compose)         |
| 3.26 | Board Members: named counters, a flip to an attachment on the villain, a loss at three            | 50181a/b–50183a/b, 50168b, 50169b                                            | extend                   |
| 3.27 | "Remove N counters from among" several cards; "the [card] with the fewest counters"               | 50165a, 50166a, 50170, 50172–50177                                           | extend                   |
| 3.28 | "You may spend X [type] resources to prevent X of …"                                              | 50175, 50184a–c                                                              | exists (verify)          |
| 3.29 | Evidence in a standalone game: two hidden piles, gained cards, the grid, the accusation           | 50167a/b, 50168a/b, 50169b, 50185–50193                                      | new                      |
| 3.30 | A hero from the collection in play as a minion                                                    | 50171                                                                        | extend                   |
| 3.31 | An additional cost to attack, thwart or defend with an ally                                       | 50173                                                                        | extend                   |
| 3.32 | Player-deck cards facedown as minions whose base stats an environment sets                        | 50030–50033                                                                  | exists (verify)          |
| 3.33 | Keywords and icons a rule gives to other cards, to cards being revealed, and takes away           | 50075, 50085, 50089b, 50093, 50094, 50101, 50144, 50060                      | exists (verify)          |
| 3.34 | An attachment's stat box on an identity, replaced under a trait; the two errata                   | 50153, 50156, 50159                                                          | exists (compose)         |
| 3.35 | Reusable as is                                                                                    | the rest (§7)                                                                | checked by name          |
| 3.36 | Specials resolved by count and by choice; a Special that discards its own card; on allies         | 51001a, 51002–51005, 51010–51013, 51022–51025, 51030                         | exists (verify)          |
| 3.37 | A card searched for in the deck and played at a reduced cost                                      | 51001b                                                                       | exists (verify)          |
| 3.38 | Threat a scheme loses placed on a minion; the minion taken as an ally by a linked attachment      | 51017, 51036                                                                 | exists (compose)         |
| 3.39 | Encounter cards tucked under an identity: a cap, tucks from the discard pile, "the same set"      | 52001a/b, 52002–52006, 52009–52012, 52029, 52030, 51018                      | exists (verify)          |
| 3.40 | A tuck sent somewhere else; a tucked card that answers its own discard                            | 52028, 52029, 52031                                                          | new                      |
| 3.41 | A revealed card swapped with a tucked card of its set                                             | 52008                                                                        | exists (verify)          |
| 3.42 | The top card of the encounter deck faceup; an ability refused when the visible card gives nothing | 53001a, 53002–53004, 53010, 53012                                            | extend                   |
| 3.43 | Cards discarded from the top of the encounter deck: a chosen cost, a trigger, a card handed on    | 51015, 53001a, 53002–53004, 53010, 53012, 53017, 53030, 53031, 53036         | extend                   |
| 3.44 | A response to a boost card being given: look at it and the deck top, and swap them                | 53005                                                                        | extend                   |
| 3.45 | An interrupt to an encounter card being dealt to a player                                         | 53009                                                                        | new                      |
| 3.46 | Payment: once per card paid for; the cards that paid; a tucked resource card anyone may spend     | 53006, 53018, 53021                                                          | extend                   |
| 3.47 | A hero that does not exhaust to defend                                                            | 53011                                                                        | extend                   |
| 3.48 | The number of different traits among a group of cards                                             | 53019                                                                        | extend                   |
| 3.49 | An attachment bound for the villain attached to another enemy; "the villain" on that card         | 53038–53040, 51040, 54030                                                    | new                      |
| 3.50 | An attachment that players attack "as if it were a minion"                                        | 54034, 54035                                                                 | new                      |
| 3.51 | Rulings, FAQ entries and errata on cards the engine already covers                                | 51007, 51038, 52016, 52034, 53008, 53023, 53034, 54004, 54033, the Team-Ups  | exists (verify)          |
| 3.52 | Reusable as is (pass 2)                                                                           | the rest (§7.9–§7.12)                                                        | checked by name          |

### 3.1 Vulnerable

> **Status: not started (new).** `"vulnerable"` is in `schema/keywords.ts` and the glossary only; a grep of
> `packages/engine/src` and `packages/cards/src/dsl` for "ulnerable" finds nothing. `effects.ts giveStatus` is "the only
> place a status card is put on a card", and `keywords.ts statusCapacity` already answers steady (2), stalwart and
> `cannotHaveStatus` (0).

**Cards.** A.I.M. Scientist 50083, Embassy Guard 50093, Embassy Patrol 50094, Machete 50098, Scientist Supreme 50125,
Monica Rappaccini 50126, S.H.I.E.L.D. Agent 50172, S.H.I.E.L.D. Trooper 50178. All minions; the rule is written for any
character.

**Rules.** RRG 1.8 "Vulnerable" (p. 48, text layer read): "When a character with vulnerable becomes confused or
stunned, that character is immediately discarded _(without being defeated)_." It "is equivalent to … 'Forced
Interrupt: When this character becomes confused or stunned, discard it.'" "If a character with the vulnerable keyword
would simultaneously take enough damage to defeat it and become either confused or stunned, it is discarded before
the damage is applied and is not considered defeated." "If a character has both the steady and vulnerable keywords,
the vulnerable keyword does not take effect until that character has two confused or two stunned status cards." MC50
p. 3 says the same in two sentences. RRG "'And'" (p. 7): effects joined by "and" resolve simultaneously.

**Plan.** A keyword rule in `giveStatus`, read once, for every status giver:

- A stunned or confused card that lands on a character with vulnerable and makes it stunned or confused (its first
  card of that type; its second with steady, read through `statusCapacity`) discards that character at once: the
  ordinary leave-play to its owner's discard pile (the encounter discard pile for a minion), with its attachments
  and tucked cards discarded as for any card leaving play. **Not a defeat**: no `characterDefeated`, no When Defeated,
  no victory display (the victory keyword is a When Defeated, RRG p. 46), no "defeating player". `cardLeavesPlay` is
  announced as usual. Log `vulnerableDiscarded { instanceId, status }`.
- A card that cannot leave play (`cannotLeavePlay`, permanent) stays and keeps the status card (RRG "'Cannot'",
  p. 11).
- A character with no room for the card (already stunned, stalwart) does not "become" stunned: nothing happens.
- **Simultaneous damage.** Within one instruction (an effects list up to a `then`), a status given to a vulnerable
  character resolves before damage dealt to that character, whatever the printed order: the character is gone before
  the damage is applied, so the damage finds no target, nothing is "dealt" to it and overkill has no excess.
- Gained and lost like any keyword (`KeywordGrantSpec`), so a later card can grant it.

**Tests (exact numbers).**

1. Embassy Guard (3 hit points) is stunned by a player card: it is in the encounter discard pile; Alert Level has
   the same threat as before (neither its own When Defeated, "Place 1 threat on Alert Level", nor Alert Level's
   "After a character is defeated" resolved); the log has `vulnerableDiscarded` and no `characterDefeated`.
2. Scientist Supreme (Victory –1) is confused: encounter discard pile, not the victory display; Diplomatic Immunity
   revealed next gets 0 acceleration tokens from her.
3. Machete is stunned: discard pile, not shuffled into the encounter deck (his When Defeated did not resolve).
4. S.H.I.E.L.D. Agent is stunned: no secret counter is added ("or is defeated" did not happen).
5. Prism Dust 50052 ("confuse that minion and deal 2 damage to it") on Embassy Patrol with 2 damage (1 remaining):
   discarded by the confused card, 0 damage dealt, not defeated, Alert Level unchanged.
6. An attack that deals 3 damage with overkill and stuns, against Embassy Guard: discarded, no excess damage to the
   villain.
7. A fixture minion with steady and vulnerable: the first stunned card stays (in play, holding 1); the second
   discards it.
8. A stunned card given to a vulnerable minion that already holds one (no room): nothing changes.
9. A.I.M. Scientist engaged with player 1 beside another minion ("cannot be attacked") is confused by a card that
   does not attack: discarded.

### 3.2 Preparation: a labeled ability that is not a boost ability, resolved from the discard pile

> **Status: not started (extend).** `AbilityTriggerSpec` has `boost` and `special`; `EffectSpec resolveSpecials`
> (`spec.ts`, `resolve/effects-frame.ts executeResolveSpecials`) resolves another card's printed abilities of one kind:
> `"special"`, `"whenRevealed"`, `"whenDefeated"`, `"forcedResponse"`. No "preparation" kind exists (a grep for
> "reparation" finds only the player trait, in `resolve/ability.ts` and `trigger-events.ts abilityResolved`).

**Cards.** The ten printed Preparation abilities of the Black Widow set (50068–50073, 50076–50079), resolved by the
villain's Forced Interrupt (50064–50066); the granted ones of §3.3.

**Rules.** MC50 p. 9: "Encounter cards in Black Widow's encounter set have 'Preparation' abilities in place of 'Boost'
abilities. These abilities are **not** resolved when the cards are turned faceup as boost cards. Instead, these
abilities are only resolved by the 'Forced Interrupt' on Black Widow's villain cards." The villain (scan 50064):
"discard the top card of the encounter deck and resolve each 'Preparation' ability on that card."

**Plan.**

- `AbilityTriggerSpec { kind: "preparation" }` and `resolveSpecials.which: "preparation"`. The boost step
  (`resolve/enemy-activation.ts`) reads only `boost` abilities, so a Preparation is never resolved from a boost card
  with no further rule; a test pins it.
- `resolveSpecials { which: "preparation", cards: <the discarded card> }` resolves on a card that is **in the
  encounter discard pile**. Inside the ability "this card" / "this minion" is that card, "you" is the resolving
  player (the attacker's controller, MC50 p. 9: "the attacking player discards"), and the attack in progress is the
  attack that triggered the villain (§3.4). The ability may move its own card out of the discard pile ("Attach this
  card to Black Widow", "put this minion into play engaged with you").
- `<bind>.resolved` is how many Preparation abilities resolved (printed and granted). The same number is added to
  the attack in progress (`labeledResolved.preparation`), read by §3.4's predicate.
- With several to resolve (a printed one never has company, but two granted ones do, §3.3), the resolving player
  orders them.

**Tests.** (1) Widow's Bite 50079 turned faceup as the villain's boost card: 2 boost icons counted, nobody is
stunned, no Preparation resolved. (2) `resolveSpecials` on Covert Ops 50077 in the discard pile with the main scheme
and one side scheme in play: 1 threat on each; `<bind>.resolved` is 1. (3) On Black Widow's Gauntlet 50068 in the
discard pile: it is attached to the villain (+1 ATK, retaliate 1) and no longer in the discard pile.

### 3.3 An ability a rule gives to every encounter card that does not print one of that label

> **Status: not started (new).** Searched `abilities.ts` and the DSL for a rule that gives a triggered ability to other
> cards (`gainsAbility`, `grantAbility`, `grantedAbilit`): nothing. `KeywordGrantSpec`, `TraitGrantSpec` and `gainsIcon`
> give keywords, traits and icons only; "this card gains: 'Interrupt …'" (Agents of S.H.I.E.L.D. 50015) is an ability of
> the card itself with a `while`.

**Cards.** Night Vision Goggles 50070: "Each encounter card without a printed 'Preparation' ability gains
'Preparation: Prevent all damage from this attack. Then, discard Night Vision Goggles.'" Automated Defenses 50074:
"… gains 'Preparation: Deal 1 damage to the attacking character.'"

**Plan.** `RuleSpec grantsLabeledAbility { which: "preparation", to: "encounterCardsWithoutPrinted", abilityId }`: a
constant on the card in play, naming a second registry entry (an ordinary `AbilityDefinition` with a `preparation`
trigger). `resolveSpecials { which: "preparation" }` on a card adds, for each such rule in play, the granted ability
when the card is an encounter card that prints no ability of that label. The granted ability resolves with the
discarded card as "this card" for the attack readers and **the granting card as the named card** ("discard Night
Vision Goggles" discards the attachment in play, not the discarded card). Both side schemes and attachments of the
villain's own set that print no Preparation (50074, 50075) gain it too when they are the discarded card.

**Tests.** Night Vision Goggles attached and Automated Defenses in play; the top card is a Standard set treachery:
the attacker takes 1 damage, the attack deals 0, Night Vision Goggles is discarded, `<bind>.resolved` is 2, in the
order the attacking player chose. The top card is A.I.M. Commando 50072 (prints one): only its own resolves; the
goggles stay. With neither rule in play and a Standard card on top: 0 resolved (and Black Widow's Gauntlet may be
discarded, §3.4).

### 3.4 The attack in progress as a Preparation reads it; the villain's Forced Interrupt

> **Status: not started (extend).** Found: `EventPattern` for a player `attack` with `targetIs`;
> `removeThreat { ignoreCrisis }` with `bind`; `discardEncounterCards`; `atEndOfAttack`; `TargetRef attackInProgress`
> and `currentAttack`; `modifyAttack` ("Prevent all damage from that attack", Mockingbird, written for an **enemy**
> attack); `retargetAttack { attack: "player" }` (wave 7 §3.66, written for a friendly character as the new target);
> `putIntoPlay`, `attach`, `giveStatus`. Missing: all damage of a **player** attack prevented, with the amount reported;
> a predicate over what resolved during the attack.

**Cards.** Black Widow 50064–50066; Black Widow's Gauntlet 50068; Stun Net 50071, A.I.M. Commando 50072, A.I.M. Grunt
50073, Attacrobatics 50076, Widow's Bite 50079; Night Vision Goggles 50070 (granted).

**Rules.** MC50 p. 9: "When a hero or ally attacks Black Widow (including with attack-labeled abilities), before that
attack is resolved, Black Widow's ability removes threat from the main scheme. If no threat is removed, then the rest
of her ability does not resolve. Otherwise, the attacking player discards the top card of the encounter deck and
resolves any 'Preparation' ability on the discarded card before resolving the attack. Damage dealt to Black Widow
that does not come from an attack does not trigger her 'Forced Interrupt.'" MC50 p. 22: "the stunned status replaces
the attack before Black Widow's 'Forced Interrupt' triggers." RRG "Crisis Icon" (p. 14): "Abilities on encounter
cards are not affected by the crisis icon", so the parenthetical on stage I ("ignoring any crisis icons in play",
absent from stages II and III, scans 50064–50066) is a reminder and all three stages behave alike. Ruling January 17,
2026 – Ruling 2 (the attack is resolved against A.I.M. Grunt; a defense event's prevention still reads the villain's
original attack).

**Plan.**

1. The villain's ability is a script: a forced interrupt to a player `attack` whose target is this card →
   `removeThreat(mainScheme, 1)` bound; if 0 was removed, stop; else `discardEncounterCards(1)` bound (an empty deck
   resets first, with its acceleration token) → `resolveSpecials { which: "preparation" }` on it. The removal is the
   villain's, not a thwart: no "after you thwart", no patrol or crisis check.
2. `modifyAttack { preventAll: true, bind }` accepted for a player attack in its interrupt window: the attack deals 0
   to every target, and `<bind>.amount` is the damage it would have dealt to the card whose ability asked (the
   villain), after its modifiers and before tough. "In expert mode, deal that much damage to the attacking character"
   (Attacrobatics) reads it.
3. `retargetAttack { attack: "player", character }` onto an enemy minion that entered play a moment ago (A.I.M.
   Grunt): verify; the old target takes nothing and its retaliate does not answer, the Grunt takes the damage.
4. `Predicate attackResolvedLabeled { which: "preparation", atLeast: 1 }` over the attack in progress or just
   finished, for Black Widow's Gauntlet ("if no 'Preparation' ability was resolved, discard this card _(after
   resolving the retaliate keyword)_"): a Hero Response to the attack, offered after retaliate has resolved.
5. "After this attack" (50071, 50072, 50079) is `atEndOfAttack`; "the attacking character" is the attack's attacker,
   a hero or an ally, and may have left play by then (the effect then does nothing).

**An attack with several targets** is §4.1 Q4 (default A: "this attack" is the whole attack).

**Tests (exact numbers).**

1. Two players, The Widow's Web at 4; a hero's basic attack (ATK 2) on Black Widow I: the main scheme is at 3, one
   card is discarded, its Preparation resolves, then 2 damage. With Destroy Evidence (crisis) in play: the same.
2. The main scheme at 0: nothing is discarded, the attack deals 2, and Black Widow's Gauntlet's response is offered.
3. A stunned hero "attacks": the stunned card is discarded, the main scheme keeps its threat, no card is discarded.
4. An event that deals 4 damage to her without the attack label: no trigger.
5. Attacrobatics discarded, a 5-damage attack: 0 dealt; in expert mode the attacker takes 5.
6. A.I.M. Grunt discarded, a 3-damage attack: the Grunt (5 hit points, guard) is in play engaged with the attacker
   with 3 damage; Black Widow has taken 0; with the Gauntlet attached, no retaliate damage.
7. A.I.M. Commando discarded while the attacker's player is in hero form: after the attack it is put into play
   engaged and its quickstrike attack follows (RRG "Quickstrike", p. 36: "After a minion with the quickstrike keyword
   engages a player").
8. Stun Net discarded and the attacker is an ally: after the attack the net is attached to that ally, which cannot
   attack; any player's "Hero Action: Exhaust a character you control → discard this card" removes it.
9. Widow's Bite discarded, the attacking ally is defeated by retaliate first: nobody is stunned.

### 3.5 "Would be defeated … reset his hit points to N instead": fixed hit points, never defeated

> **Status: not started (exists, verify).** `on` patterns for "would be defeated" with `instead` (`resolve/defeat.ts`,
> wave 3 §3.1; wave 8 §3.20), `setRemainingHitPoints` / the DSL's `resetHitPoints`, `TriggerEvent hitPointsReset` and
> `on.hitPointsReset` (wave 6 §3.67, MaGog), `endGame`. A fixed `ScalingValue` for villain hit points. Not run for a
> villain that is never defeated at all.

**Cards.** Batroc 50086a/b ("reset his hit points to 8 [12] instead. Then, remove 6 threat from the main scheme");
M.O.D.O.K. 50103a/b ("if a Holding Cell is in play, remove 2 lock counters from it and reset M.O.D.O.K.'s hit points
to 10 [14] instead. Otherwise, **the players win the game**"); Baron Zemo 50165a / 50166a ("reset his hit points to 12
[16] instead. Remove 3 secret counters from among Board Member environments"); the attachments that answer the reset,
"Forced Response: After M.O.D.O.K.'s hit points are reset, discard this card" (50114, 50115, 50116, 50118, 50119).

**Rules.** MC50 p. 4, "Non-Scaling Villain HP", and its note: "These 'Forced Interrupt' effects replace the defeating
of the villain, so the villain has not been defeated for the purpose of other card effects" (repeated in the FAQ,
p. 22). RRG "'Would'" (p. 48), "Replacement Effect" (p. 37), "Hit Points" (p. 22). MC50 p. 22: "Overkill damage is
simultaneous with the damage from the attack, so the 'Forced Interrupt' on M.O.D.O.K. resolves first because it uses
the word 'would.' Then, the 'When Defeated' ability of the Adaptoid resolves."

**What to verify.** The villain keeps every status card, attachment and counter through the reset; damage past zero
is lost; no `characterDefeated`, no stage advance, no "defeating player"; "if this attack defeats an enemy" is false;
`hitPointsReset` is announced once; Batroc's "Then, remove 6 threat" is the villain's removal (not a thwart, no
crisis check, RRG p. 14) and can remove the last threat (§3.14); M.O.D.O.K.'s "Otherwise" branch ends the game with
no reset; a "+X hit points" attachment and the reset (§4.1 Q3).

**Tests (exact numbers).**

1. Batroc (A) with 6 damage and a stunned card, two players, stage 1B at 12, Heightened Reflexes with 2 leap
   counters; a 5-damage attack: 0 damage on him (8 remaining), stunned card and attachment kept, main scheme 6, no
   threat on Alert Level from "After a character is defeated", Concentrated Fire's "If this attack defeats an enemy"
   not met.
2. The same with stage 1B at 4: all 4 removed, the scheme advances to 2A.
3. M.O.D.O.K. (A), two players, Holding Cell with 4 lock counters: 2 left, hit points 10. With 1 lock counter: it is
   removed, the cell flips to its ally (§3.17), the next cell enters with 4, hit points 10.
4. M.O.D.O.K. with no Holding Cell in play (all four allies freed): the players win; his hit points are not reset.
5. An overkill attack that defeats an Adaptoid and takes M.O.D.O.K. to 0: his interrupt first (2 lock counters),
   then the Adaptoid's When Defeated (1 more counter from an environment).
6. Baron Zemo A1, the three Board Members at 2, 2 and 0 secret counters: the first player removes 3 from among them
   (§3.27), hit points 12. With only 2 counters in play: both removed.
7. Hostage Situation in play ("M.O.D.O.K. cannot take damage"): an attack deals 0 and nothing resets.

### 3.6 All-purpose counters: any type, retyped by the card they land on, a uses card emptied by a move

> **Status: not started (extend).** `CardInstance.counters: Record<string, number>`; `addCounters`, `removeCounters`
> (`counterType` absent removes every counter of every type) and `moveCounters { from, to, counterType? }` (moves
> **all**, "never empties a uses card", wave 5 §3.3); the `uses` keyword's `counterType`; `countersPlaced` /
> `countersRemoved` and "the last [type] counter is removed" (`abilities.ts`, citing Holding Cell). Missing: one counter
> "of any type", a counter that takes its new card's type, a move of N.

**Cards.** Maria Hill 50001a ("Move 1 all-purpose counter from a S.H.I.E.L.D. support to another S.H.I.E.L.D.
support"); "place 1 all-purpose counter on a S.H.I.E.L.D. support" (Nick Fury 50002, Reinforcements 50005, Special
Funding 50007, S.H.I.E.L.D. Director 50011, Super Spies 50024, Army of the Controlled 50031); "remove 1 all-purpose
counter from …" (Press Conference 50029, Controller 50030, Diabolical Discs 50033, Adaptoid 50113: "from an
environment").

**Rules.** RRG "All-Purpose Counter" (p. 6): "An ability that refers to an 'all-purpose counter' can refer to any
all-purpose counter, regardless of what other types that counter might have." "When an all-purpose counter is moved
from one card to another, it loses any previous type it had and gains the type defined on the new card it occupies.
If the new card does not define a type, it is considered only an 'all-purpose counter.'" MC50 p. 4 extends it to
placing. Ruling January 26, 2026 – Ruling 2. RRG "Uses (X 'Type')" (p. 46): "When the last all-purpose counter is
removed from a card with uses, discard that card", equivalent to "If there are no all-purpose counters on this card,
discard this card."

**Plan.**

- `definedCounterType(card)`: its `uses` keyword's type, else the one entry of `definedCounterTypes` (§1.6), else
  the plain key `"allPurpose"`. A card defining several (none in this pass) asks the placing player.
- `addCounters { counterType: "allPurpose" }` and every counter that arrives by a move land as the destination's
  defined type.
- `counterType: "any"` on `removeCounters`, `moveCounters`, `ValueSpec counters` and the "has a counter" query: any
  counter of any key. When the card holds several types and fewer are taken than it holds, the acting player picks
  which.
- `moveCounters { amount?: ValueSpec }`: that many (absent: all, as today).
- **A uses card left with no counters by a move is discarded** (RRG p. 46's constant ability), as by a removal. This
  replaces wave 5's "never empties a uses card"; the two cards that rule was written for (a main scheme, SP//dr's
  suit) do not have uses.
- A move announces `countersPlaced` on the destination (a Board Member attachment's "After a secret counter is
  placed here" hears a counter that arrives by any means) and logs `countersMoved` with both types.

**Tests (exact numbers).** The Iliad (3 mission) and Support Staff (3 staff): Reassignment moves 1 → 2 mission, 4
staff. To Sky-Destroyer 50057 (defines no type): it holds 1 `allPurpose` counter, which a second Reassignment next
round moves to The Iliad as a mission counter. Command Team with 1 command counter: moving it away discards Command
Team. Nick Fury 50002 thwarts: 1 counter on The Iliad makes 4 mission counters, and it can be used four times.
Press Conference with Support Staff at 1 staff, The Iliad at 3 and Sky-Destroyer at 0: Support Staff is discarded,
The Iliad has 2, nothing else changes. An Adaptoid is defeated with a Holding Cell at 4 lock counters: 3. Reassignment
is refused a second time in one round ("Limit once per round").

### 3.7 Threat on a card that is not a scheme; threat removed from a card as a cost of a chosen size

> **Status: not started (extend).** Every `CardInstance` has a `threat` number; `placeThreat`, `removeThreat`,
> `moveThreat` and `preventThreat` exist and are written for schemes (thwart, crisis, patrol and target-validity checks
> in `resolve/apply-effect.ts` and `resolve/target-validity.ts`). `AbilityCost` has fixed counter spends and, since wave
> 8 §3.62, a resource cost of a chosen size. No search found threat held by an upgrade or environment.

**Cards.** Nick Fury's suit form upgrade 50035a/b holds threat: placed by 50034a, 50037, 50041, 50024; moved onto it
from a scheme by 50036, 50038, 50046 and, in place of the main scheme, by 50035b and 50043; removed as a cost by
50035a (up to 3), 50040 (1), 50044 (up to 2), 50045 (1); read by 50059. Alert Level 50090a/b holds threat (§3.16).

**Rules.** No glossary entry limits threat tokens to schemes; the cards say "place 1 threat on your suit form
upgrade". RRG "Flip" (p. 20): a card that flips to a face of the same type "retains all attached cards, tucked cards,
status cards, and tokens". RRG "Crisis Icon" (p. 14) and "Patrol" (p. 32) speak of the main scheme only.

**Plan.**

- (a) `placeThreat`, `removeThreat` and `moveThreat` take any in-play card a ref names. On a card that is not a
  scheme the threat is only tokens: never a thwart, no crisis, patrol or "threat cannot be removed" check, not
  counted by anything that counts schemes or their threat, never a target of "remove N threat from a scheme", no
  defeat at 0. `moveThreat { from: scheme, to: card }` removes from the scheme under the scheme's own rules (crisis
  and so on apply to that half when a player card does it) and places what was removed. Logged `threatPlaced` /
  `threatRemoved` with the card's id as today.
- (b) `AbilityCost removeThreat { from: TargetRef, amount: number | { choose: { min, max } } }`, with the amount
  paid bound for the effect ("for each threat removed this way"). `min` is 1: a cost that removes nothing cannot be
  paid (RRG "Cost", p. 13).

**Tests (exact numbers).** Nick Fury's basic thwart for 2 on a scheme at 5: the scheme has 3 and Gather Intel puts 1
on the suit. Maria Hill 50036 thwarts for 2: the scheme has 3, the suit gains 2. Covert Surveillance on a scheme with
1 threat in Stealth: 1 removed, 1 placed. Assault with 4 threat: remove 3 → a basic attack deals 2 + 3 = 5, the suit
has 1. Fury's Watch with 1 threat: at most 1 removed, 1 mental resource. Fury's Flying Car with 0 threat on the suit:
cannot be used. A player's "Remove 2 threat from a scheme" is not offered the suit or Alert Level. A flip from Stealth
to Assault with 4 threat: still 4. Discovered with 3 threat: 3 damage or remove all 3; with 0, surge.

### 3.8 A suit form: a permanent double-sided upgrade as an additional form; a forced change on attack

> **Status: not started (exists, verify).** `changeAdditionalForm { formType, formName }` (`resolve/apply-effect.ts`),
> `select.ts additionalFormCards`, `Predicate inAdditionalForm`, the log's `additionalFormChanged`, `formChanging` /
> `formChanged`, `cannotChangeForm`; the form keyword's doc already cites "Suit form." (`schema/keywords.ts`). Wave 4
> §3.1 built it and `mut_gen`'s Solid / Phased use it; never run for a form changed by a Forced Interrupt in an attack's
> own window.

**Cards.** Nick Fury 50034a ("Break Cover — Forced Interrupt: When you attack, change to Assault suit form"), 50034b
("Suit Up — Setup: Put your suit form upgrade into play, Assault side faceup"; "Infiltrate — Action: Change to
Stealth suit form"), Assault / Stealth 50035a/b ("Suit form. Permanent."), Concentrated Fire 50037, Covert
Surveillance 50038, Discovered 50059.

**Rules.** RRG "Form, Change Form" (p. 21): "Cards with the '[type] form' keyword grant an identity unique forms."
MC50 p. 3: changing an additional form "does not count against the once-per-turn limit on flipping from hero to
alter-ego (or vice versa), but it does count as changing form for the purpose of triggering card effects." RRG
"Permanent" (p. 32).

**What to verify.** The upgrade is set aside as a permanent card, outside the 40 counted cards, and enters play from
the Setup ability; a change to the form the player is already in changes nothing and announces nothing; Break Cover
fires on a basic attack and on an attack event, before Assault's own "Interrupt: When you attack" is offered, so the
threat banked in Stealth can be spent on the attack that broke cover; the flip keeps threat (§3.7).

**Tests.** In Stealth with 4 threat, a basic attack: Assault is faceup, 4 threat, the interrupt is offered. In
Assault, a second attack: no `additionalFormChanged`. Infiltrate in alter-ego form: Stealth, and the round's ordinary
form change is still available. Covert Surveillance in Assault: 2 removed and "you may change to Stealth".

### 3.9 An attack that becomes a scheme; one threat of that activation placed elsewhere

> **Status: not started (extend).** `enemyActivating` and the "would attack" marker (`abilities.ts`),
> `replaceTriggeringEvent`, `enemyScheme`, `RuleSpec schemeThreatDestination` (all of an enemy's scheme threat to a
> named scheme), and "this activation removes threat instead of placing it", read at the scheme's place-threat step
> (`resolve/apply-effect.ts`; Informant 50050 uses it as is). Missing: part of one activation's threat sent to a card.

**Cards.** Stealth 50035b (scan): "Forced Interrupt (Hero): When an enemy would attack you, it schemes instead. Place
1 threat from that activation here instead of on the main scheme if there is 5 or less threat on this card."

**Rules.** MC50 p. 22: "the Stealth upgrade prevents the threat it places on itself from being placed on the main
scheme"; "Status cards take priority over all other effects, so the villain will remove the stunned status instead
of activating"; "Because the attack Nick is defending has already initiated when he defends, the 'Forced Interrupt'
… does not trigger". RRG FAQ "Stealth (#35)" (p. 65): "The interrupt ability of Stealth causes the villain activation
to reinitiate, this time as a scheme activation, so the confused status will cancel that activation (and Nick Fury
does not get to place any threat on his suit form upgrade)." Ruling December 17, 2025 – Ruling 3: only when Nick
Fury himself would be attacked. RRG "'Would'" (p. 48).

**Plan.** The script is a forced interrupt to an enemy attack that "would" target the controller's identity, hero
form only, replaced by `enemyScheme` of that enemy with a new option
`divert: { amount: 1, to: self, if: threat on self ≤ 5 }`. At the place-threat step, up to `amount` of the threat
that would go **on the main scheme** goes to the card instead; nothing is diverted from threat a rule already sends
to a side scheme, or when the activation places none. The replaced attack never happened (no boost card was dealt
for it; the scheme deals its own); the scheme is an ordinary activation, so a confused card cancels it and "after
[enemy] schemes" abilities answer it. A stunned enemy's own "would attack" replacement comes first (MC50 p. 22).

**Tests (exact numbers).** Villain SCH 2, a boost card with 1 icon, Stealth with 5 threat: 2 on the main scheme, 1
on Stealth (6), no attack. Next activation, Stealth at 6: 3 on the main scheme. A confused villain: the confused card
is discarded, no threat anywhere, no attack. A stunned villain: the stunned card is discarded, no scheme, Stealth
unchanged. A.I.M. Jailer (SCH 0) would attack: it schemes for 0 and nothing is placed or diverted. Leviathan Soldier
would attack: it schemes and its "After Leviathan Soldier schemes, deal 1 damage" resolves. An enemy attacks player
2 and Nick Fury is declared the defender: the attack resolves. An enemy attacks an ally Nick controls: the attack
resolves. Extract Captives 3B in play: Stealth's "would" resolves first and no captive is attacked.

### 3.10 Deck building: an all-or-nothing off-aspect package; Team-Up with "Max 1 per deck"

> **Status: not started (exists, verify).** `IdentityDeckbuilding.offAspectPackages` (`schema/cards/identity.ts`,
> written from this FAQ) and its checks in `engine/src/deck.ts` (`matchesOffAspectPackage`); Team-Up deck and play
> checks (an earlier wave). Not run: no emitted identity sets the field.

**Rules.** RRG FAQ "Maria Hill (#1B)" (p. 64, checked): "Can I include just one or two S.H.I.E.L.D. supports from
aspects other than my chosen aspect in my Maria Hill deck? A: No, Maria Hill's ability is all or nothing. You must
include the maximum number of copies of each of exactly three S.H.I.E.L.D. supports from aspects other than your
chosen aspect, or else you cannot have any S.H.I.E.L.D. supports from other aspects in your deck." RRG "Team-Up"
(p. 43).

**Tests.** Maria Hill / Leadership with The Bellerophon, The Douglass and The Pericles (one copy each, unique): legal
(MC50 p. 7's starter deck). With two of them: refused. With four titles: refused. With a three-copy off-aspect
S.H.I.E.L.D. support at two copies: refused; at three: legal. A basic or Leadership S.H.I.E.L.D. support does not
count toward the three. Another identity with one of them off-aspect: refused as today. Super Spies: refused in a
deck whose identity is neither Maria Hill nor Nick Fury; a second copy refused; in play, unplayable until both named
characters are in play (Maria Hill's deck has the Nick Fury ally 50002, Nick Fury's the Maria Hill ally 50036).

### 3.11 A choice of cards capped by their combined printed cost

> **Status: not started (extend).** `chooseCards` has `count`, `upTo` and filters; `ValueSpec totalPrintedCost` sums a
> ref. A grep for `maxTotal`, `combinedCost`, `totalCostAtMost` finds nothing.

**Cards.** On the Double 50004: "Ready any number of S.H.I.E.L.D. supports with a combined printed cost of 6 or
less." Reinforcements 50005: "Choose any number of S.H.I.E.L.D. supports with a combined printed cost of 6 or less.
Place 1 all-purpose counter on each."

**Plan.** `chooseCards { …, maxTotal: { of: "printedCost", atMost: 6 } }`: the choice offers only cards that still
fit under the cap as picks are made. Any player's supports (the cards do not say "you control").

**Tests.** The Iliad (6) alone: allowed. Support Staff (1), Command Team (2) and Sky-Destroyer (3): allowed, total 6.
The Iliad and Support Staff: the second is not offered. On the Double with every S.H.I.E.L.D. support ready:
cannot be played (nothing would change).

### 3.12 Looking at every dealt encounter card and the top of the deck, and swapping them

> **Status: not started (extend).** `lookAt` (wave 5; PR #75) reads a deck's top cards; `swapCards` exchanges two cards;
> `passEncounterCard` (wave 8 §3.75) moves a dealt card between players. Nothing looks at dealt cards.

**Cards.** Intelligence 50051: "Response: After a player is dealt an encounter card, discard Intelligence → look at
each encounter card dealt to each player and the top card of the encounter deck. You may swap any number of those
cards."

**Plan.** `lookAt` over a list of positions (each player's facedown dealt cards, the top of the encounter deck),
shown to the acting player only, then a `rearrange` choice: the same cards are assigned back to the same positions
in any arrangement. Every player keeps the number of cards they were dealt; the cards stay facedown and nothing is
revealed or shuffled. Logged with the positions, and the faces only in the acting player's view.

**Tests.** Player 1 holds X, player 2 holds Y, Z is on top: after the choice player 1 holds Z, player 2 holds X and
Y is on top; counts 1, 1, 1. Choosing no swap is allowed and Intelligence is still discarded.

### 3.13 An enemy attack on an ally: chosen by a superlative, redirected by the main scheme

> **Status: not started (exists, verify).** `enemyAttack.targetCharacter` ("attacks the hero or ally with the highest
> ATK", Clash of the Titans), `retargetAttack` for an enemy attack (Crossfire, wave 4 §3.21), `superlative`, overkill
> past an ally to its controller's identity. Not run with the attacked ally under a player other than the one the enemy
> is engaged with, nor as a blanket rule on a main scheme.

**Cards.** Leaping Kick 50096 ("Batroc attacks the ally with the most remaining hit points. This attack gains
overkill. If there were no allies in play, Batroc attacks you"); A.I.M. Jailer 50120 ("attacks the Rescued ally with
the fewest remaining hit points. Otherwise, place 1 lock counter on a Holding Cell"); Extract Captives 3B 50089b
(scan: "Forced Interrupt: When an enemy attacks, it attacks a Rescued Captive instead").

**Rules.** MC50 p. 4, "Attacks Against Allies": undefended damage goes on the attacked ally; boost abilities' "you"
is the ally's controller; "Players may defend these attacks as normal by declaring a hero or an ally as the
defender"; overkill past a defeated ally "is dealt to the identity of the player who controlled the defeated ally".
RRG "Attack (Enemy Activation)" (p. 8). RRG "First Player" (p. 19): "If an encounter card targets a specific player
or card, and there are multiple eligible targets, the first player selects among the eligible options" (which
captive; a tie for most or fewest). Whether "attacks you" abilities answer such an attack is **§4.1 Q5**.

**Tests (exact numbers).** Leaping Kick with allies at 3 and 5 remaining hit points under two players: the 5 one is
attacked, and its controller is the attacked player. Batroc ATK 2 with a 3-icon boost card against an undefended
ally with 3 remaining: defeated, 2 excess to its controller's identity, 1 threat on Alert Level from Batroc's own
"After Batroc attacks" and 1 more for the defeated ally. Extract Captives 3B with two captives in play: the first
player picks one for each enemy attack; a quickstrike attack is redirected too; a hero may still defend it. A.I.M.
Jailer with no Rescued ally in play: 1 lock counter on the Holding Cell.

### 3.14 Main scheme stages left by removing the last threat: forced, by choice, and a win at no threat

> **Status: not started (exists, verify).** "When the last threat is removed from this scheme, advance" (The Missing
> Milano 1B, wave 3 §3.37), `MainSchemeCard.completionLoses` (its doc already lists 50087b and 50088b),
> `advanceMainScheme`, `stateCheck` with `endGame`, `chooseOne`, `putIntoPlay` under a chosen player.

**Cards.** 50087b ("advance to stage 2A"); 50088b (scan: "put 1 set-aside Rescued Captive ally into play exhausted
under any player's control. The players may advance to stage 3A. If they do not advance, place 3[per_hero] threat
here"); 50089b (scan: "If there is no threat here, the players win the game. If this stage is completed or there are
no Rescued Captive allies in play, the players lose the game").

**What to verify.** The last threat removed by anything counts (a thwart, the Rescued Captive's action, Batroc's
reset). On 2B the choice is one `chooseOne` for the group, answered by the first player; with no captive left set
aside none enters and the choice is still offered. 3B's two sentences are state checks that begin when 3B is the
faceup stage, so a stage 3B that turns up with no captive in play is lost at once ("will need at least 1 Rescued
Captive to survive"). A stage left this way is not "completed".

**Tests (two players).** 1B at 12: remove 12 → 2B with 6. Remove 6 → one captive in play exhausted under the chosen
player; "stay" → 6 threat; again → a second captive; "advance" → 3A resolves (§2.3), 3B has 24 and a target of 36.
Remove 24 → the players win. 36 threat → loss. The last captive defeated at 3B → loss. Five times through 2B: the
fifth time no captive enters.

### 3.15 Allies the scenario owns: set aside, put into play under any player, not removable by abilities

> **Status: not started (exists, verify).** `excludedFromAllyLimit`, `cannotLeavePlay { by: "cardAbilities" }` ("A
> defeat is not read by this form"), negative victory values, `takeIntoHand` / `putIntoPlay` for an ownerless scenario
> ally (wave 2 §3.10).

**Cards.** Rescued Captive 50091 (scan: cost dash, THW 1, ATK 1, 5 hit points; "Victory –1. Does not count against
your ally limit. Card abilities cannot remove this ally from play. Hero Action: Exhaust Rescued Captive → remove
1[per_hero] threat from the main scheme"); the four Inhuman allies 50105b–50108b ("Does not count against your ally
limit").

**What to verify.** Damage still defeats a captive and it goes to the victory display; "discard an ally you control"
cannot choose it; it can be exhausted, readied, healed, attacked and defended with as any ally. Its action is an
action on a card a player controls, and removes threat from the main scheme only.

### 3.16 An environment that holds threat, flips at a threshold and loses the game at one

> **Status: not started (exists, compose)**, on §3.7 (a). `stateCheck`, `flipCard` / `flipToOtherFace`, `faceNamed`,
> per-face traits, `StatModifierSpec`, `characterDefeated`, an action on an uncontrolled card (the active player's).

**Cards.** Alert Level 50090a (scan: "If there is at least 4[per_hero] threat here, remove all threat from here and
flip this card. Forced Response: After a character is defeated except by consequential damage, place 1 threat here.
Hero Action: Spend 1 resource of any type → remove 1 threat from here") and 50090b ("Batroc gets +1 SCH and +1 ATK.
If there is at least 4[per_hero] threat here, the players lose the game", with the same two abilities). Read by
50086a/b, 50087a, 50089a, 50093–50095, 50097.

**Rules.** Rulings January 26, 2026 – Ruling 4 (2) and April 30, 2026 – Ruling 3 (3): the flip is not a reveal, so
nothing that cancels or answers a reveal applies. "A character" is any ally or minion, any player's (Batroc is never
defeated, §3.5); a vulnerable minion that is discarded is not defeated (§3.1).

**One point to verify.** `characterDefeated` must say whether consequential damage defeated the character, for the
"except" clause.

**Tests (two players, threshold 8).** Low at 7, a minion is defeated: 8 → all threat removed, High faceup, Batroc
SCH 2 and ATK 3. High at 7, an ally is defeated by an attack: 8 → the players lose. An ally defeated by its own
consequential damage: no threat. Expert setup: Low starts at 4. Security Cameras in hero form with two characters,
on High: each is exhausted or 2 threat is placed. Commandeer Security Office defeated: 2 threat removed from Alert
Level.

### 3.17 A scenario deck whose top card is in play, flips to an ally and comes back to the bottom

> **Status: not started (extend).** `GameState.scenarioDecks` (`ScenarioDeckState`: deck, discard, `whenEmpty`,
> `contents.cardIds`), `buildScenarioDeck`, "the last [type] counter is removed" (cites 50105a), a counted per-player
> "enters play with". Missing: a deck whose top card is a card in play.

**Cards.** Holding Cell / Flying Inhuman 50105a/b, / Psionic Inhuman 50106a/b, / Sarah Garza 50107a/b, / Strong
Inhuman 50108a/b; A.I.M. Jailer 50120; M.O.D.O.K. 50103a/b.

**Rules.** MC50 p. 13: "shuffle together the four double-sided Holding Cell cards … Place this deck near the main
scheme with its Holding Cell side faceup. The top card of this deck is in play. When a Holding Cell enters play,
either during setup or when the last lock counter is removed from the previous top card …, the text on the Holding
Cell places 2[per_hero] lock counters on that card." MC50 p. 22: "The Inhuman ally that leaves play flips over and
becomes the only card in the Holding Cell deck. Resolve the 'enters play' text on its Holding Cell side." RRG "Flip"
(p. 20).

**Plan.** `ScenarioSeparateDeck.topCardInPlay: true`: the deck's first card is an in-play instance (an environment
under no player's control); the others are out of play and hidden. When the top card leaves the deck the next one
enters play (its "Enters play with 2[per_hero] lock counters" resolves); when a card is put on the bottom of an
empty deck it is the top card and enters play. The cell's Forced Interrupt flips it (a different card type: nothing
is carried over), takes it out of the deck and puts the ally into play under the control of a player the first
player chooses. The ally's "After this card leaves play, flip it and place it on the bottom of the Holding Cell
deck" takes it from wherever it went. The alternative costs ("Spend [energy] [energy] resources or 3 resources of
any type") are verified against `ResourcesChoice`.

**Tests (two players).** Setup: one cell in play with 4 lock counters, three cards under it. Four uses of its Hero
Action: the cell flips, its ally is in play ready under the chosen player, the next cell has 4. The ally is
defeated: it is the deck's bottom card, Holding Cell side up, not in a discard pile. All four freed and the deck
empty: no Holding Cell is in play (M.O.D.O.K.'s win branch is live); Strong Inhuman is then defeated: it is the
deck's only card, in play with 4 lock counters, and the win branch is closed again. Psionic Inhuman thwarts: 1 lock
counter off the cell.

### 3.18 Environments that change every card of a title; a main scheme whose completion is replaced

> **Status: not started (exists, compose).** `StatModifierSpec`, `KeywordGrantSpec`, `TraitGrantSpec` and
> `attackKeywords` over a query; a random set-aside card put into play; `mainSchemeCompleting` with `instead`
> (`trigger-events.ts` and the DSL cite 50104b); `shuffleEncounterDeck`; `endGame`.

**Cards.** Flying / Psionic / Sarah Garza / Strong Upgrade 50109–50112 ("Each Adaptoid gets +1 SCH, gains incite 1,
and gains the Aerial trait" and the like); Upgrading Adaptoids 1B 50104b (scan); Adaptoid 50113; "It's Alive!" 50123.

**What to verify.** "Each Adaptoid" is every minion with that title, in play or being revealed (incite is a reveal
keyword). A keyword gained by a minion already in play gives no status card (toughness answers entering play). The
count: in standard mode one upgrade starts in play and three are set aside, so the first and second completion add
one each and **the third leaves none set aside and loses the game**; in expert mode the second does.

**Tests.** Strong and Sarah Garza upgrades in play: an Adaptoid is ATK 3, Elite and Brute, its attacks have overkill
and ranged, and a newly revealed one has a tough status card. Two players, 1B at 14 in the villain phase: an upgrade
enters, the threat goes to 0, the Adaptoids in the discard pile are shuffled into the deck.

### 3.19 An ally held on a side scheme under no player's control

> **Status: not started (exists, verify).** An ally with no controller (wave 8 §3.34), `attach` to a scheme, `detach`
> with a taker ("The first player detaches Odin from the main scheme and takes control of him", `mts` 21141),
> `defeatingPlayer`, `cannotTakeDamage`.

**Cards.** Hostage Situation 50121: "M.O.D.O.K. cannot take damage. When Revealed: Attach 1 Rescued ally faceup
here. Attached ally is under no player's control. _(Attached ally is still in play.)_ When Defeated: The defeating
player takes control of attached ally."

**What to verify.** The first player picks the ally (RRG p. 19); with no Rescued ally in play nothing is attached
and the scheme still stops the damage. The held ally keeps its damage and upgrades, cannot be used by anyone, and
readies with nobody. **Flagged for `encounter-ai-designer`:** an enemy attack needs an attacked player (RRG p. 8), so
by default the held ally is not a candidate for A.I.M. Jailer's attack; say so in the script's test or raise it.

### 3.20 An ally that would leave play tucked under a scheme instead; X from a tucked card's printed cost

> **Status: not started (extend).** `tuckCards`, `tucked` / `tuckedUnder`, `ValueSpec printedCost`,
> `addAccelerationToken`, `discardDeckUntil`, `setDefeatDestination`, the `cardLeavesPlay` interrupt, a defeated side
> scheme "in play until its When Defeated ability resolves" (ruling January 11, 2026 – Ruling 1). Missing: a rule that
> sends any leaving card of a kind under a card, whatever made it leave.

**Cards.** Abduct Superhumans 50081 ("Forced Interrupt: When an ally leaves play, tuck it under here and place
threat here equal to its cost. Then, place 1 acceleration token here. When Defeated: Put each ally tucked here into
play under its owner's control"); A.I.M. Abductor 50080; Nabbed! 50082; Zaran 50100 and Reverse Engineering 50119
(X is the printed cost of the tucked card).

**Rules.** RRG "Tuck" (p. 45) and MC50 p. 3: "The tucked card is not in play. When a card leaves play, any cards
tucked under it are discarded." RRG "Leaves Play" (p. 27).

**Plan.** `EffectSpec replaceLeaveDestination { to: { tuckedUnder: TargetRef } }` from an interrupt to
`cardLeavesPlay`: defeat, discard, a return to hand or deck all end under the scheme; the ally still left play (its
own "when defeated" and "after … leaves play" abilities resolve), and it is not in a discard pile. A card that
"cannot be removed from play by card abilities" is not moved by this rule when an ability made it leave, and a
card with its own destination (victory, the Holding Cell deck) keeps it: two replacements of one move are ordered
by the first player and the second finds nothing to replace (RRG "'Would'", p. 48).

**Tests.** A cost-3 ally is defeated with the scheme at 2: tucked, 5 threat, 1 acceleration token. Slingshot 50013
returned to hand at the end of the phase: tucked instead, +3 threat. The scheme is defeated with two allies under
it: both enter play ready and undamaged under their owners, and "after … enters play" responses are offered. Nabbed!
with an ally fourth from the top (cost 2): three cards discarded, the ally tucked, +2 threat, 1 token. Zaran with a
cost-3 upgrade tucked: ATK 4; he is defeated: the upgrade goes to its owner's discard pile.

### 3.21 A minion attached to an environment: in play, engaged with nobody, swapped as the round ends

> **Status: not started (extend).** A minion engaged with nobody that never activates (wave 8 §3.41, the mission area),
> `engage`, `swapCards`, `superlative` over damage, `atEndOfRound`, `attachment-hosts.ts`. Missing: an environment as
> the host of a minion that stays a minion.

**Cards.** Apprehending Rogue Agents 1B 50130b ("Each Thunderbolt minion gains guard. Forced Response: After a
player attacks a Thunderbolt minion, that minion engages that player"); Justice, Like Lightning / Thunderbolt Backup
50131a/b (scan).

**Rules.** MC50 p. 15: "The attached minion is considered to be in play, retains all tokens, status cards, and
attachments on it, and can be targeted by attacks and player card abilities. The attached minion does not activate
because it is not engaged with any player." "If the most damaged minion is already attached, it remains attached
and heals. If an unattached minion has the most damage, it attaches to the environment and any minion already
attached … engages the player with whom the most-damaged minion was previously engaged." MC50 p. 22: a tie,
"including no damage", is the first player's choice.

**Plan.** `attach { card: minion, to: environment, as: "heldMinion" }`: `attachedTo` is set, `engagedWith` is null,
the minion is in play in no player's area; every player may attack it and target it; it is not an attachment for
any card that counts or discards attachments. `engage` of a held minion detaches it. The environment's interrupt at
the end of the round is a script over `superlative` (most damage among Thunderbolt minions in play), a swap of the
two positions, a heal of 1 per player (2 per player and a tough status card in expert mode).

**Tests (two players).** Moonstone engaged with player 2 with 9 damage, Songbird held with 4: at the end of the
round Moonstone is held with 7 damage and Songbird is engaged with player 2. Expert: 5 damage and a tough status
card. Both at 3 damage: the first player chooses. The held minion has the most damage: it stays and heals 2. Player
1 attacks the held minion: after the attack it is engaged with player 1 and nothing is held until the round ends. No
Thunderbolt minion in play: nothing happens.

### 3.22 Setup that picks sets by the minion they hold; each player reveals a random set-aside minion

> **Status: not started (exists, verify).** `Scenario.modularSetCount { base: 1, perPlayer: 1 }` and a restricted
> `modularSetPool` (wave 6 §3.63, Mojo 39025a), `setAside` by query, a random set-aside card revealed by each player at
> setup (wave 8 §3.15), `revealCard`, `inMode`.

**Cards.** 50130a (scan), 50131a. Steps in §2.5.

**Tests.** One player: two sets, two minions set aside; one is revealed and engaged with the player, the other is
held. Four players: five sets, four revealed and one held. Expert: each of them has a tough status card. The rest of
each chosen set is in the encounter deck; no Elite Thunderbolt minion is.

### 3.23 A villain that cannot be defeated below a victory display count; an activation given up to heal

> **Status: not started (exists, verify).** `RuleSpec cannotBeDefeated { while }` (its doc cites 50129),
> `victoryDisplayCount`, the per player icon over the starting player count, `enemyActivating` with
> `replaceTriggeringEvent`, `gameStep`, `engagedWith`.

**Cards.** Citizen V 50129a/b (scan 50129a): "Citizen V cannot be defeated unless there are at least 1[per_hero]
Thunderbolt minions in the victory display. ★ Forced Interrupt: When Citizen V would activate against you during
step two of the villain phase, if you are engaged with a Thunderbolt minion, Citizen V does not activate and heals
4 [6] damage instead."

**What to verify.** At 0 remaining hit points he stays in play and keeps activating; the moment the count is
reached he is defeated (a state check) and the players win. The replaced activation deals no boost card (RRG
"Activation", p. 6: a boost card is given "each time the villain activates") and nothing answers "after Citizen V
activates". Only step two: Citizen V's Sword 50132 and Tap In 50138 make him activate with no heal. Jolt 50133 counts
for "engaged with a Thunderbolt minion" and never reaches the victory display. A stunned or confused Citizen V is
**§4.1 Q2**.

**Tests (two players, 24 hit points).** 24 damage with one Thunderbolt minion in the victory display: in play at 0.
A second Elite Thunderbolt is defeated: Citizen V is defeated at once. Player 1 engaged with Moonstone, hero form,
step two, Citizen V with 10 damage: no attack, no boost card, 6 damage; player 2, not engaged with one, is attacked
as usual. Down but Not Out takes a minion out of the victory display while he is at 0: still not defeated.

### 3.24 Every player engages the next player's minions at once

> **Status: not started (extend).** `engage { minion, player }` moves one minion; `forEachPlayer` resolves in order, so
> a loop would hand player 1's new minions on to the last player. No simultaneous form exists.

**Cards.** The Coming Storm 50135, Rumbling Thunder 50136, Parcours du Combattant 50164: "Each player engages each
minion engaged with the player clockwise from them."

**Rules.** RRG "Engage" (p. 18): a minion a card makes a player engage "is also considered to have engaged that
player"; it cannot be made to engage the player it is already engaged with.

**Plan.** `EffectSpec rotateEngagement { from: "nextPlayer" }`: the engagements are read once, then every minion
moves to the player before its own in player order, all at once; `minionEngaged` is announced for each, in player
order of the new holder. With one player nothing moves and nothing is announced. A held minion (§3.21) is engaged
with nobody and stays.

**Tests.** Three players, player 1 with A, player 2 with B and C, player 3 with none: player 1 has B and C, player
2 none, player 3 A. Batroc 50161 moving to a new player: "When Batroc engages you, discard 1 card". Coup de Foudre in
play and a minion with 4 boost icons moves: its new player discards 4 cards and 1 threat is placed for each printed
energy resource among them. One player: nothing.

### 3.25 Damage that goes somewhere else: threat off a scheme, onto the attachment, back at the attacker

> **Status: not started (exists, compose).** An interrupt to `dealDamage` with `replaceTriggeringEvent`, `eventAmount`,
> `preventDamage { amount }`, `placeDamage` on a card that is not a character (Armored Rhino Suit), `removeThreat`,
> `attackInProgress`, counters spent by a forced ability.

**Cards.** Heightened Reflexes 50092 (prevent 2, remove 1 leap counter; uses 4); Psionic Force Field 50117 ("place
it here instead. Then, if there is at least 5 damage here, discard this card"); Sonic Bubble 50146 ("When any amount
of damage would be dealt to an enemy, remove an equal amount of threat from here instead"); Handspring 50149 ("deal
that damage to the attacking character instead. Discard this card"); Runaway Nuclear Reaction 50154 (a response:
equal threat placed; at 10, 10 damage to each character).

**What to verify.** Each is a "would" replacement, so with two in play the first player orders them and the second
has nothing left to replace (RRG p. 48). Sonic Bubble replaces all of the damage even with less threat than damage
on it, and is defeated at 0.

**Tests.** A 6-damage attack on M.O.D.O.K. with the force field at 0: 6 damage on the field, it is discarded,
M.O.D.O.K. takes 0. Sonic Bubble at 3 and a 5-damage attack on a minion: 0 damage, the scheme is defeated. Handspring
on Black Widow 50148, a hero's 4-damage attack: the hero takes 4, the attachment is discarded, her retaliate 1 still
answers. Radioactive Man is dealt 6 with the scheme at 5: 11 threat, 10 damage to every character, the scheme
discarded.

### 3.26 Board Members: named counters, a flip to an attachment on the villain, a loss at three

> **Status: not started (extend).** `stateCheck`, `inMode`, `flipToOtherFace` (`resolve/other-face.ts`), `attach`,
> `PrintedStatModifiers`, `countersPlaced`, `endGame`, permanent. Missing: a flip that changes the card's type and
> attaches it in the same step, and (by §4.1 Q1, default A) keeps its counters.

**Cards.** Chief Medical / Surveillance / Tactical Officer 50181a–50183a (scan 50181a: "Setup. If there are 4 or
more secret counters here (3 or more instead in expert mode), flip this card. Hero Action: Spend [energy] [energy]
resources → remove 1 secret counter from here. Then, heal 1 damage from a friendly character"); their attachment
faces 50181b–50183b (scan 50181b: "Attach to the villain. Permanent. Forced Response: After a secret counter is
placed here, either heal 2 damage from the villain or deal 1 damage to the friendly character with the fewest
remaining hit points. If there are 3 Board Member attachments in play, the players lose the game"); The Accusation
2B 50168b; Fighting Zemo 3B 50169b.

**Rules.** MC50 p. 6: "If a board member ever has four secrets on it (three in expert mode), that board member
permanently turns against the heroes, flipping to its attachment side". MC50 p. 19: "If all of the board members
join Baron Zemo, the players lose the scenario." RRG "Flip" (p. 20) and §4.1 Q1.

**Plan.**

- The environment's threshold is a state check; the flip puts the attachment face up **attached to the villain**
  (no reveal, no "enters play"), with its stat box in effect.
- The cards separate "**Board Member card**" (either face: 50184a–c, 50165b / 50166b, 50168b step 2) from "**Board
  Member environment**" (the environment face only: every removal, "the … environment with the fewest secret
  counters", 1B's Response). Both are a trait plus a card type in a query; a script must copy the word the card
  uses.
- "After a secret counter is placed here" answers each placing effect once, however many counters it placed (the
  `countersPlaced` event carries the amount). Flagged in §4.2 as a convention.
- The villain's own flip to Unmasked (50169a) keeps his attachments: both faces are villains.

**Tests (standard mode).** The Medical Officer at 3; A.I.M. Interference places 1 on each Board Member card: it has
4, flips, is attached to Zemo (+1 ATK) and, with Q1 = A, holds 4 secret counters; its Hero Action is gone. The next
Interference places 1 on it (5) and its Forced Response resolves once. "Remove 3 secret counters from among Board
Member environments" cannot take from it. Expert: the flip is at 3. A third Board Member flips: the players lose.
Stage 3B, two players, the mole an environment with 2 counters and one attachment already holding 5: the mole flips
and attaches, and (2 + 5) × 2 = 14 threat is placed.

### 3.27 "Remove N counters from among" several cards; "the [card] with the fewest counters"

> **Status: not started (extend).** `EffectSpec divide` splits damage, threat, healing or status cards among candidates
> (`what: "damage" | "threat" | "heal" | StatusName`); `superlative` picks by a stat. Neither reads counters.

**Cards.** "Remove 3 [1[per_hero], X] secret counters from among Board Member environments" (50165a, 50166a, 50173,
50174, 50175, 50176, 50177); "the Board Member environment with the fewest secret counters" (50170, 50172, 50176).

**Plan.** `divide { what: { counters: "secret" }, mode: "remove", amount, among }`: the chooser takes that many
counters, one at a time, from the candidates that still hold one; fewer if fewer exist. The chooser is the first
player on an encounter card (RRG p. 19). `superlative { by: { counters: type }, pick: "fewest" }`, ties to the first
player; a card with none is the fewest.

**Tests.** Counters 2, 2, 0 and "remove 3": any split of 3 over the first two. Counters 1, 0, 0 and "remove 3": 1
removed. "Fewest" with 2, 0, 0: the first player picks between the two at 0. The Ends Justify the Means, discarding
a cost-4 support: up to 4 removed.

### 3.28 "You may spend X [type] resources to prevent X of …"

> **Status: not started (exists, verify).** `chooseNumber`, `spendResources`, `canPayResources`,
> `preventThreat { amount }`, `resolveSpecials { which: "whenRevealed" }` (its doc cites A.I.M. Interference's boost).

**Cards.** A.I.M. Interference 50184a/b/c (scan 50184a: "Incite 1. When Revealed: Place 1 secret counter on each
Board Member card. You may spend X [energy] resources to prevent X of these counters from being placed. ★ Boost:
Resolve this card's 'When Revealed' ability"); Battle of Wits 50175.

**What to verify.** The payment is made in the middle of an encounter card's resolution with cards from hand and
resource abilities, as any payment; a wild resource counts as the type; the player then picks which X cards get no
counter. As a boost card the "you" is the player the enemy is activating against, and incite does not apply (the
card is not revealed).

**Tests.** Counters 2, 2, 2; the player spends 2 energy and names two members: 2, 2, 3. Battle of Wits with Zemo
SCH 3 and a 1-icon boost: 4 threat pending; 2 mental spent: 2 placed and 2 secret counters removed from among the
environments.

### 3.29 Evidence in a standalone game: two hidden piles, gained cards, the grid, the accusation

> **Status: not started (new).** `EvidenceCard` and its three kinds are schema; the engine refuses an evidence card in
> any deck (`setup.ts`, `deck.ts`) and gives it no rules type (`card-types.ts`). The campaign model has a hidden log
> field for the envelope (`campaign.ts`, `campaign/log.ts`), which a standalone game does not have. Nothing in
> `state.ts` holds hidden cards that are not a deck.

**Cards.** Zemo's Manipulations 50167a/b (scans), The Accusation 50168a/b, Fighting Zemo 50169b, the nine evidence
cards 50185–50193.

**Rules.** MC50 p. 5, "Preparing the Evidence" (three steps); p. 18: "If you are **not** playing in campaign mode,
follow the steps under 'Preparing the Evidence' on page 5"; "When the players gain an evidence card, they turn it
faceup and cross out all combinations of means, motive, and opportunity in the campaign log that use the icon shown
on the new evidence card. _Note_: Ignore the text on the lower portion of the evidence card as this text only
applies during setup." MC50 p. 19, "The Accusation": the players choose "a combination of means, motive, and
opportunity that has not been crossed out … This board member is the **accused**"; the A.I.M. cards name the
**mole**; "place a secret counter on each board member for each guess (means, motive, opportunity, and board member)
they got wrong". 50167b (scan): "Response: After the player phase ends, the first player may place 2 secret counters
on a Board Member environment that has no secret counters on it to gain 2 cards from the S.H.I.E.L.D. envelope (1
card instead in campaign mode). The players may advance to stage 2A to make their accusation."

**Plan.** Four plain-data pieces, none naming a card:

1. `GameState.hiddenPiles: Record<string, readonly CardId[]>` and `revealedPileCards: readonly CardId[]`. Card ids,
   not instances: evidence is never in play. `visibility.ts` never shows a hidden pile's contents to any player.
2. `EffectSpec dealHiddenPiles { from, groupBy: "evidenceKind", onePerGroupTo: "aim", restTo: "shield" }`, where
   `from` is an encounter set id, drawn with the engine's seeded RNG; logged `hiddenPilesDealt` with sizes only (3
   and 6).
3. `EffectSpec gainFromHiddenPile { pile, count, bind }`: that many random cards, or as many as are left, move to
   `revealedPileCards` and are logged by id. An ability whose only effect is this cannot be used on an empty pile.
4. `EffectSpec accuse { grid, hidden: "aim", bind }`: a choice among the grid rows (§1.12) that contain no revealed
   card; then the hidden pile is revealed and its row found. Bound: `accused` and `mole` (the Board Member cards in
   play, either face), `wrongGuesses` (0 to 4: each of the three cards that differs, plus the board member) and
   `accusedWrong`. Logged `accusationMade` with both rows.

The scripts: 50167a Setup deals the piles (in campaign mode they come from the log instead, pass 1b); 50167b's
Response is two independent offers to the first player at the end of each player phase; 50168a makes the
accusation; 50168b places `wrongGuesses` counters on each Board Member card and 3 more on the accused when
`accusedWrong`, then advances; 50169a flips the villain (`setRemainingHitPoints` to the new face's printed value,
18 per player), then finds Baron Zemo's Sword and attaches it; 50169b is §3.26.

**Tests (seeded so the A.I.M. pile is known).** Setup: piles of 3 and 6, one card of each kind in the first, no
face in any view. The Response with one environment at 0: 2 secret counters on it, 2 cards revealed, the offered
rows drop from 27 to those without either card. Three uses: the pile is empty and the offer is gone. A correct
accusation: no counters, stage 3A, Zemo on his Unmasked face at 36 hit points (two players) with his sword. One
wrong card, right member: 1 counter on each of the three. Everything wrong, all three at 2 counters, standard mode:
4 on each and 3 more on the accused; all three flip and the players lose. A replay of the log reproduces the piles.

### 3.30 A hero from the collection in play as a minion

> **Status: not started (extend).** `searchCollection { player, filter, bind }` (a new card instance from outside the
> game), `RuleSpec treatHostAsMinion { traits, schFromThw }` and `CardInstance.treatedAs` (written for an ally host,
> wave 4 §3.9), `blankTextBox`, villainous, removal from the game.

**Cards.** Reluctant Foe 50171 (scan): "Treat attached hero as an Elite minion with SCH equal to its printed THW.
Replace its printed text box with: 'Villainous. When Defeated: Remove this hero and Reluctant Foe from the game.'
When Revealed: Search your collection for a hero whose title does not match a character in play and put it into
play engaged with you. Attach this card to it."

**Rules.** MC50 p. 22: "choose an identity card from a Marvel Champions hero you are not using in your current game
whose title does not match the title of a character in play … with its hero side faceup. That hero becomes a minion
with the villainous keyword, SCH equal to its THW value, and hit points equal to its starting hit point value. Its
DEF value has no effect."

**Plan.** A `CollectionSearchFilter` for identity cards (hero face) with a title no character in play has;
`treatHostAsMinion` accepting an identity card with no controller: ATK as printed, SCH from the printed THW, hit
points the printed value, the text box replaced by the attachment's quoted text (the two lines are abilities of the
attachment that apply to its host). With nobody to find, nothing enters play and the attachment is discarded.

**Tests.** A hero with THW 2, ATK 2 and 12 hit points: an Elite minion, SCH 2, ATK 2, 12 hit points, villainous,
engaged with the revealing player; defeated: the hero and the attachment are removed from the game. A player then
may play an ally of that title.

### 3.31 An additional cost to attack, thwart or defend with an ally

> **Status: not started (extend).** `basicPowerCosts` (a character's own attack or thwart; `actions.ts basicPowerCost`),
> `additionalThwartCost` (by scheme), `readyCost` (a rule over other cards; its doc cites Undermine Support 50174, which
> needs nothing new). No rule taxes another card's powers, and none taxes a defense.

**Cards.** Divided Loyalties 50173: "As an additional cost for a player to attack, thwart, or defend with an ally,
that player must spend 1 resource of any type."

**Plan.** A rule over other characters' powers:
`RuleSpec additionalPowerCost { character: TargetQuery, powers: ("attack" | "thwart" | "defend")[], resources }`.
Asked when the power is declared; a player who does not pay does not use the power and the ally does not exhaust
(RRG "Cost", p. 13). A player who cannot pay is not offered the ally as a defender.

**Tests.** An ally's basic attack with one card in hand: the card is spent, the attack resolves. With nothing to
spend: the attack and the defense are not offered. A hero's own powers: no cost.

### 3.32 Player-deck cards facedown as minions whose base stats an environment sets

> **Status: not started (exists, verify).** `putIntoPlayFacedown { player, as: { kind: "minion", traits } }` (the drone
> minions; "base stats of 0 (card abilities can set its base stats)"; "When it leaves play it goes to its owner's
> zones"), `findCard`, `discardFromPlay`.

**Cards.** Controller 50030, Army of the Controlled 50031, Controlled Innocents 50032 ("Each facedown Controlled
minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1. Forced Response:
After a Controlled minion is defeated, place that card in its owner's discard pile and place 1 threat on the main
scheme"), Diabolical Discs 50033.

**Tests.** With the environment in play, Diabolical Discs: the top card of the player's deck is a facedown
Controlled minion, 1 / 1 / 1; defeated: the card is in its owner's discard pile, 1 threat on the main scheme. Army
of the Controlled defeated with two Controlled minions and The Iliad at 2 mission counters: both are discarded (no
threat: a discard is not a defeat) and 2 counters are placed on supports. Without the environment in play neither
card makes a minion.

### 3.33 Keywords and icons a rule gives to other cards, to cards being revealed, and takes away

> **Status: not started (exists, verify; one extend).** `KeywordGrantSpec` (with `loses`, written for "Magneto loses
> steady"), `gainsIcon` (its doc cites Mad Science 50085), `attackKeywords`, `attacksDealIndirectDamage`, `statusLimit`,
> self-granted reveal keywords (wave 8 §3.3). The extend: **an interrupt to a status card about to be given**
> (`statusPlaced` is announced after it lands).

**Cards.** Destroy Evidence 50075 ("Each other encounter card gains incite 1"); Mad Science 50085 ("Each A.I.M.
minion gains 1 acceleration icon"); Extract Captives 3B ("In expert mode, each minion gains quickstrike"); Embassy
Guard 50093 and Embassy Patrol 50094 (surge, incite 1 on the High side); Batroc's Brigade 50101 ("Each minion gains
toughness"); Orion 50060 ("can have any number of tough status cards"); Solid Sound Constructs 50144 ("Attached
enemy loses stalwart. Forced Interrupt: When attached enemy would gain a confused or stunned status card, discard
this card instead").

**Plan for the extend.** `TriggerEvent statusBeingGiven { instanceId, status, sourceInstanceId, playerId }`, an
interrupt window opened by `giveStatus` only when a registered ability listens (as `statusPlaced` does), with the
pattern `on.wouldGainStatus(who, statuses)`. A replacement leaves the status card ungiven.

**What to verify.** Incite gained by a card that is being revealed and is not yet in play; "each other" leaves the
scheme itself out; a boost card is not revealed and gains nothing.

**Tests.** Destroy Evidence in play and a Standard treachery revealed: 1 threat on the main scheme, then its text.
Mad Science and two A.I.M. minions in play: step one places 3 more threat (the scheme's own icon and two minions').
Batroc's Brigade in play and a minion enters play: a tough status card. Orion enters play with 1 tough status card; with
Acquire Infinity Formula in play Nick Fury takes damage twice: Orion holds 3. Songbird with Solid Sound Constructs, a
hero stuns her: the attachment is discarded and she is not
stunned.

### 3.34 An attachment's stat box on an identity, replaced under a trait; the two errata

> **Status: not started (exists, compose).** `PrintedStatModifiers { atk, sch, thw, hp }` applied to the host,
> `StatModifierSpec` with `while`, `hasTrait`, `basicRecovery`, `cannotDefend { target, attacker }`,
> `reduceDamageTaken`.

**Cards and rules.** Radiation Exposure 50153 (scan): "Attach to your identity. ★ If attached identity has the Gamma
trait, this attachment gives +1 ATK instead. Forced Response: After you recover, discard 1 card from your hand →
discard this card", boxes −1 SCH and −1★ ATK. **RRG p. 69: the SCH box "should be a 'THW' modifier"**: the data
carries `thw: -1` (§1.14) and the −1 THW applies whether or not the identity is Gamma; the star is on the ATK box, so
only the ATK box turns to +1. MACH-IV 50156, **RRG p. 69: "Each character without the Aerial trait cannot defend
against MACH-IV's attacks"**: no such character can be declared the defender, by a basic defense or by an ability.
Aerial Dogfight 50159: "Reduce the damage each Aerial character takes from each attack by 2 unless the attacker or
attack has the Aerial trait, or the attack has ranged."

**Tests.** A hero with THW 2 and ATK 2 under Radiation Exposure: THW 1, ATK 1. A Gamma hero with ATK 3: THW one
lower, ATK 4. MACH-IV attacks a player whose hero and allies are not Aerial: nobody may defend. Nick Fury after
Fury's Flying Car (Aerial until the end of the round): he may. Aerial Dogfight and a 3-damage attack by a non-Aerial
hero on MACH-IV: 1 damage; Concentrated Fire (ranged) deals its 4.

### 3.35 Reusable as is (checked by name against the engine unions)

Every remaining ability of this pass is written with vocabulary found in `spec.ts`, `abilities.ts`,
`trigger-events.ts` and the DSL this session. "Checked by name" means the identifier and its doc comment were read,
not that the card's behavior was run; the scripting agent's tests prove each.

- **Find and reveal, already in play.** "Find [minion] and reveal her. (If she is already in play, she engages
  you.) [Minion] activates against you. If no enemy activated this way, this card gains surge" (50141, 50147, 50151,
  50155, 50160, 50163; 50084; 50102): `findCard` / `revealCard` (wave 8 §3.1), `enemyActivation`, `gainSurge`.
- **Boost cards.** "Give the activating enemy an additional boost card" (50122, 50140, 50145, 50147), "this card
  gains [boost][boost][boost]" (50102) and "gains [boost] for each …" (50128): `giveBoostCard`, `adjustBoostCount`;
  "After this activation, shuffle Adaptoid into the encounter deck" (50113): `atEndOfActivation`; "Attach this card
  to Batroc" / "to the activating enemy" from a boost (50092, 50117): `attach` with `activatingEnemy`.
- **Hinder, incite, patrol, villainous, guard, quickstrike, toughness, surge, retaliate, steady, permanent, setup,
  uses, piercing, ranged, overkill, victory, team-up**: keyword rules of earlier waves.
- **Status cards by choice** (The Pericles 50020), **tough discarded before damage** (The Bellerophon 50018),
  **threat removed from each scheme ignoring crisis** (The Douglass 50019): `giveStatus`, `removeStatus`,
  `removeThreat { ignoreCrisis }`.
- **Cancels.** Agents of S.H.I.E.L.D. 50015, Intelligence Analysis 50045, Batroc's Brigade 50101 (`cancelRevealedCard`,
  `triggerableBy`); Grappling Hook 50069 (`cardBeingPlayed` with `cancelTriggeringEvent`); Front Organization 50028
  (`discardRedirected`).
- **Resources.** Special Funding 50007 and Organizational Support 50014 (a resource card's own response or interrupt
  when spent; `printedResourcesOf`), Support Staff 50008 and Jemma Simmons 50055 (a resource ability for another
  player or for a card of a trait; `forAnyPlayer`), "spend [type] [type] resources" as an ability cost (50105a–50108a,
  50132, 50157, 50170, 50181a–50183a), "spend 3 resources of any type" inside an effect (50102).
- **Looking.** Melinda May 50023 and Global Logistics 50049: `lookAt` with discard and top-or-bottom return.
- **Until the end of the phase or round.** Slingshot 50013, Nick Fury, Sr. 50054, Fury's Flying Car 50040:
  `atEndOfPhase`, `atEndOfRound`, `grantTraitUntil`.
- **Preparation upgrades** (the trait): 50010, 50042, 50043, 50045, 50050–50052, with Secret Agent 50046 on
  `abilityResolved` (its doc cites this card) and Practiced Plan 50058 on a discard from play.
- **Jolt 50133** (counters and removal from the game), **Innocent Bystanders 50134** (an obligation that stays in
  play with uses), **Down but Not Out 50137** (a random victory display card revealed, `placeDamage` to leave 5
  remaining, removed from the game), **Tap In 50138**, **Psychological Manipulation 50142**, **Dance of Death
  50078**, **Psionic Blast 50124** (indirect damage, then confuse each character damaged), **Disavowed 50180**
  (`CostModifierSpec`), **Arrest Warrant 50179**, **S.H.I.E.L.D. Trooper 50178**.

### 3.36 Specials resolved by count and by choice; a Special that discards its own card; Specials on allies

> **Status: not started (exists, verify).** `special` (DSL) and `EffectSpec resolveSpecials { cards | of, player,
abilities, bind }` (`spec.ts`; its doc cites Wakanda Forever!), the "(attack)" and "(thwart)" labels on a Special
> (Core's Black Panther upgrades, wave 1), `chooseCards` feeding `of`, `basicPowerUsed`, `discardThis`,
> `thatAttackGainsKeywords`, `attack { moveDamageFrom }`. Not run: one Special chosen out of several, "up to 4", a
> Special printed on an ally, a Special whose card leaves play as it resolves.

**Cards.** Black Panther 51001a (scan: "Response: After Black Panther uses a basic power, resolve the 'Special'
ability on 1 Black Panther upgrade you control"); T'Challa 51002 (the same as a Hero Response on an ally); Clawed
Strike 51003 and On the Prowl 51004 (an event's effect, then one Special); Wakanda Forever! 51005 ("on each … in any
order"); Heart of the Panther 51025 ("put it into play. Resolve the 'Special' ability on up to 4 Black Panther upgrades
you control in any order"); the four upgrades Kimoyo Beads 51010, Panther Claws 51011, Spider Bites 51012 and
Vibranium Suit 51013, each ending "You may discard this card to …"; Aneka 51022, Ayo 51023 and Okoye 51024 ("resolve
the 'Special' ability on another Dora Milaje ally", each printing its own Special); Dora Milaje 51030 ("on 1 Dora
Milaje ally and heal 1 damage from that ally").

**Rules.** RRG "Special" (p. 40): "Special abilities may only be resolved through the explicit instruction of another
card ability." RRG "Move" (p. 30): "If damage is moved off a character, the moved damage is considered to be healed
from that character. If damage is moved to a character, the moved damage is considered to be dealt to that
character"; "If there is no valid source or destination for a move, the move cannot be made."

**What to verify.**

- **"On 1".** The resolving player picks one card that prints a Special among those the text names; with none, that
  sentence does nothing and the rest of the ability still resolves. A new DSL builder over `chooseCards` and
  `resolveSpecialsOf` is DSL work, not engine work.
- **"Each … in any order" and "up to 4 … in any order".** The player orders them as today. "Up to 4" follows the
  owner's wave 3 decision (§4 Q16 there): at least one when one can resolve. The upgrade Heart of the Panther put into
  play is a candidate.
- **A Special that discards its card.** "You may discard this card to …" is an optional effect, not a cost: the first
  sentence has already resolved. The discarded upgrade is gone for the next basic power use.
- **Labels.** Kimoyo Beads "(thwart)", Panther Claws and Vibranium Suit "(attack)" resolve as the hero's thwart or
  attack, exactly as Core's four upgrades do today (wave 1); Spider Bites prints no label and is neither. Panther
  Claws' 2 damage and its 3 "additional" are one instance of 5, and "this attack gains piercing" reaches all of it.
  Vibranium Suit moves 1 damage (healed from the hero, dealt to the enemy); a hero with no damage moves nothing and
  may still discard the card for a tough status card.
- **Specials on allies.** "Another Dora Milaje ally" is any player's (the text has no "you control"), resolved with
  the responding player as "you" (`resolveSpecials.player`). Only the Special resolves: the other ally's own
  Response does not chain, because no basic power was used.
- **T'Challa 51002** is a Hero Response: nothing in alter-ego form. He matches Core's T'Challa identity (RRG "Unique
  Icon", p. 45: "the identity with the T'Challa alter-ego, the T'Challa ally … are all considered to match").

**Tests (exact numbers).** Black Panther (THW 2) thwarts a scheme at 5: 3, then Kimoyo Beads' Special: 2; discarding
it confuses the villain and the upgrade is in the discard pile. Clawed Strike on an enemy with a tough status card,
then Panther Claws discarded: the tough card is discarded by the first 4 damage's attack; a second enemy with a tough
card named by Panther Claws takes 5 through it (piercing). Wakanda Forever! with all four upgrades: four Specials in
the chosen order. Heart of the Panther with five Black Panther upgrades in play after its search: four resolve.
Vibranium Suit with 0 damage on the hero: nothing moves. Aneka attacks with Ayo in play: 1 damage from Ayo's
Special; with no other Dora Milaje ally: nothing. T'Challa thwarts while Shuri is in alter-ego form: no response.

### 3.37 A card searched for in the deck and played at a reduced cost

> **Status: not started (exists, verify).** `EffectSpec playFromHand { from: "hand" | "setAside" | "deck" | …, filter,
costReduction, ignoreCost }` (`spec.ts`). The DSL has `playFromHandReducingCost` and `playFromDeckIgnoringCost`
> (Fetch Quest) and no builder that sets `from: "deck"` with a reduction: one DSL builder, no engine change expected.

**Cards.** Shuri 51001b (scan): "Inventor — Action: Exhaust Shuri → search your deck for a Black Panther or Tech
upgrade and play it, reducing its resource cost by 2. (Limit once per round.)"

**What to verify.** The whole deck is searched; only an upgrade the player may legally play and can pay for after
the reduction is offered; the rest of its cost is paid as for any play; it is played (`cardPlayed` is announced, so
"after you play" responses answer); the deck is shuffled once the card has resolved, or at once when none was played
(as `playFromDeckIgnoringCost` does). A Tech upgrade of any aspect in her deck qualifies (Invisibility Gear 51019,
Sonic Rifle 51020).

**Tests.** Kimoyo Beads (cost 2): played for 0. Sonic Rifle (cost 3) with one card in hand: 1 paid. Sonic Rifle with
an empty hand and no resource ability: not offered; Shuri is exhausted and the deck shuffled. A second use in the
round: refused.

### 3.38 Threat a scheme loses placed on a minion; the minion taken as an ally by a linked attachment

> **Status: not started (exists, compose).** Threat on a card that is not a scheme (wave 6 §3.59,
> `threat-on-characters.test.ts`; §3.7 (a) here), the `removeThreat` interrupt with `eventAmount`,
> `addToVictoryDisplay`, linked cards set aside (`linked-set-aside.test.ts`), `RuleSpec treatHostAsAlly` (wave 4 §3.29,
> landed; its doc cites Redemption 51036), `remainingHpOf`, the victory keyword on an attachment.

**Cards.** Show of Empathy 51017 (scan; unique, Justice, 6 threat, Victory 0): "Forced Interrupt: When threat is
removed from this scheme, place that threat on a non-Elite minion. If that minion has threat on it equal to or
greater than its remaining hit points, add Show of Empathy to the victory display and attach 1 set-aside copy of
Redemption to that minion." Redemption 51036 (scan; cost –, "Linked (Show of Empathy). Victory 0. Take control of
attached minion and treat it as a Redeemed ally with a blank text box. Its THW is equal to its printed SCH and it
takes 1 consequential damage after it thwarts or attacks").

**Rules.** RRG "Linked (Card Title)" (p. 27): set aside at setup when a deck holds the named card; "When a player
takes control of a card with the linked keyword, that player becomes the owner of that card." RRG "Victory X"
(p. 46), for an attachment: "Forced Interrupt: When the attached card is defeated, add this card to the victory
display." RRG "Player Side Scheme" (p. 34).

**Plan (composition).** A forced interrupt to any removal of threat from the scheme (a thwart, an ability, an
encounter card). The amount is what is actually being removed. The player whose card removes it chooses the minion,
any player's; when no player's card did, the scheme's owner chooses. The threat lands as tokens (§3.7 (a)). Then the
check, once, against the minion's remaining hit points at that moment. With no non-Elite minion in play the threat
is simply removed. When the last threat goes and the check failed, the scheme is defeated as any side scheme and its
Victory 0 sends it to the victory display. Redemption's controller is the player who chose the minion (flagged, §4.2).

**Tests (exact numbers).** A minion with 3 hit points and 1 damage (2 remaining): a thwart for 2 places 2 threat on
it; Show of Empathy (4 threat left) goes to the victory display, Redemption attaches, the minion is the chooser's
ally with THW equal to its printed SCH and a blank text box, and it takes 1 consequential damage when it thwarts.
The same thwart with only an Elite minion in play: 4 threat left, nothing placed. Threat 2 removed onto a minion with
5 remaining, then 2 more onto the same minion next turn: 4, no flip; 1 more: 5, it is redeemed. The redeemed ally is
defeated: it goes to the encounter discard pile and Redemption to the victory display.

### 3.39 Encounter cards tucked under an identity: a cap, tucks from the discard pile, "the same encounter set"

> **Status: not started (exists, verify).** `tuckCards` (from any zone), `tuckedUnder` / `tuckedCount(of, filter)`,
> `TargetQuery.encounterSetOf` (`select.ts`; every "from the [X] set" reads it), `stateCheck`,
> `encounterCardResolved`, `characterDefeated` / `schemeDefeated` with the defeating player, `discardEncounterUntil`,
> `lookAt`, `modifyBasicPower`, `gainTraitUntil`. Not run: encounter cards under an identity through a change of form,
> and a count of tucked cards filtered by another card's set.

**Cards.** Silk 52001a and Cindy Moon 52001b (scans; both faces: "If there are more than 4 tucked cards here,
discard all but 4 of those cards"; Silk Sense: "Response: After you defeat a minion or side scheme, or resolve a
treachery card, tuck that card under here from the encounter discard pile"; Cindy Moon: "Action: Discard a card
tucked here → draw 2 cards. (Limit once per round.)"); Smooth as Silk 52002; Swinging Silk Kick 52003; Wallcrawl
52004; Get the Scoop 52005 (scan); Albert Moon 52006; Organic Webbing 52009; Outwit 52010; Spider Claws 52011; Spider
Reflexes 52012; Morlun 52029 and The Great Hunt 52030 ("for each card tucked under each identity"); The Raft 51018
(scan: a minion that left play tucked under a support "from the encounter discard pile").

**Rules.** RRG "Tuck" (p. 45): "Tucked cards are not in play and are not considered 'attached'"; "When a card leaves
play, each card tucked under it is discarded." An identity does not leave play when it changes form (ruling January
26, 2026 – Ruling 6 (2)), and both faces print the cap, so the cards stay. RRG "Encounter Set" (p. 18): "Encounter
sets with the same name but different set icons are considered distinct sets." RRG "Encounter Deck" (p. 17): a discard
"until a card with specific criteria is discarded" that empties the deck "is considered to be fulfilled. Do not
continue the discard effect with the newly shuffled encounter deck."

**What to verify.**

- **The cap.** A state check on both faces: with five or more tucked cards the controller chooses which four stay,
  and the rest go to their owners' discard piles (encounter cards to the encounter discard pile). The discard is the
  identity card's own (§4.1 Q7).
- **Silk Sense** tucks only a card that is in the encounter discard pile when the response resolves: not a card that
  went to the victory display, was shuffled away or was removed from the game. "You defeat": the defeating player.
  "Resolve a treachery card": a treachery this player revealed and resolved (`encounterCardResolved`), not one
  resolved as a boost card.
- **"From the same encounter set as"** reads the two cards' sets (`encounterSetOf`), a card of several sets matching
  on any. A player card tucked there by another effect has no encounter set and never matches.
- **Smooth as Silk** with no card of that set left: the deck is discarded to the end, reset once (one acceleration
  token), and nothing is tucked.
- **Get the Scoop** 52005 (unique, 4 threat, no victory keyword): "Any player may trigger this ability" with the
  triggering player's own identity exhausted (`triggerableBy`); "The Cindy Moon player" looks and tucks whoever
  defeated it, and nothing happens when that player has been eliminated.
- **The Raft**: the response needs the minion in the encounter discard pile; "remove threat … equal to the tucked
  minion's printed SCH"; at four tucked minions one chosen at random is dealt facedown to a player of the
  controller's choice (`dealAsEncounterCard`).

**Tests (exact numbers).** Four cards tucked and Silk Sense tucks a fifth: the player discards one of the five. Two
Morlun-set cards tucked and Spider Claws on a basic attack against Morlun: ATK 2 + 2 = 4, piercing. Outwit with one
card of the scheme's set and three of another: THW 1 + 1 = 2 (3 with Organic Webbing). Swinging Silk Kick with a
matching card discarded: 9 with overkill; with none: 7. Wallcrawl: 2 removed, then 3 more from a scheme whose set
matches the discarded card. Albert Moon with 3 tucked cards: heal 3. A minion with Victory 1 defeated: nothing to
tuck. The Raft with a minion of printed SCH 2: 2 threat removed; the fourth minion tucked: one of the four, by the
seeded draw, is dealt facedown and three remain. Morlun with 2 cards under Silk and 1 under another identity: +3 SCH
and +3 ATK.

### 3.40 A tuck sent somewhere else; a tucked card that answers its own discard; "by a player card effect"

> **Status: not started (new).** No trigger announces a tuck or a tucked card's discard (grep of `cardTucked`,
> `beingTucked`, `wouldBeTucked` finds nothing; `tuckCards` moves the card at once), and `AbilityDefinition.activeIn`
> is `"hand" | "victoryDisplay" | "discard"`.

**Cards.** Silk Sense Overload 52028 (scan; an obligation that stays in play): "Forced Interrupt: When a card would
be tucked under your identity by a player card effect, tuck it under here instead. Then, if there are 2 tucked cards
here, you may discard this card (remove it from the game instead if there are 3 or more tucked cards here)."
Hunting the Spider-Bride 52031 (scan): "Surge. When Revealed: If you have 4 cards tucked under your identity, discard
1 of those cards at random. Tuck this card under your identity. Forced Response: After a player card effect discards
this card from under an identity, that identity takes 2 damage." Morlun 52029: "When Defeated: Discard each copy of
Hunting the Spider-Bride tucked under each identity."

**Rules.** RRG "'Would'" (p. 48) and "Replacement Effect" (p. 37). RRG "In Play and Out of Play" (p. 23): out-of-play
text works only when it "specifically refer[s] to being used from an out-of-play area", which a card that speaks of
its own discard "from under an identity" does. RRG "Player Card" (p. 33): identity cards are player cards.

**Plan.**

- (a) `TriggerEvent cardBeingTucked { instanceId, hostInstanceId, sourceInstanceId, byPlayerCard }`, an interrupt
  window opened only when an ability in the registry listens, and `EffectSpec replaceTuckHost { to }`, which changes
  where the pending tuck lands. `byPlayerCard` is true when the card whose ability tucks is a player card (an identity,
  a player side scheme, an upgrade), false for an encounter card (Hunting the Spider-Bride tucking itself).
- (b) `activeIn: "tucked"` for a triggered ability the card itself makes to its own discard from under a card, and
  `TriggerEvent tuckedCardDiscarded { instanceId, hostInstanceId, sourceInstanceId, byPlayerCard }`, announced after
  the card has reached its discard pile. "That identity" is the host it was under. Whether a cost and the identity's
  own cap count as "a player card effect" is §4.1 Q7 (default: yes).
- Silk Sense Overload's "Then" reads its own tucked count after the redirected tuck: exactly 2 offers the discard, 3
  or more removes it from the game without asking. Either way the cards under it go to their discard piles (RRG
  p. 45), and that discard is an encounter card's.
- Morlun's When Defeated and the treachery's own "discard 1 of those cards at random" are encounter card effects:
  `byPlayerCard` false, no damage.

**Tests (exact numbers).** Overload in play, Silk Sense after a minion's defeat: the minion is under the obligation
(1), Silk has none. A second: 2, the player declines; a third: 3, the obligation is removed from the game and three
cards are in the encounter discard pile. Hunting the Spider-Bride revealed with Overload in play: it tucks under
Silk (an encounter card's tuck), surge. Spider-Bride under Silk, discarded by Swinging Silk Kick against Morlun:
9 damage with overkill and Silk takes 2. Morlun defeated with two copies tucked: both discarded, 0 damage.
Spider-Bride revealed with four cards tucked: one of the four, by the seeded draw, is discarded with no damage,
then it tucks (4 again).

### 3.41 A revealed card swapped with a tucked card of its set

> **Status: not started (exists, verify).** `EffectSpec swapCards` (wave 6 §3.47): `resolve/swap-cards.ts` says "Two
> out-of-play cards (Eidetic Memory, `silk`, erratum RRG 1.8 p. 69) just exchange places and orientations" (the
> erratum is on **p. 70**; the comment's page is a slip). `encounterCardRevealing`, `revealCard`,
> `cancelTriggeringEvent`. Not run for this card.

**Cards.** Eidetic Memory 52008 (scan prints "under Silk"). **Erratum, RRG p. 70 (checked):** "Interrupt: When you
reveal a card from the same encounter set as a card tucked under your identity, exhaust Eidetic Memory → swap those
cards. Reveal the card that had been tucked under your identity instead." (Changed "Silk" to "your identity".) The
erratum is the text scripted, so it works in either form.

**Rules.** RRG "'Swap'" (p. 42). Ruling April 30, 2026 – Ruling 3 (3): "flipping environments are not considered
'revealed'", so Wheel of Genres and Alert Level never open this interrupt (as §3.16 already has it).

**What to verify.** The interrupt opens when its controller reveals an encounter card (from a deal, a surge, a
"reveal" instruction), before incite, When Revealed and the other reveal keywords. The first card is then tucked,
unrevealed and unresolved; the formerly tucked card is revealed in its place and resolves in full, keywords and
surge included. The swap is not a tuck "by a player card effect" under §3.40 (a swap is not a tuck instruction;
flagged, §4.2). One use per round follows from the exhaust.

**Tests.** A treachery of the villain's set tucked, a minion of that set revealed: the minion is under the identity
and the treachery resolves. No tucked card of the revealed card's set: not offered. Alert Level flips: not offered.
In alter-ego form: offered (the erratum).

### 3.42 The top card of the encounter deck faceup; an ability refused when the visible card gives it nothing

> **Status: not started (extend).** `RuleSpec topOfDeckFaceup { player, while }` and `Predicate topOfDeckFaceup` (wave
> 8 §3.48) are written for player decks; `RuleSpec mayLookAtTopOfEncounterDeck` (wave 5 §3.28) shows the card to one
> player only. No rule keeps the encounter deck's top card faceup for the table.

**Cards.** Falcon 53001a (scan): "During the player phase, play with the top card of the encounter deck faceup."
Redwing 53002 (scan), Battlefield Awareness 53010, Bird of Prey 53003, Bird's-Eye View 53004 and Talon Line 53012
read that card's icons (§3.43).

**Rules.** RRG FAQ "Redwing (#2)" (p. 65, checked): "Q: Can Redwing's ability be triggered if the top card of the
encounter deck is visible and that card has no icons in its boost area? A: No, because the player knows that the
ability will not be able to affect its target, the ability cannot be triggered." Ruling January 26, 2026 – Ruling 6
(1): "If there are no boost icons on the top card of the encounter deck, Redwing's ability has no effect and cannot
be initiated." Ruling March 19, 2026 – Ruling 5: visible with 0 icons, cannot trigger; "facedown/unknown, Redwing
can trigger (paying cost with incomplete information …). Confirm valid targets first, then discard and resolve as
much as possible"; facedown but known, "it can still trigger". Ruling January 26, 2026 – Ruling 6 (2): "Limits
apply to cards. An identity never leaves play when flipping; limits applied to its abilities persist across flips."

**Plan.**

- `RuleSpec topOfDeckFaceup` gains `deck: "encounter"`: while the rule holds (hero face up, player phase), the top
  card of the active villain's encounter deck is visible to every player. As for a player deck, nothing is written
  on the card, nothing triggers, the order does not change, and each change of the top card logs
  `encounterTopShown` / `encounterTopHidden`. The rule is off in the villain phase, in alter-ego form and under a
  blank text box.
- `Predicate topOfDeckFaceup` reads that card only while it is faceup (wave 8 §4.1 Q26 = B: a hidden card answers no
  question), which is the rulings' line between "visible" and "facedown but known".
- **The refusal.** An ability whose whole effect is a number read from the icons of a top card it discards as a cost
  (Redwing, Battlefield Awareness) is not offered while that card is faceup and prints no icons. Scripted as the
  ability's condition, not as an engine rule about one card. With the card facedown the ability is offered and
  resolves for whatever the card prints, 0 included. Redwing still needs a target for one of its two choices.
- Bird of Prey's and Bird's-Eye View's optional discard with a visible 0 is §4.1 Q6 (default: not offered).

**Tests.** Falcon's turn: every player's view shows the top card; it is hidden when the villain phase begins and when
Sam Wilson is up. The top card is discarded: the next one is shown at once. A visible card with 0 icons: Redwing and
Battlefield Awareness are not offered. Another player's turn with Falcon in hero form: Redwing is offered against a
visible 2-icon card. Sam Wilson's action, a change to hero form, Aerial Evacuation back to alter-ego: the action is
refused a second time that round.

### 3.43 Cards discarded from the top of the encounter deck: a cost of chosen size, a trigger, a card handed on

> **Status: not started (extend).** `AbilityCost.encounterLookDiscard { look, discard, slot }` (wave 6 §3.54) with
> `<slot>.boostIcons`; `EffectSpec discardEncounterCards` with a bind; `ValueSpec boostIcons` and `starIcons`,
> "independent counts over the same pile" (`spec.ts`); `TriggerEvent cardDiscardedFromDeck` (a player deck only: it
> carries a `playerId`); `TriggerEvent abilityResolved { instanceId, abilityId, controllerId }` (no bindings).

**Cards.** Redwing 53002 (scan: "Exhaust Redwing, return him to your hand, and discard the top card of the encounter
deck → choose to either deal X damage to an enemy or remove X threat from a scheme. X is the number of icons (★ and
boost) in the discarded card's boost area"); Battlefield Awareness 53010; Bird of Prey 53003 and Bird's-Eye View
53004 ("You may discard the top card of the encounter deck to …"); Falcon's Eagle-Eyed 53001a; Talon Line 53012
("After you resolve Falcon's 'Eagle-Eyed' ability, discard Talon Line → for each icon in the discarded card's boost
area, choose 1"); Misty Knight 53036; Hugin & Munin 53017; Infiltration 51015 (scan: "Choose a number from 1 to 5.
Discard that many cards from the top of the encounter deck → remove 1 threat from a scheme for each card discarded
this way. Put 1 minion discarded this way into play engaged with you"); Viper 53030 ("discard the top 5 cards of the
encounter deck"); Serpent Solutions 53031 ("Forced Response: After a Serpent Society minion is discarded from the
top of the encounter deck, deal that minion to the first player as a facedown encounter card"); Spoiling for a Fight
54016 and Smooth as Silk 52002 discard from the top too.

**Rules.** RRG "Star Icon" (p. 40): a star in the boost field is a reminder to read the text box. The engine counts
stars apart from boost icons (`starIcons`), and these cards count both: the number is `boostIcons + starIcons` of
the printed card. RRG "Amplify Icon" (p. 7): an icon is added "When a boost
card is turned faceup during an enemy activation", so amplify adds nothing here. RRG "Encounter Deck" (p. 17). RRG
"Cost" (p. 13).

**Plan.**

- (a) `AbilityCost.discardFromEncounterDeck { amount: number | { choose: { min, max } }, slot }`: that many cards from
  the top, bound to `slot` with `<slot>.count`, the chosen number made as the cost is paid. A deck the cost empties is
  reset at once; the cost is paid with what was discarded (RRG p. 17). Redwing and Battlefield Awareness use 1,
  Infiltration `{ choose: { min: 1, max: 5 } }`.
- (b) `cardDiscardedFromDeck` is announced for the encounter deck too (`playerId: null`, the deck named), under the
  same rules as today: only when an ability listens, one response window for the cards one effect or cost discarded,
  and a card a response took away is no longer counted by the discarding ability (wave 7 §4.1 Q32). Boost cards
  discarded after an activation come from play, not from the top of the deck, and are not announced.
- (c) `abilityResolved` carries the resolved ability's slots, so "the discarded card" of Eagle-Eyed is the card it
  bound, read where it is now. If Serpent Solutions dealt it away, Talon Line still reads its printed icons.
- Infiltration's minion is mandatory when one was discarded; with several the player picks one. Serpent Solutions
  answers first for a Serpent Society minion (a forced response), and a minion it dealt away is no longer in the
  discard pile to be put into play, nor counted for threat (Q32's rule).
- Talon Line with a discarded card of 0 icons is not offered (the FAQ's reasoning in §3.42; flagged, §4.2).

**Tests (exact numbers).** Redwing with a top card of 2 boost icons and a star: X = 3; he is in hand and the card in
the discard pile. Battlefield Awareness on a basic thwart with a 1-icon card: THW 2 + 1. Bird of Prey with a 3-icon
card: 4 + 3 = 7 as one instance. Infiltration choosing 4 with a minion third from the top: 4 threat removed, the
minion engaged with the player. Infiltration choosing 5 with 2 cards left: 2 discarded, the deck reset with one
acceleration token, 2 threat removed. Viper activates with Serpent Solutions in play and two Serpent Soldiers in the
top 5: both are dealt facedown to the first player. Eagle-Eyed discards a Serpent Soldier (boost area: a star) with
Serpent Solutions in play: it is dealt to the first player, and Talon Line still offers 1 choice. An amplify icon in
play: Redwing's X is unchanged.

### 3.44 A response to a boost card being given: look at it and the deck top, and swap them

> **Status: not started (extend).** `boostCardDealt` is a log event (`events.ts`, `resolve/enemy-activation.ts`), not a
> `TriggerEvent`; `boostCardTurnedFaceup` and `boostIconsCounting` come later in the activation. `swapCards` covers two
> out-of-play cards; `lookAt` covers the deck top.

**Cards.** Up, Up, and Away 53005 (scan): "Hero Response (defense): After an attacking enemy is given a facedown
boost card, look at that card and the top card of the encounter deck. You may swap those cards. Draw 1 card for each
printed icon (★ and boost) in the (current) boost card's boost area."

**Rules.** RRG "Attack (Enemy Activation)" (p. 8), "Look, Looked-At" (p. 27), "'Swap'" (p. 42: "swapped cards
maintain the orientation … of the original card"), "Defend, Defense" (p. 15).

**Plan.** `TriggerEvent boostCardGiven { enemyInstanceId, instanceId, activation: "attack" | "scheme", playerId }`,
a response window after each facedown boost card an enemy is given, the extra ones included (Klaw 51032, Playing for
Keeps 51041), opened only when an ability listens. The event's effects: `lookAt` both cards (the player's view only),
an optional `swapCards` (the new boost card stays facedown, the old one is the facedown top of the deck), then a
draw per printed icon of whichever card is now the boost card. The "(defense)" label is handled as for any
defense-labeled event of earlier waves.

**Tests.** Boost card with 0 icons, top card with 3: swapped, 3 cards drawn, and the activation later turns up the
3-icon card. Not swapped: 0 drawn. A scheme's boost card: not offered. Klaw's second boost card: a second window, and
a second copy may be played.

### 3.45 An interrupt to an encounter card being dealt to a player

> **Status: not started (new).** `dealEncounterCardTo` (`effects.ts`) deals at once; `AbilityCost.dealEncounterCards`
> (wave 3 §3.20) and `dealtEncounterCount` exist. A grep for "would be dealt" as a trigger finds nothing.

**Cards.** Aerial Recon 53009 (scan): "Hero Action: Exhaust Aerial Recon and deal a player 1 facedown encounter card
→ place 1 recon counter here. Interrupt: When a player would be dealt an encounter card, remove 1 recon counter from
here instead."

**Rules.** RRG "Deal, Deal an Encounter Card" (p. 15): step three of the villain phase, and "If a card ability
instructs a player to be dealt an encounter card". RRG "'Would'" (p. 48), "'Instead'" (p. 25), "Cost" (p. 13).

**Plan.** `TriggerEvent encounterCardBeingDealt { playerId, source: "villainPhase" | "ability" | "deckReset" |
"hazard", sourceInstanceId }`, an interrupt window before each card is taken from the deck, opened only when an
ability listens. Replacing it leaves the card on the deck and deals nothing; a count of cards dealt "this way" does
not include it. It hears every deal to any player: the villain phase's, a hazard icon's, a player deck running out,
a card's "deal … as a facedown encounter card" (Serpent Solutions, The Raft). A surge is a reveal, not a deal, and
is not heard. The interrupt is not a Hero Interrupt, so it works in either form. The Hero Action's own deal may be
replaced by a counter already there: the cost is then unpaid and no counter is placed (as wave 8 §3.54 has it for a
replaced ready).

**Tests.** The action deals player 2 a card: 1 recon counter, player 2 has 2 cards to reveal that round. Villain
phase step three with 1 counter: the controller removes it and that player is dealt 0 cards. With 0 counters: not
offered. Serpent Solutions' deal of a discarded minion replaced: the minion stays in the encounter discard pile.

### 3.46 Payment details: once per card paid for; the cards that paid; a tucked resource card any player may spend

> **Status: not started (extend).** `AbilityLimit.per` is `"aspectOfEventCard" | "player" | "triggeringEvent"`;
> a resource "for an [X] card" exists (wave 4 §3.30); the payment is remembered as `paid.*` vars and
> `paid.cards.<cardType>` counts (`stack.ts`), with `paidWithCard` for a named card, but not as a slot of cards;
> `spendableForAnyPlayer` is for resource abilities. A grep of `payable.ts` for "tucked" finds nothing.

**Cards.** Falcon's Flock 53006 (scan): "Uses (5 bird counters). Resource: Remove 1 bird counter from here → generate
a [energy] resource for an Aerial card. (Limit once per card.)" Spectrum 53018: "Response: After you play Spectrum,
tuck 1 card used to pay for her under her. If that card's printed resource has: [mental] – Spectrum gets +2 THW.
[physical] – +2 ATK. [energy] – +2 hit points. [wild] – All of the above." Resource Reserve 53021: "Max 1 per player.
Any player may spend the resource card tucked here as if it were in their hand. Action: Exhaust Resource Reserve →
tuck 1 resource card from your hand under here (to a maximum of 1)."

**Rules.** RRG "Limit" (p. 27), "Resource Ability" (p. 37), "Tuck" (p. 45). Ruling June 2, 2026 – Ruling 2 (2):
"Spectrum only gains bonuses while a card remains tucked under her."

**Plan.**

- (a) `AbilityLimit.per: "paidCard"`: one use for each card or ability being paid for, the count kept on the payment
  and dropped when it ends. Without it one card could take all five counters.
- (b) The cards discarded from hand (or spent from elsewhere) to pay for a play are bound on its `cardPlayed`
  announcement as slot `paid.cards`, read where they are now. Spectrum's player picks one still in a discard pile and
  tucks it; with none (paid by resource abilities, or put into play without being played) nothing is tucked. The
  bonuses are a constant read from the tucked card's printed resources: each type it prints gives its bonus once, a
  wild gives all three, and a card that later leaves ends them (the ruling).
- (c) `RuleSpec spendableFromTucked { cards, by }`: a resource card tucked under the rule's card is a payment source
  for every player, spent "as if it were in their hand", generating what it would from hand (The Power of Flight
  doubles for an Aerial card) and going to its owner's discard pile. The action is refused while a card is tucked.

**Tests.** A 3-cost Aerial card: one bird counter spent, the second use refused, 4 counters left; a second card that
turn takes another. The fifth counter spent: Falcon's Flock is discarded. Spectrum paid with Genius and three other
cards: Genius tucked, THW 1 + 2; paid with a wild-resource card: THW 3, ATK 3, 5 hit points. The tucked card leaves:
her bonuses end, and damage above her 3 hit points defeats her. Resource Reserve holding Strength: player 2 spends it
for 2 physical and it is in its owner's discard pile.

### 3.47 A hero that does not exhaust to defend

> **Status: not started (extend).** `EffectSpec declareDefender { exhaust: false }` ("declare … the defender without
> exhausting", wave 4 §3.22) is one declaration by one effect. No lasting rule changes the basic defense itself.

**Cards.** Draw Their Fire 53011: "Hero Response: After the villain phase begins, discard Draw Their Fire → Falcon
does not exhaust to defend until the end of the phase."

**Rules.** RRG "Defend, Defense" (p. 15): "A hero must exhaust to use this power"; "A card ability that allows a hero
to be declared as a defender without exhausting can be used on an exhausted hero"; "Only one player at a time can
defend against an enemy attack."

**Plan.** `RuleSpec defendsWithoutExhausting { character, while? }`, carried by `applyRuleUntil` to the end of the
phase: that hero's basic defense is offered whether he is ready or exhausted and does not exhaust him, for each
attack, against any player. Everything else about a defense is unchanged (one defender per attack, "after you
defend" responses). An exhausted Falcon may defend under it, by the RRG sentence above read for this wording
(flagged, §4.2). If he changes to alter-ego form he cannot defend.

**Tests.** Three attacks in one villain phase (the villain, a minion, a quickstrike reveal): Falcon defends all three
with DEF 2 and is ready afterward. Falcon exhausted from the player phase: he defends and stays exhausted. The rule
is gone when the phase ends.

### 3.48 The number of different traits among a group of cards

> **Status: not started (extend).** `ValueSpec distinctAspects` and `distinctCardTypes` exist; a grep for
> `distinctTraits` finds nothing. Alliance is a keyword rule of an earlier wave (`alliance.test.ts`).

**Cards.** Strength in Diversity 53019: "Alliance. Hero Action: For each different Trait on friendly characters in
play, choose: Remove 1 threat from a scheme. Deal 1 damage to an enemy."

**Rules.** RRG "Traits" (p. 45), "'For Each'" (p. 20): a "for each … choose" effect makes each choice its own
instance. RRG "Alliance" (p. 6).

**Plan.** `ValueSpec distinctTraits { of: TargetRef }`: the number of different traits among the cards named, each
read as it is now (the faceup side of an identity, gained traits included, a blank text box's printed traits kept).
The event repeats one `chooseOne` that many times.

**Tests.** Falcon (Aerial, Avenger), Redwing (Aerial, Avenger, Bird) and another player's Shuri (Genius, Wakanda):
5 choices. S.H.I.E.L.D. Deputy on Redwing: 6. Five choices of damage on one enemy with a tough status card: the
first discards it, 4 damage.

### 3.49 An attachment bound for the villain attached to another enemy; "the villain" on that card

> **Status: not started (new).** `attachment-hosts.ts` picks the host from the card's "attach to" text and
> `cardAttached` is a response. A grep for a "would be attached" interrupt or a host replacement finds nothing.

**Cards.** Fixer 53038 (scan; Techno 1/6, Elite, 15 hit points, Villainous, Victory 1): "Forced Interrupt: When a
non-scenario-specific Tech attachment would be attached to the villain, attach it to Fixer instead. Text on that card
that refers to 'the villain' refers to Fixer instead." Tech attachments of this wave: Jet Pack 53039 and Tech-Pac
53040 ("Attach to Fixer. Otherwise, attach to the villain"), Energy Truncheon 51040, High-Tech Armament 54030.

**Rules.** RRG "Attach To" (p. 8): "The 'attach to' phrase is checked for legality when the card would be attached";
"The 'attach to' phrase on a card is not resolved if another ability causes that card to attach to a specific game
element." RRG "Scenario-Specific Card" (p. 39).

**Plan.** `TriggerEvent cardBeingAttached { instanceId, hostInstanceId, sourceInstanceId }`, an interrupt window
opened only when an ability listens, and `EffectSpec replaceAttachHost { to, villainAlias? }`. With `villainAlias`
the attachment instance records the new host, and on that card alone `theVillain` (and "the villain" in its attach
text) resolves to it while it stays attached there. The interrupt hears every way an attachment reaches the villain:
a reveal, a boost ability's "attach this card to the villain", a search. An attachment whose own text names Fixer
first never reaches the interrupt. `scenarioSpecific: false` is the existing query.

**Tests.** Fixer in play, High-Tech Armament revealed with Crossbones out of play: it is on Fixer, and its "that enemy
activates against you" is Fixer's activation. A scenario's own Tech attachment: on the villain. Fixer defeated: his
attachments are discarded. Tech-Pac on Fixer with Jet Pack: +1 ATK more, and his SCH is 3 with Tech-Pac's own +1;
characters with a combined THW of 4 discard it, a combined 3 do not. Jet Pack on Fixer: 3 damage is prevented and Jet
Pack discarded; 2 damage is dealt.

### 3.50 An attachment that players attack "as if it were a minion"

> **Status: not started (new).** Damage on a card that is not a character exists (wave 4 §3.5), as do
> `RuleSpec cannotAttack` with an `attacker` scope (wave 3 §3.26), `attach` to a named host and `placeDamage`. Nothing
> makes a card that is not a character a target of attacks (grep of `attackableAs`, "as if it were a minion").

**Cards.** Encased in Ice 54035 (scan; Whiteout 2/6, Ice): "Attach to your identity. Attached character cannot
attack enemies other than this card. Any player can attack this card as if it were a minion. If there is 3 or more
damage here, move all but 3 damage here to attached character and discard this card." Blizzard 54034 (scan):
"Forced Response: After Blizzard attacks a character, search the encounter deck and discard pile for Encased in Ice
and attach it to that character. (Shuffle.) Otherwise, stun the attacked character."

**Rules.** RRG "Attach To" (p. 8), last bullet: Blizzard names the host, so an ally he attacked is encased and the
card's own "Attach to your identity" is not resolved. RRG "Move" (p. 30): damage moved to a character "is considered
to be dealt to that character". RRG "'Otherwise'" (p. 31).

**Plan.** `RuleSpec attackableAsMinion { card: self }`:

- Wherever a player's attack chooses "an enemy" or "a minion" (a basic attack, an attack-labeled ability), the card
  is a candidate for every player, engaged with no one. It is no candidate for anything that is not an attack, nor
  for an attack that names enemies by a group ("each minion engaged with you").
- Damage dealt to it is placed on it. It has no hit points, no status cards and no keywords of a minion, is never
  defeated, and gives no excess damage. Guard, which protects the villain, does not protect it.
- A state check on the card: at 3 or more damage, all but 3 is dealt to the attached character (as moved damage: no
  attacker, not an attack) and the card is discarded. It was discarded, not defeated: "attack and defeat an enemy"
  (Winter Soldier's kit) does not answer.
- "Attached character cannot attack enemies other than this card" is `cannotAttack` scoped to the attached
  character, target every enemy; the card itself stays attackable by that character.
- Blizzard's response: with a copy in the deck or discard pile it attaches and the deck is shuffled; with none (both
  attached), the attacked character is stunned.

**Tests (exact numbers).** Winter Soldier encased: his basic attack offers only the card; ATK 2 places 2; a second
character's attack for 2 makes 4: 1 damage is dealt to Winter Soldier and the card is discarded. Metal Punch (7) on
the card: 4 dealt to him, no overkill excess anywhere. An attack for exactly 3: 0 moved, discarded. Blizzard attacks
an ally: the ally is encased. Both copies attached and Blizzard attacks: the character is stunned. Lethal Protector
after the card is discarded: no response.

### 3.51 Rulings, FAQ entries and errata on cards the engine already covers

> **Status: not started (exists, verify).** Each line is a test the scripting agent writes; a failure comes back as
> an extend.

- **Aerial Evacuation 53008** (scan). Rulings December 17, 2025 – Ruling 1 (2), March 6, 2026 – Ruling 1 and July 9,
  2026 – Ruling 2: it prevents damage **taken**; "damage is still considered dealt". Ruling January 17, 2026 – Ruling
  3 (2): "keywords have timing priority over triggered abilities. Piercing removes the Tough status card before Aerial
  Evacuation triggers" (`pierceBeforeInterrupts` cites it). Ruling March 6, 2026 – Ruling 1 (2): with overkill against
  a protected ally, "Sam Wilson does not take excess Overkill damage". The other hero's controller changes form too;
  either change is skipped for a player who cannot change form.
- **Arm Block 54004** (scan). Ruling January 17, 2026 – Ruling 2 (against Black Widow, §3.4) and March 6, 2026 –
  Ruling 1 (1): "Arm Block prevents damage taken; because damage was still dealt, Sonic Boom still exhausts Winter
  Soldier."
- **Captain America 53023 and Captain America's Shield 53034** (scans). Ruling June 25, 2026 – Ruling 1: with Steve
  Rogers in the game, "Falcon takes the Shield into his hand and plays it under his control. If discarded, it
  returns to Steve's discard pile"; Steve "cannot pay costs for Shield Toss with cards he does not control"
  (`takeIntoHand { keepOwner }`, wave 7 §4.1 Q53). The linked 53034 is set aside for a deck that holds 53023 (RRG
  p. 27) and belongs to the player who takes it. Ruling August 3, 2026 – Ruling 4 (3): "Linked cards cannot be
  included in decks." `findCard` reaches both shields; the player picks (flagged, §4.2). "If it leaves play this way"
  is true only for a shield found in play.
- **The Elephant's Trunk 51007.** RRG FAQ (p. 65, checked): exhausting only itself pays the cost. Ruling February 28,
  2026 – Ruling 8 (2) is about Family Matters' "each", not this "up to".
- **Target Spotter 51038** (scan). RRG FAQ (p. 65, checked): it "interrupts the engagement of that minion and causes
  it to engage the player using Target Spotter instead" (`resolve/enter-play.ts` cites it).
- **Quick Quip 52034.** Ruling March 6, 2026 – Ruling 2: one enemy may be chosen (`divide` with `maxTargets`).
- **"Stop Hitting Yourself" 52016.** Ruling December 17, 2025 – Ruling 2: playable after a defense-labeled ability
  made the hero the defender; the damage is the hero's current DEF (4 with Not Today!).
- **S.H.I.E.L.D. Deputy 54033** (scan prints no maximum). **Erratum, RRG p. 70 (checked):** "Attach to a friendly
  character. Max 1 per character." Scripted with the maximum; a data correction (§8.1).
- **Team-Up** (RRG p. 43). Heart of the Panther 51025 names two identity cards by both sides (`titles.ts`, an earlier
  wave's decision): it needs Core's T'Challa and this pack's Shuri in the same game, so it is never playable solo.
  Investigative Journalism 52024 needs Cindy Moon faceup and Peter Parker, as an alter-ego or as the Spider-Man ally
  52022 by subtitle. Super-Soldiers 54022 and Winter, Widow, Soldier, Spy 54023 are met by the allies Captain America
  54012 and Black Widow 54003 of the same pack. The Captain America upgrade 53023 is not a character.

### 3.52 Reusable as is (pass 2; checked by name against the engine unions)

As §3.35: the identifier and its doc comment were read; the scripting agent's tests prove each.

- **An activation replaced or canceled.** Invisibility Gear 51019 ("that enemy schemes instead") is §3.9's
  replacement without `divert`; Ready for a Fight 52019 is its mirror ("would scheme" → `changeForm` to hero, then
  `enemyAttack`); Investigative Journalism 52024 cancels the activation and confuses (`cancelTriggeringEvent`).
- **Find and reveal, already in play** (51042, 52037, 53042, 54037) and **villainous, Victory 1** (Joystick, Atlas,
  Fixer, Blizzard): §3.35's vocabulary. Each of the four sets holds an Elite Thunderbolt minion, so each joins the
  Thunderbolts pool of §1.10.
- **Paid with.** `paidWithCard` and `resource` with `paidFor` (their docs cite Cybernetic Arm 54002), `paidWith`
  (Electrical Discharge 54006), a two-label ability (`label` is a list: Arm Block's "attack/defense").
- **Costs.** `exhaustCardsCost` with a maximum and a bind (The Elephant's Trunk, Firepower 54014, Tech-Pac 53040 with
  `totalStatOf`), `removeUpToCounters` (Stun Gun 52020), `spendX` (Energy Shield 52018), `returnToHandCost` and
  `exhaustThis` (Redwing), `chooseCardCost` with a printed-cost superlative (Red Room Programming 54027).
- **Cost changes.** `costModifier` with `activeIn: "hand"` (Spider-Byte 52014, Dora Milaje 51030), a cost increase on
  an obligation in play (T'Challa's Shadow 51031), `reduceNextCardCost` with a filter or a count (Soup Kitchen 53007,
  Man on the Wall 54019).
- **Keywords and limits by condition.** `gainsKeyword` with `while` (Bambino 54018: restricted on an identity; Winter
  Armor 54009: steady on an identity), `allyLimit` with `while` and `maxWithTrait` (Flight Squadron 53020; the test
  file names it), `statusLimit`.
- **Obligations that stay in play with uses and Victory 0** (51031, 53029), **a player side scheme found by search**
  (Manifold 51014, J. Jonah Jameson 52007), **`lookAt` with a victory display pick and top or bottom** (Going
  Undercover 51016), **`abilityResolved`** (White Widow 54032), **`minionEngaged`** (Aggressive Stance 54017),
  **damage redirected** (Scarlet Spider 52013), **`preventConsequentialDamage`** (Wingman 53024).
- **Counters and state checks.** Atlas 52035 (growth counters, +2 hit points each), Grow Invulnerable 52036 (a loss
  while it is in play and Atlas holds 10), Harlem's Protector 53029.

## 4. Open questions (for the user or FFG)

### 4.1 Rules questions for the owner

Seven questions, all open (6 and 7 are pass 2's). **A is the recommended default in every one, and every §8.2 task
that touches a question builds on A until the owner answers.** None is settled by a ruling: no FFG ruling in the repo
names these cases, except that one ruling half-answers question 6 (§4.2). The long form of each is in §4.2.

| Q   | Question                                                                                          | A (default)                                                                                 | B                                                                          | Cites                                                                     | Decision |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| 1   | A Board Member flips from environment to attachment: what happens to its secret counters?         | They stay on it (the rulebook's setup and stage 3B count them)                              | They are discarded (the flip changes the card's type)                      | RRG "Flip" p. 20 against MC50 pp. 11 and 19, card 50169b                  | open     |
| 2   | Citizen V is stunned or confused and "would activate" against a player engaged with a Thunderbolt | The status card resolves first: it is discarded, no heal                                    | His Forced Interrupt first: no activation, he heals, the status card stays | MC50 p. 22 FAQ; RRG "'Would'" p. 48, "Stun" p. 41, "Activation" p. 6      | open     |
| 3   | M.O.D.O.K. has "+5 hit points" attached when his hit points are "reset to 10"                     | As printed: set to 10, then the attachment is discarded and he drops to 5                   | The reset ends at his printed value: 10 after the attachment leaves        | RRG "Hit Points" p. 22; cards 50103a, 50114                               | open     |
| 4   | "This attack" in a Preparation when the attack has several targets (Spray Fire on Black Widow)    | The whole attack: all its damage is prevented, or all of it resolves against the one minion | Only the part aimed at Black Widow                                         | MC50 p. 9; ruling January 17, 2026 – Ruling 2; cards 50073, 50076         | open     |
| 5   | A card makes an enemy attack an ally: do "after [enemy] attacks you" abilities answer?            | Yes, against the ally's controller (the later RRG text and the ruling)                      | No (the rulebook's bullet)                                                 | RRG "Attack" p. 8; ruling December 17, 2025 – Ruling 3; MC50 p. 4         | open     |
| 6   | Bird of Prey and Bird's-Eye View: "You may discard the top card" when it is faceup with no icons  | Not offered (the FAQ's reason for Redwing: the player knows it does nothing)                | Offered: the card is discarded for 0 additional                            | RRG FAQ p. 65; ruling January 26, 2026 – Ruling 6 (1); cards 53003, 53004 | open     |
| 7   | Hunting the Spider-Bride: is a cost, or the identity's four-card cap, "a player card effect"?     | Yes: any discard a player card causes, cost or effect, the cap included, deals the 2 damage | No: only an effect; a cost (Cindy Moon's action) and the cap are free      | RRG "Cost" p. 13; cards 52001a/b, 52009, 52031                            | open     |

### 4.2 The questions as asked

Each is implemented the way stated, or not at all, and named here rather than decided silently.

1. **A Board Member's secret counters when it flips to its attachment face.** (§3.26.) RRG "Flip" (p. 20): when the
   new face has "a different card type from the previous face, all attached cards, tucked cards, status cards, and
   tokens are discarded from the card", and an all-purpose counter is a token (p. 6). The box reads as if they
   stay: Fighting Zemo 3B (scan) places "1[per_hero] threat here for each secret counter on each Board Member
   attachment" in the same sentence that flips the mole; MC50 p. 19 calls it "the number of counters on each board
   member attachment"; and the campaign's setup (p. 11) says placing the recorded counters "will cause the
   environment to flip to its attachment side if enough secrets are placed on it", which only holds if a flipped
   member was recorded with its 4 or more.
   - **A (default):** the counters stay through this flip (card text and scenario rules over the Rules Reference,
     RRG p. 4). A member that flips at 4 is an attachment holding 4.
   - B: RRG "Flip" as written: the attachment starts at 0 and holds only what is placed on it afterward. A mole
     flipped by stage 3B then adds no threat of its own.
2. **Citizen V's "would activate" and a status card.** (§3.23.) MC50 p. 22, on Stealth: "Status cards take priority
   over all other effects, so the villain will remove the stunned status instead of activating." A stunned card is
   itself "Forced Interrupt: When this character would attack, remove each stunned status card from it instead"
   (RRG p. 41), and an activation is an attack or a scheme (RRG p. 6), so both abilities are "would" interrupts to
   the same thing.
   - **A (default):** the FAQ's sentence is general: the status card is discarded in place of the activation, and
     Citizen V's ability, having no activation left to replace, does not heal him.
   - B: his ability replaces the activation before any attack or scheme is initiated: he heals 4 (6) and keeps the
     status card for his next activation.
3. **A "+X hit points" attachment and the reset.** (§3.5.) Automated Mobile Unit 50114: "M.O.D.O.K. gets +5 hit
   points. Forced Response: After M.O.D.O.K.'s hit points are reset, discard this card." RRG "Hit Points" (p. 22):
   when such an ability "ceases to be in effect, reduce that character's hit point dial by X".
   - **A (default):** as printed. The dial is set to 10 (14 on the B face), the attachment is discarded and the dial
     drops to 5 (9).
   - B: "reset" means back to his printed value once everything has resolved: 10 (14).
4. **"This attack" with several targets.** (§3.4.) Nick Fury's own Spray Fire 50039 deals "3 damage to the villain
   and each minion engaged with that player" as one attack.
   - **A (default):** the Preparation speaks of the one attack. "Prevent all damage from this attack"
     (Attacrobatics, Night Vision Goggles) prevents the damage to every target, and "resolve this attack against
     A.I.M. Grunt instead" makes the Grunt its only target, for 3 damage once.
   - B: only the damage aimed at Black Widow is prevented or moved; the minions are damaged as usual.
5. **An attack a card aims at an ally, and "attacks you".** (§3.13.) MC50 p. 4: "Abilities that trigger when the
   attacking enemy 'attacks you' do not trigger." RRG 1.8 "Attack (Enemy Activation)" (p. 8), the later text: an
   enemy may be made to attack "an ally that player controls. In all of these cases, the player is still considered
   attacked", and "Abilities that trigger 'When/After [enemy] attacks you' are resolved when/after a player is
   attacked, regardless of which character they control was attacked." Ruling December 17, 2025 – Ruling 3 says the
   same of "after [enemy] attacks you". Neither says the rulebook's bullet was unintended. Cards that care:
   Heat-Seeking Missiles 50158, Innocent Bystanders 50134, and every attack at stage 3B of Extract Captives.
   - **A (default):** the RRG and the ruling, which is also what `enemyAttack.targetCharacter` does today.
   - B: the rulebook: such abilities do not trigger when a card effect aims the attack at an ally.

6. **An optional top-card discard that is known to add nothing.** (§3.42, §3.43.) Bird of Prey 53003: "Deal 4 damage
   to an enemy. You may discard the top card of the encounter deck to deal 1 additional damage to that enemy for each
   icon …"; Bird's-Eye View 53004 is the thwart twin. During Falcon's player phase the top card is faceup. RRG FAQ
   "Redwing (#2)" (p. 65) refuses Redwing "because the player knows that the ability will not be able to affect its
   target". Ruling January 26, 2026 – Ruling 6 (1) was asked about "Redwing ally hero action …, or cards like Bird's
   Eye View / Bird of Prey" and answered "No", giving its reason for Redwing only. The events differ from Redwing:
   they do something without the discard, and the discard is a "may" inside the effect, not the ability's cost.
   - **A (default):** the "No" covers them: with a faceup top card of 0 icons the option is not offered. Eagle-Eyed
     stays the way to discard an unwanted top card.
   - B: the option is offered and the card is discarded for 0 additional damage or threat.
7. **"A player card effect" in the Silk nemesis set.** (§3.39, §3.40.) Hunting the Spider-Bride 52031: "Forced
   Response: After a player card effect discards this card from under an identity, that identity takes 2 damage."
   Swinging Silk Kick and Wallcrawl discard a tucked card as an optional effect; Cindy Moon's action and Organic
   Webbing discard one as a **cost** ("Discard a card tucked here → draw 2 cards"); the identity's own "discard all
   but 4" is a constant on a player card. RRG "Cost" (p. 13) keeps a cost apart from an effect. No ruling names the
   card.
   - **A (default):** the card's line is between player cards and encounter cards: any discard a player card causes
     (cost, effect, or the cap) deals the 2 damage; Morlun's When Defeated and the treachery's own random discard do
     not. Otherwise Cindy Moon's action would clear the nemesis card and draw 2 cards for it.
   - B: "effect" as the RRG uses the word: only what follows a cost or stands without one. Cindy Moon's action,
     Organic Webbing and the cap discard it for free.

**Conventions used above, flagged rather than asked** (each follows a rule already cited; say so if any should be a
question):

- A choice a card gives to "the players" (advance from 2B, advance from Zemo's 1B, whose control a rescued ally
  enters under) is one choice answered by the first player (RRG "First Player", p. 19, read broadly).
- "After a secret counter is placed here" resolves once per placing effect, not once per counter (§3.26).
- A uses card emptied by a **move** of its last counter is discarded (RRG p. 46), which changes a wave 5 comment on
  `moveCounters` (§3.6).
- Stealth diverts only threat that was going to the main scheme (§3.9).
- An ally held by Hostage Situation is not a candidate for an enemy attack (§3.19).
- (Pass 2) Redemption's controller is the player who chose the minion: the player whose card removed the threat,
  else Show of Empathy's owner (§3.38).
- (Pass 2) Eidetic Memory's swap is not a tuck "by a player card effect": Silk Sense Overload does not redirect it
  (§3.41).
- (Pass 2) Talon Line is not offered when Eagle-Eyed's discarded card prints no icons, by the Redwing FAQ's reason
  (§3.43).
- (Pass 2) An exhausted Falcon may defend under Draw Their Fire, by RRG p. 15's sentence on a hero "declared as a
  defender without exhausting" (§3.47).
- (Pass 2) "Find Captain America's Shield" offers every card of that title a find reaches (RRG "Find", p. 19): the
  linked copy and, with Steve Rogers in the game, his (§3.51).
- (Pass 2) Encased in Ice is a candidate only where an attack chooses its target, not for an attack on a group of
  enemies (§3.50).
- (Pass 2) Aerial Recon's interrupt may replace its own action's deal; the cost is then unpaid (§3.45).

## 5. What this asks of the other agents (pass 1a)

- **`card-data-pipeline`:** the data survey for the wave, then `aos` emitted with §1's shapes and §1.14's
  corrections; the two additions (`definedCounterTypes`, the evidence grid with `evidenceIcon`); the five scenario
  records of §1.10 and the two starter decks of MC50 p. 7. The list is §8.1.
- **`ability-scripting-engineer`:** the modules of §8.4, one per line. Copy the card's own word where the box
  separates two things: "Board Member card" and "Board Member environment" (§3.26), the Preparation label and the
  Preparation trait (§1.2), "attacks you" and "attacks" (§4.1 Q5), "defeated" and a vulnerable discard (§3.1).
- **`encounter-ai-designer`:** the first player's choices this box adds (which captive is attacked, ties for
  Thunderbolt Backup, counters removed "from among", who takes a rescued ally), and §3.19's flag.
- **`rules-qa-engineer`:** a ruling test for each of: the six MC50 p. 22 FAQ answers; RRG FAQ pp. 64–65 (Maria Hill,
  Stealth); the two RRG p. 69 errata; rulings December 17, 2025 – 3, January 17, 2026 – 2, January 26, 2026 – 2 and
  4 (2); RRG p. 48's three Vulnerable bullets.
- **`game-client-engineer`:** new things a player must see: threat on an upgrade and on an environment; a minion
  held by an environment; the Holding Cell deck with its top card in play; the two hidden piles, the gained evidence
  and the 27-row grid with rows crossed out; the accusation choice; the glossary entry for Vulnerable and a Guided
  mode tip for Preparation, the suit forms and all-purpose counters (`docs/wave-definition-of-done.md` §5).
- **`content-release-tracker`:** the RRG's wrong collector number for Radiation Exposure (§0), so the erratum is
  filed against 50153.

### 5.1 Pass 2 (the four hero packs)

- **`card-data-pipeline`:** §8.1 items 12 to 17: one raw typo checked on a scan and one to check, the two errata as
  `current` text, the Thunderbolts pool with ten sets, the four Team-Up rows of `docs/team-ups.md`.
- **`ability-scripting-engineer`:** the modules of §8.4 lines 32 to 63. Copy the card's own word where the packs
  separate two things: "discarded" and "defeated" (Encased in Ice, Sting Operation), "would be dealt" damage and
  damage taken (Aerial Evacuation), "tucked … by a player card effect" (§3.40), "icons (★ and boost)" and boost icons
  (§3.43), "another Dora Milaje ally" and "you control" (§3.36).
- **`encounter-ai-designer`:** nothing new to decide for the villain; the four Thunderbolt minions are villainous and
  use the existing boost flow. The first player's choices: who is dealt The Raft's minion and Aerial Recon's card.
- **`rules-qa-engineer`:** a ruling test for each line of §3.51, the three RRG FAQ entries of p. 65, the two errata of
  p. 70, rulings March 19, 2026 – 5 (all three cases) and January 26, 2026 – 6 (both answers).
- **`game-client-engineer`:** new things a player must see: encounter cards tucked under an identity with their set
  icons (and the count against the cap of four); the encounter deck's top card faceup during Falcon's player phase;
  threat on a minion and a minion redeemed as an ally; Encased in Ice as an attack target holding damage; an
  attachment redirected to Fixer; bird, recon, growth, doubt, emergency, target, alert and ammo counters. A Guided
  mode tip for Specials, for the tucked-card kit, for the faceup top card (including why Redwing is refused at 0
  icons) and for Cybernetic Arm (`docs/wave-definition-of-done.md` §5).
- **`content-release-tracker`:** `resolve/swap-cards.ts` cites the Eidetic Memory erratum as p. 69; it is p. 70.

## 6. Later passes (placeholders)

Sections 6.2 to 6.5 are written and point to their sections. The others are placeholders: do not script from them.

### 6.1 Pass 1b: the MC50 campaign

**Placeholder.** The Campaign Instructions boxes (MC50 pp. 9, 11, 13, 15, 19), the campaign log (p. 24), the
envelopes across scenarios, secret counters and faces carried over, the evidence cards' "Setup" abilities
(50185–50193), persistent damage and the expert campaign (p. 6), scenario 5's Adaptoids and surviving Thunderbolts,
and its DEFEAT block.

### 6.2 Pass 2a: Black Panther (`bp`)

**Written.** §3.36–§3.38, §3.43 (a), §3.51, §3.52; cards in §7.9; modules in §8.4 lines 32 to 38.

### 6.3 Pass 2a: Silk (`silk`)

**Written.** §3.39–§3.41, §3.51, §3.52; question 7; cards in §7.10; modules in §8.4 lines 39 to 45.

### 6.4 Pass 2b: Falcon (`falcon`)

**Written.** §3.42–§3.49, §3.51, §3.52; question 6; cards in §7.11; modules in §8.4 lines 46 to 53.

### 6.5 Pass 2b: Winter Soldier (`winter`)

**Written.** §3.50–§3.52; cards in §7.12; modules in §8.4 lines 54 to 63.

### 6.6 Pass 2c: Trickster Takeover (`tt`)

**Placeholder.** Forced Action, the per-group icon, Enchantment attachments, the Avatars of Loki, single group mode
and the question of Epic Multiplayer Mode are this pass's.

## 7. Card coverage (pass 1a)

One row per record of the pass. **DSL** means the ability is written with vocabulary found by name this session
(§3.35 says which, for the less obvious ones); a section number means the card waits on that primitive. "none" is a
card with no ability text. A verdict is a plan, not a proof: §8.3 says who proves each.

### 7.1 Maria Hill and her nemesis set

| Id     | Title                  | Type        | Verdict                                                           |
| ------ | ---------------------- | ----------- | ----------------------------------------------------------------- |
| 50001a | Maria Hill             | hero        | §3.6 (Reassignment); the trait grant is DSL                       |
| 50001b | Maria Hill             | alter ego   | §3.10 (deck rule); the search is DSL                              |
| 50002  | Nick Fury              | ally        | §3.6                                                              |
| 50003  | All-Points Bulletin    | event       | DSL (one choice per support; MC50 p. 22: a different target each) |
| 50004  | On the Double          | event       | §3.11                                                             |
| 50005  | Reinforcements         | event       | §3.11, §3.6                                                       |
| 50006  | The Hard Call          | event       | DSL (discard as a cost, `printedCost`)                            |
| 50007  | Special Funding        | resource    | §3.6; DSL (§3.35, resources)                                      |
| 50008  | Support Staff          | support     | DSL (§3.35, resources)                                            |
| 50009  | The Iliad              | support     | DSL (uses; §3.35)                                                 |
| 50010  | Life Model Decoy       | upgrade     | DSL (`modifyAttack`, prevent all)                                 |
| 50011  | S.H.I.E.L.D. Director  | upgrade     | §3.6                                                              |
| 50029  | Press Conference       | obligation  | §3.6                                                              |
| 50030  | Controller             | minion      | §3.6, §3.32                                                       |
| 50031  | Army of the Controlled | side scheme | §3.6, §3.32                                                       |
| 50032  | Controlled Innocents   | environment | §3.32                                                             |
| 50033  | Diabolical Discs       | treachery   | §3.6, §3.32                                                       |

### 7.2 Nick Fury and his nemesis set

| Id     | Title                    | Type        | Verdict                                             |
| ------ | ------------------------ | ----------- | --------------------------------------------------- |
| 50034a | Nick Fury                | hero        | §3.7, §3.8                                          |
| 50034b | Nick Fury                | alter ego   | §3.8                                                |
| 50035a | Assault                  | upgrade     | §3.7 (b), §3.8                                      |
| 50035b | Stealth                  | upgrade     | §3.9, §3.8                                          |
| 50036  | Maria Hill               | ally        | §3.7                                                |
| 50037  | Concentrated Fire        | event       | §3.7, §3.8                                          |
| 50038  | Covert Surveillance      | event       | §3.7, §3.8                                          |
| 50039  | Spray Fire               | event       | DSL; §4.1 Q4 against Black Widow                    |
| 50040  | Fury's Flying Car        | support     | §3.7 (b)                                            |
| 50041  | Safe House #221          | support     | §3.7                                                |
| 50042  | EM Shield                | upgrade     | DSL (`modifyAttack`, prevent all)                   |
| 50043  | Eyepatch Camera          | upgrade     | §3.7 (`preventThreat` then a placement on the suit) |
| 50044  | Fury's Watch             | upgrade     | §3.7 (b)                                            |
| 50045  | Intelligence Analysis    | upgrade     | §3.7 (b)                                            |
| 50046  | Secret Agent             | upgrade     | §3.7; `abilityResolved` is DSL                      |
| 50059  | Discovered               | obligation  | §3.7, §3.8                                          |
| 50060  | Orion                    | minion      | §3.33 (`statusLimit`)                               |
| 50061  | Acquire Infinity Formula | side scheme | DSL                                                 |
| 50062  | Leviathan Soldier        | minion      | DSL                                                 |
| 50063  | Cold Storage             | treachery   | DSL                                                 |

### 7.3 The box's aspect and basic cards

| Id    | Title                  | Type     | Verdict                                               |
| ----- | ---------------------- | -------- | ----------------------------------------------------- |
| 50012 | Victoria Hand          | ally     | DSL                                                   |
| 50013 | Slingshot              | ally     | DSL (§3.35); §3.20 when Abduct Superhumans is in play |
| 50014 | Organizational Support | resource | DSL (§3.35, resources)                                |
| 50015 | Agents of S.H.I.E.L.D. | support  | DSL (§3.35, cancels)                                  |
| 50016 | Command Team           | support  | DSL (uses; §3.35)                                     |
| 50017 | The Circe              | support  | DSL (`choosePlayer`, `putIntoPlay` from that hand)    |
| 50018 | The Bellerophon        | support  | DSL (uses; §3.35)                                     |
| 50019 | The Douglass           | support  | DSL (uses; §3.35)                                     |
| 50020 | The Pericles           | support  | DSL (uses; §3.35)                                     |
| 50021 | Dum Dum Dugan          | ally     | DSL (interrupt to a basic power, `modifyBasicPower`)  |
| 50022 | Grant Ward             | ally     | DSL (`cannotDefend` cites it; removal from the game)  |
| 50023 | Melinda May            | ally     | DSL (§3.35, looking)                                  |
| 50024 | Super Spies            | event    | §3.6, §3.7, §3.10                                     |
| 50025 | Energy                 | resource | none (reprint, §1.13)                                 |
| 50026 | Genius                 | resource | none (reprint, §1.13)                                 |
| 50027 | Strength               | resource | none (reprint, §1.13)                                 |
| 50028 | Front Organization     | support  | DSL (`discardRedirected`)                             |
| 50047 | Agent Coulson          | ally     | DSL                                                   |
| 50048 | Quake                  | ally     | DSL (a response to `enemyScheme`)                     |
| 50049 | Global Logistics       | event    | DSL (§3.35, looking)                                  |
| 50050 | Informant              | upgrade  | DSL ("removes threat instead of placing it" exists)   |
| 50051 | Intelligence           | upgrade  | §3.12                                                 |
| 50052 | Prism Dust             | upgrade  | DSL; §3.1 against a vulnerable minion                 |
| 50053 | Under Surveillance     | upgrade  | DSL (reprint, §1.13)                                  |
| 50054 | Nick Fury, Sr.         | ally     | DSL                                                   |
| 50055 | Jemma Simmons          | support  | DSL (§3.35, resources)                                |
| 50056 | Leo Fitz               | support  | DSL                                                   |
| 50057 | Sky-Destroyer          | support  | DSL                                                   |
| 50058 | Practiced Plan         | upgrade  | DSL (§3.35)                                           |

### 7.4 Black Widow, A.I.M. Abduction, A.I.M. Science

| Id     | Title                  | Type        | Verdict                                          |
| ------ | ---------------------- | ----------- | ------------------------------------------------ |
| 50064  | Black Widow            | villain     | §3.2, §3.4                                       |
| 50065  | Black Widow            | villain     | §3.2, §3.4                                       |
| 50066  | Black Widow            | villain     | §3.2, §3.4                                       |
| 50067a | The Widow's Web        | main scheme | DSL (setup search, §2.2)                         |
| 50067b | The Widow's Web        | main scheme | DSL (`printedX` from the stage number)           |
| 50068  | Black Widow's Gauntlet | attachment  | §3.2, §3.4                                       |
| 50069  | Grappling Hook         | attachment  | §3.2; the cancel is DSL (§3.35)                  |
| 50070  | Night Vision Goggles   | attachment  | §3.2, §3.3                                       |
| 50071  | Stun Net               | attachment  | §3.2, §3.4                                       |
| 50072  | A.I.M. Commando        | minion      | §3.2, §3.4                                       |
| 50073  | A.I.M. Grunt           | minion      | §3.2, §3.4                                       |
| 50074  | Automated Defenses     | side scheme | §3.3; hinder is DSL                              |
| 50075  | Destroy Evidence       | side scheme | §3.33                                            |
| 50076  | Attacrobatics          | treachery   | §3.2, §3.4                                       |
| 50077  | Covert Ops             | treachery   | §3.2; the When Revealed is DSL                   |
| 50078  | Dance of Death         | treachery   | §3.2; the When Revealed is DSL                   |
| 50079  | Widow's Bite           | treachery   | §3.2, §3.4                                       |
| 50080  | A.I.M. Abductor        | minion      | §3.20                                            |
| 50081  | Abduct Superhumans     | side scheme | §3.20                                            |
| 50082  | Nabbed!                | treachery   | §3.20                                            |
| 50083  | A.I.M. Scientist       | minion      | §3.1; "cannot be attacked" with a `while` is DSL |
| 50084  | A.I.M. Soldier         | minion      | DSL (§3.35, find)                                |
| 50085  | Mad Science            | side scheme | §3.33                                            |

### 7.5 Batroc, Batroc's Brigade

| Id     | Title                            | Type        | Verdict                                              |
| ------ | -------------------------------- | ----------- | ---------------------------------------------------- |
| 50086a | Batroc                           | villain     | §3.5, §3.16                                          |
| 50086b | Batroc                           | villain     | §3.5, §3.16                                          |
| 50087a | Infiltrate A.I.M. Island Embassy | main scheme | DSL (§2.3)                                           |
| 50087b | Infiltrate A.I.M. Island Embassy | main scheme | §3.14                                                |
| 50088a | Locate Missing Person            | main scheme | none                                                 |
| 50088b | Locate Missing Person            | main scheme | §3.14, §3.15                                         |
| 50089a | Extract Captives                 | main scheme | §3.16                                                |
| 50089b | Extract Captives                 | main scheme | §3.13, §3.14, §3.33                                  |
| 50090a | Alert Level                      | environment | §3.7, §3.16                                          |
| 50090b | Alert Level                      | environment | §3.7, §3.16                                          |
| 50091  | Rescued Captive                  | ally        | §3.15                                                |
| 50092  | Heightened Reflexes              | attachment  | §3.25                                                |
| 50093  | Embassy Guard                    | minion      | §3.1, §3.33, §3.16                                   |
| 50094  | Embassy Patrol                   | minion      | §3.1, §3.33, §3.16                                   |
| 50095  | Commandeer Security Office       | side scheme | §3.16                                                |
| 50096  | Leaping Kick                     | treachery   | §3.13                                                |
| 50097  | Security Cameras                 | treachery   | §3.16                                                |
| 50098  | Machete                          | minion      | §3.1; the rest is DSL                                |
| 50099  | Rapido                           | minion      | DSL (`attackKeywords`, `attacksDealIndirectDamage`)  |
| 50100  | Zaran                            | minion      | §3.20 (existing tuck and `printedCost`; no new task) |
| 50101  | Batroc's Brigade                 | side scheme | §3.33; the cancel is DSL                             |
| 50102  | Soldiers of Fortune              | treachery   | DSL (§3.35)                                          |

### 7.6 M.O.D.O.K., Scientist Supreme

| Id     | Title                 | Type        | Verdict                                  |
| ------ | --------------------- | ----------- | ---------------------------------------- |
| 50103a | M.O.D.O.K.            | villain     | §3.5                                     |
| 50103b | M.O.D.O.K.            | villain     | §3.5                                     |
| 50104a | Upgrading Adaptoids   | main scheme | §3.17, §3.18                             |
| 50104b | Upgrading Adaptoids   | main scheme | §3.18                                    |
| 50105a | Holding Cell          | environment | §3.17                                    |
| 50105b | Flying Inhuman        | ally        | §3.15, §3.17                             |
| 50106a | Holding Cell          | environment | §3.17                                    |
| 50106b | Psionic Inhuman       | ally        | §3.15, §3.17                             |
| 50107a | Holding Cell          | environment | §3.17                                    |
| 50107b | Sarah Garza           | ally        | §3.15, §3.17                             |
| 50108a | Holding Cell          | environment | §3.17                                    |
| 50108b | Strong Inhuman        | ally        | §3.15, §3.17                             |
| 50109  | Flying Upgrade        | environment | §3.18                                    |
| 50110  | Psionic Upgrade       | environment | §3.18                                    |
| 50111  | Sarah Garza Upgrade   | environment | §3.18                                    |
| 50112  | Strong Upgrade        | environment | §3.18                                    |
| 50113  | Adaptoid              | minion      | §3.6, §3.18                              |
| 50114  | Automated Mobile Unit | attachment  | §3.5 (`hitPointsReset`); the rest is DSL |
| 50115  | Focusing Crystal      | attachment  | §3.5 (`hitPointsReset`); the rest is DSL |
| 50116  | Nanobots              | attachment  | §3.5 (`hitPointsReset`); the rest is DSL |
| 50117  | Psionic Force Field   | attachment  | §3.25                                    |
| 50118  | Psionic Machetes      | attachment  | §3.5 (`hitPointsReset`); the rest is DSL |
| 50119  | Reverse Engineering   | attachment  | §3.20, §3.5                              |
| 50120  | A.I.M. Jailer         | minion      | §3.13, §3.17                             |
| 50121  | Hostage Situation     | side scheme | §3.19                                    |
| 50122  | Psionic Enhancement   | side scheme | DSL (§3.35)                              |
| 50123  | "It's Alive!"         | treachery   | DSL (§3.35)                              |
| 50124  | Psionic Blast         | treachery   | DSL (§3.35)                              |
| 50125  | Scientist Supreme     | minion      | §3.1; the rest is DSL                    |
| 50126  | Monica Rappaccini     | minion      | §3.1; the rest is DSL                    |
| 50127  | Diplomatic Immunity   | side scheme | DSL (`victoryDisplayCount`)              |
| 50128  | Diplomatic Sanctions  | treachery   | DSL (`victoryDisplayCount`)              |

### 7.7 Thunderbolts and the six Thunderbolt sets

| Id     | Title                      | Type        | Verdict                                                     |
| ------ | -------------------------- | ----------- | ----------------------------------------------------------- |
| 50129a | Citizen V                  | villain     | §3.23                                                       |
| 50129b | Citizen V                  | villain     | §3.23                                                       |
| 50130a | Apprehending Rogue Agents  | main scheme | §3.22                                                       |
| 50130b | Apprehending Rogue Agents  | main scheme | §3.21                                                       |
| 50131a | Justice, Like Lightning    | environment | §3.22                                                       |
| 50131b | Thunderbolt Backup         | environment | §3.21                                                       |
| 50132  | Citizen V's Sword          | attachment  | DSL (§3.35)                                                 |
| 50133  | Jolt                       | minion      | DSL (§3.35)                                                 |
| 50134  | Innocent Bystanders        | obligation  | DSL (§3.35)                                                 |
| 50135  | The Coming Storm           | side scheme | §3.24                                                       |
| 50136  | Rumbling Thunder           | side scheme | §3.24                                                       |
| 50137  | Down but Not Out           | treachery   | DSL (§3.35)                                                 |
| 50138  | Tap In                     | treachery   | DSL (§3.35)                                                 |
| 50139  | Moonstone                  | minion      | DSL (§3.35)                                                 |
| 50140  | Rule the Skies             | side scheme | DSL (§3.35)                                                 |
| 50141  | Gravitational Pull         | treachery   | DSL (§3.35)                                                 |
| 50142  | Psychological Manipulation | treachery   | DSL (§3.35)                                                 |
| 50143  | Songbird                   | minion      | DSL (§3.35)                                                 |
| 50144  | Solid Sound Constructs     | attachment  | §3.33 (the extend)                                          |
| 50145  | Hard Sound Bindings        | attachment  | DSL (§3.35)                                                 |
| 50146  | Sonic Bubble               | side scheme | §3.25                                                       |
| 50147  | Hard Sound                 | treachery   | DSL (§3.35)                                                 |
| 50148  | Black Widow                | minion      | DSL (§3.35)                                                 |
| 50149  | Handspring                 | attachment  | §3.25                                                       |
| 50150  | Pride of the Red Room      | side scheme | DSL (§3.35)                                                 |
| 50151  | Pale Little Spider         | treachery   | DSL (§3.35)                                                 |
| 50152  | Radioactive Man            | minion      | DSL (§3.35)                                                 |
| 50153  | Radiation Exposure         | attachment  | §3.34                                                       |
| 50154  | Runaway Nuclear Reaction   | side scheme | §3.25                                                       |
| 50155  | Power of the Atom          | treachery   | DSL (§3.35)                                                 |
| 50156  | MACH-IV                    | minion      | §3.34                                                       |
| 50157  | Blasters                   | attachment  | DSL (§3.35)                                                 |
| 50158  | Heat-Seeking Missiles      | attachment  | DSL; §4.1 Q5                                                |
| 50159  | Aerial Dogfight            | side scheme | §3.34                                                       |
| 50160  | Supersonic                 | treachery   | DSL (§3.35)                                                 |
| 50161  | Batroc                     | minion      | DSL (§3.35)                                                 |
| 50162  | Coup de Foudre             | side scheme | DSL (`boostIcons`, a deck discard, `totalPrintedResources`) |
| 50163  | Batroc the Leaper          | treachery   | DSL (§3.35)                                                 |
| 50164  | Parcours du Combattant     | treachery   | §3.24                                                       |

### 7.8 Baron Zemo, S.H.I.E.L.D., the Executive Board, the evidence

| Id     | Title                            | Type                 | Verdict                                                                         |
| ------ | -------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| 50165a | Baron Zemo                       | villain              | §3.5, §3.27                                                                     |
| 50165b | Baron Zemo                       | villain              | DSL (a choice: a secret counter or a boost card); §3.26 for "Board Member card" |
| 50166a | Baron Zemo                       | villain              | §3.5, §3.27                                                                     |
| 50166b | Baron Zemo                       | villain              | DSL (a choice: a secret counter or a boost card); §3.26 for "Board Member card" |
| 50167a | Zemo's Manipulations             | main scheme          | §3.29                                                                           |
| 50167b | Zemo's Manipulations             | main scheme          | §3.29                                                                           |
| 50168a | The Accusation                   | main scheme          | §3.29, §3.26                                                                    |
| 50168b | The Accusation                   | main scheme          | §3.29, §3.26                                                                    |
| 50169a | Fighting Zemo                    | main scheme          | §3.29                                                                           |
| 50169b | Fighting Zemo                    | main scheme          | §3.26, §3.29                                                                    |
| 50170  | Baron Zemo's Sword               | attachment           | §3.27                                                                           |
| 50171  | Reluctant Foe                    | attachment           | §3.30                                                                           |
| 50172  | S.H.I.E.L.D. Agent               | minion               | §3.1, §3.27                                                                     |
| 50173  | Divided Loyalties                | side scheme          | §3.31, §3.27                                                                    |
| 50174  | Undermine Support                | side scheme          | §3.27 (`readyCost` exists)                                                      |
| 50175  | Battle of Wits                   | treachery            | §3.28, §3.27                                                                    |
| 50176  | Might Makes Right                | treachery            | §3.27                                                                           |
| 50177  | The Ends Justify the Means       | treachery            | §3.27                                                                           |
| 50178  | S.H.I.E.L.D. Trooper             | minion               | §3.1; the rest is DSL                                                           |
| 50179  | Arrest Warrant                   | obligation           | DSL (§3.35)                                                                     |
| 50180  | Disavowed                        | side scheme          | DSL (§3.35)                                                                     |
| 50181a | Chief Medical Officer            | environment          | §3.26                                                                           |
| 50181b | Medical Officer's Aid            | attachment           | §3.26                                                                           |
| 50182a | Chief Surveillance Officer       | environment          | §3.26                                                                           |
| 50182b | Surveillance Officer's Aid       | attachment           | §3.26                                                                           |
| 50183a | Chief Tactical Officer           | environment          | §3.26                                                                           |
| 50183b | Tactical Officer's Aid           | attachment           | §3.26                                                                           |
| 50184a | A.I.M. Interference ([energy])   | treachery            | §3.28                                                                           |
| 50184b | A.I.M. Interference ([mental])   | treachery            | §3.28                                                                           |
| 50184c | A.I.M. Interference ([physical]) | treachery            | §3.28                                                                           |
| 50185  | Medical Records                  | evidence means       | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50186  | Wiretap                          | evidence means       | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50187  | Security Scanner                 | evidence means       | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50188  | Money                            | evidence motive      | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50189  | Blackmail                        | evidence motive      | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50190  | Ideology                         | evidence motive      | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50191  | Security Clearance               | evidence opportunity | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50192  | Travel                           | evidence opportunity | §3.29 (a hidden card; its Setup text is pass 1b)                                |
| 50193  | Authority                        | evidence opportunity | §3.29 (a hidden card; its Setup text is pass 1b)                                |

### 7.9 Black Panther (`bp`): Shuri, her nemesis set, the pack's other cards, Extreme Risk

Pass 2. Verdicts as above; "DSL" for a pass 2 card means vocabulary named in §3.52 or found by name this session.

| Id     | Title                  | Type               | Verdict                                                                  |
| ------ | ---------------------- | ------------------ | ------------------------------------------------------------------------ |
| 51001a | Black Panther          | hero               | §3.36                                                                    |
| 51001b | Shuri                  | alter ego          | §3.37                                                                    |
| 51002  | T'Challa               | ally               | §3.36                                                                    |
| 51003  | Clawed Strike          | event              | §3.36                                                                    |
| 51004  | On the Prowl           | event              | §3.36                                                                    |
| 51005  | Wakanda Forever!       | event              | §3.36 (`resolveSpecials` cites it)                                       |
| 51006  | Vibranium              | resource           | none                                                                     |
| 51007  | The Elephant's Trunk   | support            | DSL (`exhaustThis`, `exhaustCardsCost` up to 2 more); §3.51 (FAQ p. 65)  |
| 51008  | Queen Ramonda          | support            | DSL (`heal` by the chosen alter-ego's REC)                               |
| 51009  | Aja-Adanna             | upgrade            | DSL (`ofClassification`, discard pile into the deck)                     |
| 51010  | Kimoyo Beads           | upgrade            | §3.36                                                                    |
| 51011  | Panther Claws          | upgrade            | §3.36                                                                    |
| 51012  | Spider Bites           | upgrade            | §3.36                                                                    |
| 51013  | Vibranium Suit         | upgrade            | §3.36 (`moveDamageFrom`)                                                 |
| 51014  | Manifold               | ally               | DSL (`choosePlayer`, a search for a player side scheme)                  |
| 51015  | Infiltration           | event              | §3.43 (a)                                                                |
| 51016  | Going Undercover       | player side scheme | DSL (`lookAt` 5, `addToVictoryDisplay`, `scenarioSpecific: false`)       |
| 51017  | Show of Empathy        | player side scheme | §3.38                                                                    |
| 51018  | The Raft               | support            | DSL (§3.39: a tuck from the encounter discard pile, a random deal)       |
| 51019  | Invisibility Gear      | upgrade            | DSL (§3.52: §3.9's replacement without `divert`)                         |
| 51020  | Sonic Rifle            | upgrade            | DSL (reprint of 20015)                                                   |
| 51021  | Sting Operation        | upgrade            | DSL (a response to `enemyScheme`; the minion is discarded, not defeated) |
| 51022  | Aneka                  | ally               | §3.36                                                                    |
| 51023  | Ayo                    | ally               | §3.36                                                                    |
| 51024  | Okoye                  | ally               | §3.36                                                                    |
| 51025  | Heart of the Panther   | event              | §3.36; Team-Up (§3.51)                                                   |
| 51026  | Build Support          | player side scheme | DSL (reprint of 40027)                                                   |
| 51027  | Energy                 | resource           | none (reprint)                                                           |
| 51028  | Genius                 | resource           | none (reprint)                                                           |
| 51029  | Strength               | resource           | none (reprint)                                                           |
| 51030  | Dora Milaje            | support            | §3.36; the ignored cost is DSL (§3.52)                                   |
| 51031  | T'Challa's Shadow      | obligation         | DSL (§3.52: an obligation in play with uses; cost +1)                    |
| 51032  | Klaw                   | minion             | DSL (`giveBoostCard`)                                                    |
| 51033  | Manipulated M.U.S.I.C. | side scheme        | DSL                                                                      |
| 51034  | M.U.S.I.C.             | minion             | DSL (`moveThreat` to the main scheme)                                    |
| 51035  | The Scream             | treachery          | DSL (stun, 1 damage to each already stunned)                             |
| 51036  | Redemption             | upgrade            | §3.38 (`treatAttachedMinionAsAlly` cites it)                             |
| 51037  | White Wolf             | ally               | DSL                                                                      |
| 51038  | Target Spotter         | support            | DSL (`resolve/enter-play.ts` cites it); §3.51 (FAQ p. 65)                |
| 51039  | Joystick               | minion             | DSL (`chooseOne` on `enemyActivating`)                                   |
| 51040  | Energy Truncheon       | attachment         | DSL (`attacksGainKeywords`, `enemyAttack`); §3.49 with Fixer in play     |
| 51041  | Playing for Keeps      | side scheme        | DSL (hand size, `giveBoostCard`)                                         |
| 51042  | Extreme Risk           | treachery          | DSL (§3.52, find and reveal)                                             |

### 7.10 Silk (`silk`): Silk, her nemesis set, the pack's other cards, Growing Strong

| Id     | Title                    | Type               | Verdict                                                             |
| ------ | ------------------------ | ------------------ | ------------------------------------------------------------------- |
| 52001a | Silk                     | hero               | §3.39                                                               |
| 52001b | Cindy Moon               | alter ego          | §3.39; §4.1 Q7                                                      |
| 52002  | Smooth as Silk           | event              | §3.39 (`discardEncounterUntil` by set)                              |
| 52003  | Swinging Silk Kick       | event              | §3.39                                                               |
| 52004  | Wallcrawl                | event              | §3.39                                                               |
| 52005  | Get the Scoop            | player side scheme | §3.39 (`triggerableBy`, `lookAt` 2, a tuck)                         |
| 52006  | Albert Moon              | support            | §3.39                                                               |
| 52007  | J. Jonah Jameson         | support            | DSL                                                                 |
| 52008  | Eidetic Memory           | upgrade            | §3.41 (erratum p. 70)                                               |
| 52009  | Organic Webbing          | upgrade            | §3.39; §4.1 Q7                                                      |
| 52010  | Outwit                   | upgrade            | §3.39                                                               |
| 52011  | Spider Claws             | upgrade            | §3.39                                                               |
| 52012  | Spider Reflexes          | upgrade            | §3.39 (the top card of the encounter discard pile, `atEndOfAttack`) |
| 52013  | Scarlet Spider           | ally               | DSL (§3.52, damage redirected)                                      |
| 52014  | Spider-Byte              | ally               | DSL (§3.52, cost changes)                                           |
| 52015  | Not Today!               | event              | DSL (reprint of 38016)                                              |
| 52016  | "Stop Hitting Yourself"  | event              | DSL; §3.51                                                          |
| 52017  | Dr. Sinclair             | support            | DSL (`triggerableBy`)                                               |
| 52018  | Energy Shield            | upgrade            | DSL (§3.52, costs)                                                  |
| 52019  | Ready for a Fight        | upgrade            | DSL (§3.52, an activation replaced)                                 |
| 52020  | Stun Gun                 | upgrade            | DSL (§3.52, costs)                                                  |
| 52021  | Madame Web               | ally               | DSL (`lookAt`, a count of Web-Warrior cards)                        |
| 52022  | Spider-Man               | ally               | DSL (reprint of 27049)                                              |
| 52023  | Across the Spider-Verse  | event              | DSL (reprint of 27018)                                              |
| 52024  | Investigative Journalism | event              | DSL (§3.52); Team-Up (§3.51)                                        |
| 52025  | Energy                   | resource           | none (reprint)                                                      |
| 52026  | Genius                   | resource           | none (reprint)                                                      |
| 52027  | Strength                 | resource           | none (reprint)                                                      |
| 52028  | Silk Sense Overload      | obligation         | §3.40 (a)                                                           |
| 52029  | Morlun                   | minion             | §3.39 (the count); §3.40 (its discard)                              |
| 52030  | The Great Hunt           | side scheme        | §3.39 (the count)                                                   |
| 52031  | Hunting the Spider-Bride | treachery          | §3.40 (b); §4.1 Q7                                                  |
| 52032  | Spider-Man 2099          | ally               | DSL                                                                 |
| 52033  | Spider-Woman             | ally               | DSL                                                                 |
| 52034  | Quick Quip               | event              | DSL (`divide` with `maxTargets`); §3.51                             |
| 52035  | Atlas                    | minion             | DSL (§3.52, counters)                                               |
| 52036  | Grow Invulnerable        | side scheme        | DSL (§3.52, a loss by state check)                                  |
| 52037  | Growing Strong           | treachery          | DSL (§3.52, find and reveal)                                        |
| 52038  | Titanic Proportions      | treachery          | DSL (indirect damage among the players)                             |

### 7.11 Falcon (`falcon`): Falcon, his nemesis set, the pack's other cards, Techno

| Id     | Title                    | Type        | Verdict                                                             |
| ------ | ------------------------ | ----------- | ------------------------------------------------------------------- |
| 53001a | Falcon                   | hero        | §3.42; Eagle-Eyed is DSL, heard by §3.43 (b) and (c)                |
| 53001b | Sam Wilson               | alter ego   | DSL                                                                 |
| 53002  | Redwing                  | ally        | §3.42, §3.43 (a)                                                    |
| 53003  | Bird of Prey             | event       | §3.43; §4.1 Q6                                                      |
| 53004  | Bird's-Eye View          | event       | §3.43; §4.1 Q6                                                      |
| 53005  | Up, Up, and Away         | event       | §3.44                                                               |
| 53006  | Falcon's Flock           | support     | §3.46 (a)                                                           |
| 53007  | Soup Kitchen             | support     | DSL (§3.52, cost changes)                                           |
| 53008  | Aerial Evacuation        | upgrade     | DSL; §3.51                                                          |
| 53009  | Aerial Recon             | upgrade     | §3.45                                                               |
| 53010  | Battlefield Awareness    | upgrade     | §3.42, §3.43 (a)                                                    |
| 53011  | Draw Their Fire          | upgrade     | §3.47                                                               |
| 53012  | Talon Line               | upgrade     | §3.43 (c)                                                           |
| 53013  | Vibranium Microweave     | upgrade     | DSL                                                                 |
| 53014  | Adam Warlock             | ally        | DSL (reprint of 17011)                                              |
| 53015  | Aero                     | ally        | DSL                                                                 |
| 53016  | Cloud 9                  | ally        | DSL (reprint of 29014)                                              |
| 53017  | Hugin & Munin            | ally        | DSL (a search of the top 10; the icon count of §3.43)               |
| 53018  | Spectrum                 | ally        | §3.46 (b); §3.51                                                    |
| 53019  | Strength in Diversity    | event       | §3.48                                                               |
| 53020  | Flight Squadron          | support     | DSL (§3.52, limits by condition)                                    |
| 53021  | Resource Reserve         | support     | §3.46 (c)                                                           |
| 53022  | The Triskelion           | support     | DSL (reprint of 01073)                                              |
| 53023  | Captain America          | upgrade     | DSL (`findCard`, `takeIntoHand`); §3.51                             |
| 53024  | Wingman                  | upgrade     | DSL (§3.52)                                                         |
| 53025  | Energy                   | resource    | none (reprint)                                                      |
| 53026  | Genius                   | resource    | none (reprint)                                                      |
| 53027  | Strength                 | resource    | none (reprint)                                                      |
| 53028  | The Power of Flight      | resource    | DSL (reprint of 42022)                                              |
| 53029  | Harlem's Protector       | obligation  | DSL (§3.52)                                                         |
| 53030  | Viper                    | minion      | DSL; its discard is heard by §3.43 (b)                              |
| 53031  | Serpent Solutions        | side scheme | §3.43 (b)                                                           |
| 53032  | Serpent Soldier          | minion      | DSL                                                                 |
| 53033  | Adder-tisement           | treachery   | DSL                                                                 |
| 53034  | Captain America's Shield | upgrade     | DSL (linked); §3.51                                                 |
| 53035  | Winter Soldier           | ally        | DSL                                                                 |
| 53036  | Misty Knight             | ally        | DSL (`encounterLookDiscardCost`'s look as an effect; §3.43's count) |
| 53037  | Ops Room                 | support     | DSL                                                                 |
| 53038  | Fixer                    | minion      | §3.49                                                               |
| 53039  | Jet Pack                 | attachment  | DSL (a damage threshold); §3.49                                     |
| 53040  | Tech-Pac                 | attachment  | DSL (§3.52, costs); §3.49                                           |
| 53041  | Technological Innovation | side scheme | DSL (`searchAndReveal`); the revealed attachment meets §3.49        |
| 53042  | Techno                   | treachery   | DSL (§3.52, find and reveal)                                        |

### 7.12 Winter Soldier (`winter`): Winter Soldier, his nemesis set, the pack's other cards, Whiteout

| Id     | Title                       | Type        | Verdict                                           |
| ------ | --------------------------- | ----------- | ------------------------------------------------- |
| 54001a | Winter Soldier              | hero        | DSL ("attack and defeat")                         |
| 54001b | Bucky Barnes                | alter ego   | DSL                                               |
| 54002  | Cybernetic Arm              | upgrade     | DSL (§3.52, paid with; `resource` cites it)       |
| 54003  | Black Widow                 | ally        | DSL (played from hand)                            |
| 54004  | Arm Block                   | event       | DSL (§3.52, paid with); §3.51                     |
| 54005  | Metal Punch                 | event       | DSL (§3.52, paid with)                            |
| 54006  | Electrical Discharge        | event       | DSL (§3.52, paid with)                            |
| 54007  | Safe House #30              | support     | DSL (a search of the encounter deck for a minion) |
| 54008  | Silent Infiltration         | upgrade     | DSL                                               |
| 54009  | Winter Armor                | upgrade     | DSL (§3.52, keywords by condition)                |
| 54010  | Winter Mask                 | upgrade     | DSL                                               |
| 54011  | Winter Rifle                | upgrade     | DSL                                               |
| 54012  | Captain America             | ally        | DSL                                               |
| 54013  | Deathlok                    | ally        | DSL                                               |
| 54014  | Firepower                   | event       | DSL (§3.52, costs)                                |
| 54015  | One by One                  | event       | DSL (reprint of 28014)                            |
| 54016  | Spoiling for a Fight        | event       | DSL (`discardEncounterUntil`); heard by §3.43 (b) |
| 54017  | Aggressive Stance           | upgrade     | DSL (§3.52)                                       |
| 54018  | Bambino                     | upgrade     | DSL (§3.52, keywords by condition)                |
| 54019  | Man on the Wall             | upgrade     | DSL (§3.52, cost changes)                         |
| 54020  | S.H.I.E.L.D. Sidearm        | upgrade     | DSL                                               |
| 54021  | Nick Fury, Sr.              | ally        | DSL (reprint of 50054)                            |
| 54022  | Super-Soldiers              | event       | DSL; Team-Up (§3.51)                              |
| 54023  | Winter, Widow, Soldier, Spy | event       | DSL; Team-Up (§3.51)                              |
| 54024  | Energy                      | resource    | none (reprint)                                    |
| 54025  | Genius                      | resource    | none (reprint)                                    |
| 54026  | Strength                    | resource    | none (reprint)                                    |
| 54027  | Red Room Programming        | obligation  | DSL (§3.52, costs)                                |
| 54028  | Crossbones                  | minion      | DSL                                               |
| 54029  | Hydra Hit Squad             | side scheme | DSL                                               |
| 54030  | High-Tech Armament          | attachment  | DSL; §3.49 with Fixer in play                     |
| 54031  | Hydra Mercenary             | minion      | DSL (guard only)                                  |
| 54032  | White Widow                 | ally        | DSL (§3.52, `abilityResolved`)                    |
| 54033  | S.H.I.E.L.D. Deputy         | upgrade     | DSL; §3.51 (erratum p. 70)                        |
| 54034  | Blizzard                    | minion      | §3.50                                             |
| 54035  | Encased in Ice              | attachment  | §3.50                                             |
| 54036  | Slippery Conditions         | side scheme | DSL                                               |
| 54037  | Whiteout                    | treachery   | DSL (§3.52, find and reveal)                      |

## 8. Build order (pass 1a)

Written 2026-10-09 from §3's status lines. None of this wave's engine work has landed, and none of the identifiers
the plans propose (`grantsLabeledAbility`, `attackResolvedLabeled`, `definedCounterTypes`, `rotateEngagement`,
`replaceLeaveDestination`, `dealHiddenPiles`, `gainFromHiddenPile`, `accuse`, `additionalPowerCost`,
`statusBeingGiven`, `topCardInPlay`) exists in `packages/engine/src`, `packages/cards/src/dsl` or the schema (grep,
this session). Later passes append their own rows; the numbering here is kept.

One queue task per agent and per commit. **At most one engine agent at a time** (`packages/engine`,
`packages/cards/src/dsl`, the shared scenario builders, and `packages/content/src/schema` for a schema change);
beside it, at most two other agents on files that do not overlap. **At most three scripting agents at once and
never two in one file.** A module is scripted only once every queue task it waits on has landed.

### 8.1 Data: what is left

Nothing of `aos` is emitted. For `card-data-pipeline`, in order; none blocks an engine task except where said.

1. **The evidence grid** (§1.12): 27 rows from MC50 p. 24 at 300 dpi, `evidenceIcon` on 50185–50193, read twice.
   Blocks engine task 20 and the `baron-zemo` module.
2. The data survey (`docs/phase7-wave9-data-survey.md`), with a scan read for every face not in §0's list.
3. `BaseCard.definedCounterTypes` and its parser rule (§1.6). Lands with engine task 2.
4. Preparation abilities as labeled, non-boost references on 50068–50073 and 50076–50079 (§1.2). Before task 9.
5. The villains of §1.3 (fixed hit points for 50086a/b, 50103a/b, 50165a, 50166a; `sideBCardId`; Zemo's two cards),
   the main schemes of §1.4, the double-sided cards of §1.5, the scenario records of §1.10.
6. §1.14's corrections 1 to 8, and §1.7's zeros.
7. `offAspectPackages` on 50001b (§1.11); the two starter decks (MC50 p. 7), with the suit form upgrade permanent
   and uncounted.
8. `schemeIcons` on a minion, an attachment and an obligation (§1.8), with the validator's answer reported.
9. The Executive Board set as an extra, uncounted set with its 2 secret counters each (§1.10).
10. The Thunderbolts pool derived from the trait query (§1.10).
11. Reprints (§1.13); the cycle renamed "Agents of S.H.I.E.L.D."; hero art out of `art/heroes/_pending/` when the
    box becomes playable.
12. (Pass 2) `textReplace` on Infiltration 51015: "remote" → "remove" (scan checked). Metal Punch 54005's raw "en
    enemy" and the stray `</b>` at the end of Morlun 52029's raw text: read each scan first.
13. (Pass 2) The two errata as `current` text (RRG p. 70): Eidetic Memory 52008 ("your identity", twice; the emitted
    `current` still says "Silk") and S.H.I.E.L.D. Deputy 54033 ("Max 1 per character", with its per-host maximum).
14. (Pass 2) The Thunderbolts pool of §1.10 now holds ten sets: Extreme Risk, Growing Strong, Techno and Whiteout
    each hold an Elite, Thunderbolt minion. Confirm the derived pool and its test.
15. (Pass 2) The four starter decks against the survey's §6.2 lists, each 40 cards by script; Redemption 51036 and
    Captain America's Shield 53034 as linked, set-aside cards outside every deck.
16. (Pass 2) `docs/team-ups.md`: four pairs (Black Panther/T'Challa and Black Panther/Shuri; Cindy Moon and Peter
    Parker; Captain America and Winter Soldier; Black Widow and Winter Soldier). No art folder exists for any.
17. (Pass 2) Unique icons checked on scans for 51016, 51017 and 52005; the reprints by `duplicate_of_code` (`bp` 5,
    `silk` 6, `falcon` 7, `winter` 5) into `reprints.ts`'s source list.

### 8.2 Engine queue, in order

22 tasks: one for each of the 3 **new** rows and the 15 **extend** rows of §3, three of them split in two because
they hold two independent changes (§3.6, §3.7, §3.29), and one for the extend inside §3.33's verify row. "After N" names
a dependency, not just the order. The order: what most scripts need; the heroes'
primitives; then the scenarios in box order.

**Pass 2 adds tasks 23 to 36**: one for each of the 4 **new** rows and the 6 **extend** rows of §3.36–§3.50, with
§3.40 and §3.43 split in two and §3.46 in three. None of their identifiers (`cardBeingTucked`, `replaceTuckHost`,
`tuckedCardDiscarded`, `discardFromEncounterDeck`, `boostCardGiven`, `encounterCardBeingDealt`, `spendableFromTucked`,
`defendsWithoutExhausting`, `distinctTraits`, `cardBeingAttached`, `replaceAttachHost`, `villainAlias`,
`attackableAsMinion`) exists in the engine or the DSL (grep, this session). They depend on none of tasks 1 to 22
except where said, so they may be queued in any order after the pass 1 tasks a hero of pass 1 waits on.

File paths are under `packages/engine/src/` unless they start with `dsl/` (`packages/cards/src/dsl/`) or `schema/`
(`packages/content/src/schema/`). Every task adds its own colocated test file with the row's exact-number tests.
**Decisions:** a §4.1 question the task builds on at default A until answered.

| #   | §                   | Change                                                                                                                                 | Files                                                                                                             | Decisions | Unblocks                                         |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| 1   | 3.1                 | Vulnerable in `giveStatus`: discard, not defeat; steady; ahead of simultaneous damage; log `vulnerableDiscarded`                       | `effects.ts`, `keywords.ts`, `resolve/effects-frame.ts`, `events.ts`                                              | none      | eight minions in six sets                        |
| 2   | 3.6 (a)             | `definedCounterType`; `counterType: "allPurpose"` lands as the destination's type; `counterType: "any"` on removal, values and queries | `schema/cards/base.ts`, `spec.ts`, `select.ts`, `effects.ts`, `resolve/apply-effect.ts`, `choices.ts`             | none      | Maria Hill's kit and nemesis set; Adaptoid 50113 |
| 3   | 3.6 (b) (after 2)   | `moveCounters.amount`; arriving counters retyped; `countersPlaced` on the destination; a uses card emptied by a move is discarded      | `spec.ts`, `effects.ts`, `resolve/apply-effect.ts`, `resolve/state-checks.ts`, `dsl/effects.ts`                   | none      | Maria Hill 50001a                                |
| 4   | 3.7 (a)             | `placeThreat` / `removeThreat` / `moveThreat` on a card that is not a scheme: tokens only, no scheme checks                            | `resolve/apply-effect.ts`, `resolve/target-validity.ts`, `select.ts`, `dsl/effects.ts`                            | none      | Nick Fury's kit; Alert Level                     |
| 5   | 3.7 (b) (after 4)   | `AbilityCost removeThreat { from, amount or choose }`, the paid amount bound                                                           | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `dsl/abilities.ts`, `dsl/validate.ts`                     | none      | 50035a, 50040, 50044, 50045                      |
| 6   | 3.11                | `chooseCards.maxTotal { of: "printedCost", atMost }`                                                                                   | `spec.ts`, `choices.ts`, `resolve/effects-frame.ts`, `dsl/effects.ts`                                             | none      | 50004, 50005                                     |
| 7   | 3.9 (after 4)       | `enemyScheme.divert { amount, to, if }` read at the place-threat step; the replaced attack deals no boost card                         | `spec.ts`, `resolve/apply-effect.ts`, `resolve/enemy-activation.ts`, `dsl/effects.ts`                             | none      | Stealth 50035b                                   |
| 8   | 3.12                | `lookAt` over dealt cards and the deck top; the `rearrange` choice; views for the acting player only                                   | `spec.ts`, `choices.ts`, `visibility.ts`, `resolve/apply-effect.ts`, `events.ts`                                  | none      | Intelligence 50051                               |
| 9   | 3.2                 | The `preparation` trigger kind; `resolveSpecials.which: "preparation"` on a card in the discard pile; the count on the attack          | `abilities.ts`, `spec.ts`, `resolve/effects-frame.ts`, `resolve/enemy-activation.ts`, `dsl/abilities.ts`          | none      | the Black Widow set                              |
| 10  | 3.3 (after 9)       | `RuleSpec grantsLabeledAbility`; granted abilities joined to the printed ones, the granting card as the named card                     | `abilities.ts`, `rules.ts`, `resolve/effects-frame.ts`, `dsl/abilities.ts`                                        | none      | 50070, 50074                                     |
| 11  | 3.4 (after 9)       | `modifyAttack.preventAll` with `bind` for a player attack; `Predicate attackResolvedLabeled`; `retargetAttack` onto a minion proved    | `spec.ts`, `select.ts`, `resolve/apply-effect.ts`, `resolve/attack-ability.ts`, `dsl/effects.ts`, `dsl/values.ts` | Q4 = A    | 50064–50066, 50068, 50073, 50076                 |
| 12  | 3.20                | `replaceLeaveDestination { to: { tuckedUnder } }` from an interrupt to `cardLeavesPlay`                                                | `spec.ts`, `resolve/cards.ts`, `resolve/defeat.ts`, `resolve/apply-effect.ts`                                     | none      | A.I.M. Abduction                                 |
| 13  | 3.17                | `ScenarioSeparateDeck.topCardInPlay`: the top card in play, the next entering play, a card put under an empty deck entering play       | `state.ts`, `resolve/separate-decks.ts`, `resolve/setup-cards.ts`, `resolve/other-face.ts`, `schema/sets.ts`      | none      | the M.O.D.O.K. set                               |
| 14  | 3.21                | A minion held by an environment (`attach … as: "heldMinion"`): in play, engaged with nobody, attackable by all, detached by `engage`   | `attachment-hosts.ts`, `resolve/attach.ts`, `resolve/apply-effect.ts`, `select.ts`, `legal.ts`                    | none      | the Thunderbolts set                             |
| 15  | 3.24                | `EffectSpec rotateEngagement`                                                                                                          | `spec.ts`, `resolve/apply-effect.ts`, `events.ts`, `dsl/effects.ts`                                               | none      | 50135, 50136, 50164                              |
| 16  | 3.33                | `TriggerEvent statusBeingGiven` and `on.wouldGainStatus`, opened only when an ability listens                                          | `effects.ts`, `trigger-events.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                                      | none      | Solid Sound Constructs 50144                     |
| 17  | 3.27                | `divide` over counters (remove); `superlative` by counters                                                                             | `spec.ts`, `choices.ts`, `resolve/effects-frame.ts`, `select.ts`                                                  | none      | the Baron Zemo set; the Executive Board set      |
| 18  | 3.26 (after 17)     | A flip that changes the card type, attaches to the villain and keeps its counters                                                      | `resolve/other-face.ts`, `resolve/attach.ts`, `spec.ts`, `dsl/effects.ts`                                         | Q1 = A    | 50181a/b–50183a/b                                |
| 19  | 3.29 (a)            | `GameState.hiddenPiles` and `revealedPileCards`; `dealHiddenPiles`; `gainFromHiddenPile`; never in a view                              | `state.ts`, `spec.ts`, `visibility.ts`, `resolve/apply-effect.ts`, `events.ts`                                    | none      | 50167a/b                                         |
| 20  | 3.29 (b) (after 19) | `EffectSpec accuse` over the scenario's grid; `accused`, `mole`, `wrongGuesses`, `accusedWrong`; needs data item 1                     | `spec.ts`, `choices.ts`, `resolve/apply-effect.ts`, `events.ts`, `dsl/effects.ts`                                 | none      | 50168a/b, 50169b                                 |
| 21  | 3.30                | A `CollectionSearchFilter` for identity cards; `treatHostAsMinion` on an identity card with no controller                              | `spec.ts`, `resolve/collection.ts`, `treat-as.ts`, `abilities.ts`                                                 | none      | Reluctant Foe 50171                              |
| 22  | 3.31                | `RuleSpec additionalPowerCost` over other characters' attack, thwart and defense                                                       | `abilities.ts`, `actions.ts`, `legal.ts`, `defense-claim.ts`, `resolve/basic-power-by.ts`                         | none      | Divided Loyalties 50173                          |
| 23  | 3.40 (a)            | `TriggerEvent cardBeingTucked` with `byPlayerCard`, opened only when an ability listens; `EffectSpec replaceTuckHost`                  | `trigger-events.ts`, `spec.ts`, `resolve/apply-effect.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`              | none      | Silk Sense Overload 52028                        |
| 24  | 3.40 (b) (after 23) | `activeIn: "tucked"`; `TriggerEvent tuckedCardDiscarded` with the host and `byPlayerCard`                                              | `abilities.ts`, `trigger-events.ts`, `effects.ts`, `resolve/triggers.ts`, `dsl/validate.ts`                       | Q7 = A    | Hunting the Spider-Bride 52031                   |
| 25  | 3.42                | `RuleSpec topOfDeckFaceup.deck: "encounter"`; `Predicate topOfDeckFaceup` on it; views and the `encounterTopShown` log                 | `abilities.ts`, `select.ts`, `visibility.ts`, `deck-top.ts`, `events.ts`, `dsl/abilities.ts`, `dsl/values.ts`     | Q6 = A    | Falcon's kit                                     |
| 26  | 3.43 (a)            | `AbilityCost.discardFromEncounterDeck { amount or choose, slot }`                                                                      | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `effects.ts`, `dsl/abilities.ts`                          | none      | 51015, 53002, 53010                              |
| 27  | 3.43 (b), (c)       | `cardDiscardedFromDeck` for the encounter deck; `abilityResolved` carries the resolved ability's slots                                 | `trigger-events.ts`, `resolve/deck-discard.ts`, `resolve/triggers.ts`, `resolve/ability.ts`, `dsl/abilities.ts`   | none      | Serpent Solutions 53031, Talon Line 53012        |
| 28  | 3.44                | `TriggerEvent boostCardGiven`; `lookAt` and `swapCards` over a facedown boost card and the deck top                                    | `trigger-events.ts`, `resolve/enemy-activation.ts`, `resolve/swap-cards.ts`, `visibility.ts`, `dsl/abilities.ts`  | none      | Up, Up, and Away 53005                           |
| 29  | 3.45                | `TriggerEvent encounterCardBeingDealt`, opened only when an ability listens; a replaced deal leaves the card on the deck               | `trigger-events.ts`, `effects.ts`, `resolve/reveal.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                 | none      | Aerial Recon 53009                               |
| 30  | 3.46 (a)            | `AbilityLimit.per: "paidCard"`                                                                                                         | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`                                                            | none      | Falcon's Flock 53006                             |
| 31  | 3.46 (b)            | Slot `paid.cards` on a play's announcement: the cards that paid for it                                                                 | `stack.ts`, `select.ts`, `resolve/play-card.ts`, `dsl/values.ts`                                                  | none      | Spectrum 53018                                   |
| 32  | 3.46 (c)            | `RuleSpec spendableFromTucked`: a tucked resource card as a payment source for every player                                            | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `resources.ts`, `dsl/abilities.ts`                        | none      | Resource Reserve 53021                           |
| 33  | 3.47                | `RuleSpec defendsWithoutExhausting`                                                                                                    | `abilities.ts`, `rules.ts`, `defense-claim.ts`, `defend-preview.ts`, `resolve/enemy-activation.ts`                | none      | Draw Their Fire 53011                            |
| 34  | 3.48                | `ValueSpec distinctTraits { of }`                                                                                                      | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                           | none      | Strength in Diversity 53019                      |
| 35  | 3.49                | `TriggerEvent cardBeingAttached`; `EffectSpec replaceAttachHost`; `CardInstance.villainAlias` read by `theVillain`                     | `trigger-events.ts`, `state.ts`, `attachment-hosts.ts`, `resolve/attach.ts`, `select.ts`, `dsl/effects.ts`        | none      | the Techno set                                   |
| 36  | 3.50                | `RuleSpec attackableAsMinion`: a target of attacks that holds damage, never defeated                                                   | `abilities.ts`, `select.ts`, `legal.ts`, `resolve/attack-ability.ts`, `resolve/target-validity.ts`                | none      | the Whiteout set                                 |

### 8.3 The "exists (verify)" and "exists (compose)" rows

No engine task. The scripting line that first needs each row proves it in a test, and a failure comes back here as
an extend.

| §    | Proved by (module, §8.4)                                | The test that proves it                                                                        |
| ---- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 3.5  | `batroc`, `modok`, `baron-zemo`                         | §3.5 tests 1, 3, 4, 6; Q3's numbers under the default                                          |
| 3.8  | `nick-fury/identity`                                    | Break Cover then Assault's interrupt in one attack                                             |
| 3.10 | `maria-hill/identity`                                   | the six deck cases of §3.10                                                                    |
| 3.13 | `batroc`, `modok`                                       | Leaping Kick's overkill past another player's ally; 3B's redirect                              |
| 3.14 | `batroc`                                                | the two-player walk through all three stages                                                   |
| 3.15 | `batroc`                                                | a captive cannot be chosen for a discard, and is defeated by damage                            |
| 3.16 | `batroc`                                                | Low to High at 8, the loss at 8, the consequential "except"                                    |
| 3.18 | `modok`                                                 | the third completion loses in standard mode                                                    |
| 3.19 | `modok`                                                 | the defeating player takes the held ally                                                       |
| 3.22 | `thunderbolts`                                          | one player and four players                                                                    |
| 3.23 | `thunderbolts`                                          | 0 hit points with one in the victory display; the heal with no boost card; Q2's default        |
| 3.25 | `batroc`, `modok`, the Thunderbolt sets                 | each card's numbers in §3.25                                                                   |
| 3.28 | `executive-board`                                       | 2 spent, 2 counters not placed                                                                 |
| 3.32 | `maria-hill/obligation-nemesis`                         | a 1 / 1 / 1 facedown minion and its defeat                                                     |
| 3.33 | `black-widow`, `aim-science`                            | incite on a card being revealed; three acceleration icons                                      |
| 3.34 | `power-of-the-atom`, `supersonic`                       | THW −1 for a Gamma hero; nobody may defend MACH-IV                                             |
| 3.36 | `bp/shuri/identity`, `bp/shuri/support-upgrades-allies` | "on 1" with two upgrades; a Special that discards its card; a Special on another player's ally |
| 3.37 | `bp/shuri/identity`                                     | the three plays of §3.37                                                                       |
| 3.38 | `bp/aspect-basic`                                       | the redeemed minion and Redemption's victory display                                           |
| 3.39 | `silk/silk/identity`                                    | the cap with a fifth card; a count by set; nothing tucked for a Victory minion                 |
| 3.41 | `silk/silk/support-upgrades-allies`                     | the tucked card revealed and resolved; not offered on a flip                                   |
| 3.51 | the module of each card named                           | one test per line of §3.51                                                                     |
| 3.52 | the module of each card named                           | Invisibility Gear and Ready for a Fight; Bambino on an identity; Flight Squadron's limit       |

### 8.4 Scripting order

`ability-scripting-engineer`, one agent per line, one module per line. Paths are relative to
`packages/cards/src/wave9/`. "Waits on" lists §8.2 task numbers; a line with none can start once the data is
emitted.

**The scaffold**

1. `card-groups.ts`, the registries, the coverage guard, `setup.ts` (`wave9Scenario`, `wave9StarterDeckSetup`: the A
   or B villain face by mode, `setAsideCardIds`, the Thunderbolts' set count), `reprints.ts`. Waits on nothing.

**Heroes.** Per hero: identity; events; supports, upgrades and allies; obligation and nemesis set; then a starter
deck e2e game.

Maria Hill (`aos/maria-hill/`):

2. `identity` (50001a/b): waits on 2 and 3.
3. `support-upgrades-allies` (50002, 50008–50011): waits on 2.
4. `events` (50003–50007; Special Funding is a resource card and lives here): waits on 2 and 6.
5. `obligation-nemesis` (50029–50033): waits on 2.
6. Maria Hill starter deck e2e.

Nick Fury (`aos/nick-fury/`):

7. `identity` (50034a/b): waits on 4.
8. `support-upgrades-allies` (50035a/b, 50036, 50040–50046): waits on 4, 5 and 7.
9. `events` (50037–50039): waits on 4.
10. `obligation-nemesis` (50059–50063): waits on 4.
11. Nick Fury starter deck e2e.

The box's other player cards:

12. `aos/aspect-basic` (50012–50028, 50047–50058): waits on 2 and 4 (Super Spies) and 8 (Intelligence); Prism Dust's
    test needs 1.

**Encounter sets, one module each** (`aos/<set>.ts`), in scenario order:

13. `black-widow` (50064–50079): waits on 9, 10 and 11.
14. `aim-abduction` (50080–50082): waits on 12.
15. `aim-science` (50083–50085): waits on 1.
16. Black Widow scenario game.
17. `batroc` (50086a/b–50097): waits on 1 and 4.
18. `batrocs-brigade` (50098–50102): waits on 1.
19. Batroc scenario game.
20. `modok` (50103a/b–50124): waits on 2 and 13.
21. `scientist-supreme` (50125–50128): waits on 1.
22. M.O.D.O.K. scenario game.
23. `thunderbolts` (50129a/b–50138): waits on 14 and 15.
24. `gravitational-pull` (50139–50142), `pale-little-spider` (50148–50151), `power-of-the-atom` (50152–50155),
    `supersonic` (50156–50160): one line each, waiting on nothing.
25. `hard-sound` (50143–50147): waits on 16.
26. `the-leaper` (50161–50164): waits on 15.
27. Thunderbolts scenario game, at one and at four players.
28. `executive-board` (50181a/b–50184c): waits on 17 and 18.
29. `shield` (50178–50180): waits on 1.
30. `baron-zemo` (50165a/b–50177, with the evidence of 50185–50193 as hidden cards): waits on 1, 17, 18, 19, 20, 21
    and 22, and on data item 1.
31. Baron Zemo standalone scenario game, seeded.

**Pass 2: the four hero packs.** Paths stay relative to `packages/cards/src/wave9/`; each pack's `card-groups`
entries join the scaffold of line 1. One pack at a time (the owner's standing rule), at most three modules of that
pack at once.

Black Panther (`bp/shuri/`):

32. `identity` (51001a/b): waits on nothing.
33. `events` (51003–51006; Vibranium is a resource card and lives here): waits on nothing.
34. `support-upgrades-allies` (51002, 51007–51013): waits on nothing.
35. `obligation-nemesis` (51031–51035): waits on nothing.
36. `bp/aspect-basic` (51014–51030, 51036–51038): waits on 26 (Infiltration).
37. `bp/extreme-risk` (51039–51042): waits on nothing.
38. Black Panther starter deck e2e.

Silk (`silk/silk/`):

39. `identity` (52001a/b): waits on nothing; Q7 at its default.
40. `events` (52002–52004): waits on nothing.
41. `support-upgrades-allies` (52005–52012; Get the Scoop is a player side scheme and lives here): waits on nothing.
42. `obligation-nemesis` (52028–52031): waits on 23 and 24.
43. `silk/aspect-basic` (52013–52027, 52032–52034): waits on nothing.
44. `silk/growing-strong` (52035–52038): waits on nothing.
45. Silk starter deck e2e, with Morlun's set dealt in.

Falcon (`falcon/falcon/`):

46. `identity` (53001a/b): waits on 25.
47. `events` (53003–53005): waits on 25 and 28.
48. `support-upgrades-allies` (53002, 53006–53013): waits on 25, 26, 27, 29, 30 and 33.
49. `obligation-nemesis` (53029–53033): waits on 27.
50. `falcon/aspect-basic` (53014–53028, 53034–53037): waits on 31, 32 and 34.
51. `falcon/techno` (53038–53042): waits on 35.
52. Falcon starter deck e2e.
53. A Thunderbolts scenario game whose seeded pool draws one of the four new sets.

Winter Soldier (`winter/winter-soldier/`):

54. `identity` (54001a/b): waits on nothing.
55. `events` (54004–54006): waits on nothing; Arm Block's Black Widow test needs 11.
56. `support-upgrades-allies` (54002, 54003, 54007–54011): waits on nothing.
57. `obligation-nemesis` (54027–54031): waits on nothing; High-Tech Armament's Fixer test needs 35.
58. `winter/aspect-basic` (54012–54026, 54032, 54033): waits on nothing.
59. `winter/whiteout` (54034–54037): waits on 36.
60. Winter Soldier starter deck e2e.
61. A two-player game, Shuri and Core's T'Challa, that plays Heart of the Panther.
62. A two-player game, Falcon with the Captain America upgrade and Steve Rogers, for ruling June 25, 2026 – Ruling 1.
63. The pass 2 ruling tests of §5.1 that no module above owns.

### 8.5 The campaign, the client and Guided mode

**Placeholder** for pass 1b and pass 3.
