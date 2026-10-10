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

| Pass   | Scope                                                                                                   | State             |
| ------ | ------------------------------------------------------------------------------------------------------- | ----------------- |
| **1a** | **The box in standalone play: new rules and keywords, five scenarios, their modular sets, both heroes** | **written**       |
| 1b     | The MC50 campaign; evidence cards in campaign mode; the Executive Board across scenarios                | written (pass 1b) |
| 2a     | Black Panther (`bp`), Silk (`silk`)                                                                     | written (pass 2)  |
| 2b     | Falcon (`falcon`), Winter Soldier (`winter`)                                                            | written (pass 2)  |
| 2c     | Trickster Takeover (`tt`): Forced Action, the per-group icon, Enchantress, Loki                         | written (pass 2c) |
| 3      | The owner's answers written in and reconciled; §8 extended to the whole wave                            | not written       |

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
- **Pass 1b's content (written 2026-10-09).** The campaign: MC50 pp. 4–6, the Campaign Instructions boxes on pp. 9, 11,
  13, 15 and 19, the log on p. 24, and the "Setup" abilities of the nine evidence cards. Sections 0.3, 1.16, 2.9,
  3.73–3.78, questions 11 to 14, §5.3, §7.16, §8.1 items 28–33, §8.2 tasks 51–56, §8.4 lines 73–81 and §8.5. **The box
  has no campaign-specific card** (RRG "Campaign-Specific Card", p. 11): the Executive Board set is also a modular set
  (MC50 p. 6) and the evidence is dealt in a standalone Baron Zemo game (p. 18). What is campaign only is text: the
  lower half of each evidence card, and two clauses of Zemo's Manipulations.
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

- **Pass 2c's content (written 2026-10-09).** Trickster Takeover (`tt`, MC55): 66 raw records and their 15 nested b
  faces (55004b, 55005b, 55007b–55011b, 55027b–55034b), every one read by script and every face read on a scan, plus the
  two unnumbered rules cards (§0.2). Sections 0.2, 1.15, 2.8, 3.53–3.72, questions 8 to 10, §5.2, §7.13–§7.15, §8.1
  items 18 to 27, §8.2 tasks 37 to 50, the pass 2c rows of §8.3 and §8.4 lines 64 to 72. **Loki, God of Lies ships in
  Single Group Mode only** (owner, 2026-10-09). Epic Multiplayer Mode is the multiplayer phase's
  (`docs/epic-multiplayer-plan.md`); §3.64–§3.69 are the engine and DSL groundwork that plan's §3 marks "build now",
  each checked against the engine as it is and corrected where the plan's shape did not fit, and every God of Lies
  script is written against them so Epic changes no card (§8.4).
- **What the pack adds.** One rule, **Forced Action** (§3.53); the **per group icon** (§3.65); the keywords Hinder,
  Incite, Linked, Patrol, Permanent, Stalwart, Steady and Victory, all of earlier waves (MC55 pp. 2–3); "Find", of
  wave 7. Enchantress: charm counters on a hidden double-sided attachment that turns each player from Defiant to
  Enthralled (§3.54–§3.56). God of Lies: a villain and a main scheme no player can touch, four Avatars of Loki that
  are never defeated but flip, are counted in shatter counters and swap (§3.59, §3.60), and four Synergy environments
  that hold synergy counters (§3.61).

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

### 0.2 Pass 2c sources (Trickster Takeover)

- **The insert**, `docs/campaign-modes/mc55_rulebook-web.pdf` (24 pages) and its text layer
  `docs/campaign-modes/markdown/mc55_trickster_takeover.md`, read whole. Cited as "MC55 p. N" by the insert's own page
  numbers. The text layer loses every icon (the per group icon on p. 4, the per player icons in "10 … remaining hit
  points" on p. 20 and "2 …" on p. 21, the star icons) and scrambles the stat boxes of the cards pictured on pp. 5, 16
  and 17: those were read from the card scans instead. No page of the PDF was rendered this session; nothing below
  depends on the insert's layout.
- **Card text.** `packages/content/raw/marvelcdb/tt.json`, all 66 records and 15 nested faces by script; the emitted
  `packages/content/src/data/tt/` (`cards.ts`, `scenarios.ts`, `encounterSets.ts`) and its curation file. **Scans read
  this session** (`assets/card-art/bundles/cards/`, as contact sheets): every face of the pack, 55001–55066 with
  55004a/b, 55005a/b, 55007a/b–55011a/b and 55027a/b–55034a/b. The double-sided faces are 289 × 419 pixel scans and were
  read enlarged; Spellbound 55022, Mischief and Mayhem 55033b and Worlds Collide 55028b were read a second time at full
  size. **Every printed-card claim of this pass is "checked"** against those scans. Differences from the raw cache, all
  in §1.15: Spellbound's ability is a **When Defeated** (raw: "When Revealed"); Wrapped in Chains prints "identity"
  (raw: "identiy"); the four Fading Figments print hit points **∞** (raw: 99).
- **The two rules cards** (no MarvelCDB record, no collector number):
  `docs/campaign-modes/mc55-reference-cards/shatter-the-illusion.png` and `epic-multiplayer-reminder.png`, both read
  this session (checked) and matching the transcription in `docs/phase7-wave9-handoff.md` word for word.
- **RRG 1.8** (page numbers from the PDF's text layer by script): "Ability" (pp. 4, 6: Forced Action), "Ally Limit" (p.
  7), "Choose (Option)" (p. 12), "Find" (p. 19), "First Player" (p. 19), "Flip" (p. 20), the forced-ability bullets (p.
  20), "Hinder X" (p. 22), "Hit Points" (p. 22), "Incite X" (p. 24), "Indirect Damage" (p. 24), "Linked (Card Title)"
  (p. 27), "Max, Maximum" (p. 28), "Modes of Play" (p. 28), "Patrol" (p. 32), "Per Player Icon" (p. 32), "Permanent" (p.
  32), "Player Elimination" (p. 34), "Resource Ability" (p. 37), "Stalwart" (p. 40), "Steady" (p. 41), "'Swap'" (p. 42),
  "Target" (p. 43), "Victory X" (p. 46), "When Revealed Abilities" (p. 48), "'Would'" (p. 48). **The RRG has no entry
  for the per group icon, for pods or for groups** (searched: "per group", "pod"), and no FAQ entry for the pack; its
  one erratum for the pack is on p. 70 ("Rulebook pg. 19, Swapping Avatars of Loki, paragraph 1", §3.60).
- **FFG rulings.** Every card title of the pack and the words "Trickster", "God of Lies", "Enchantress", "charm",
  "shatter", "synergy", "Forced Action" and "per group" were matched against the rulings file and each hit read:
  February 28, 2026 – Ruling 3 (Shatter the Illusion and permanent attachments), February 28, 2026 – Ruling 5 (Spell
  Blast, two answers), March 19, 2026 – Ruling 2 (Whirlwind and Enchantress), June 25, 2026 – Ruling 5 (Total Focus and
  Dark Scepter). December 17, 2025 – Ruling 4 (3) (what "Find" reaches) is cited by §3.63. No other ruling names a card
  of the pack.
- **One ruling states an intent**: February 28, 2026 – Ruling 3, "Scenario intent takes precedence", built as ruled
  (§3.60); the RRG's p. 70 erratum now says the same in rules text. **No ruling of this pass disagrees with the RRG or
  the insert.** The three questions of this pass (§4.1 Q8 to Q10) are places where a card and the insert, or a card and
  the RRG, read differently and no ruling speaks.
- **The Epic plan**, `docs/epic-multiplayer-plan.md` §1.3 to §1.5 and §3, read whole. Its option B (one unmodified
  engine per group, a pod coordinator outside them) is taken as decided; §3.64–§3.69 say where its proposed shapes were
  changed and why.

### 0.3 Pass 1b sources (the campaign)

- **The rulebook, read as pictures.** Pages 4, 5, 6, 9, 11, 13, 15, 19 and 24 were rendered with PyMuPDF at 120 dpi and
  read this session, and the lower half of p. 24 again at 230 dpi. **Every MC50 quote of pass 1b from those nine pages
  is checked against its render.** Page 18 was not rendered: its quotes are the markdown conversion's and pass 1a's
  (§3.29). Pages 20 and 21 (the conclusion) were not read.
- **Layout the conversion loses** (checked on the renders):
  - The "Expert Campaign Only" bullets are a shaded box that closes a list. On pp. 11, 13, 15 and 19 the Setup list ends
    with the same two shaded bullets, printed **after** the "After resolving mulligans" bullet (§4.1 Q13). On pp. 9, 11,
    13 and 15 the Victory list ends with one. Scenario 1's Setup (p. 9) has no shaded bullet, and scenario 5 (p. 19) has
    no Victory bullet but the closing line.
  - p. 19 is the only page with a DEFEAT list: one shaded "Expert Campaign Only" bullet, then one "Standard Campaign
    Only" bullet with three sub-bullets.
  - p. 24 is the log. Its "Evidence Combinations" grid is a picture; the conversion holds only its headings.
- **The log sheet** (p. 24, checked): "Player #1's Identity" to "#4", each with "Remaining hit points"; "Notes";
  "Remaining Secret Counters by Scenario", a table of the three board members by "#1" to "#4"; "Scenario 1: Minions and
  side schemes in play"; "Scenario 2: Rescued captives"; "Scenario 3: Adaptoid environments" with four check boxes
  (Flying Upgrade, Psionic Upgrade, Sarah Garza Upgrade, Strong Upgrade); "Scenario 4: Surviving Thunderbolts";
  "Evidence Combinations". The separate sheet `docs/campaign-modes/log-sheets/mc50_agents_of_shield_campaign_log.pdf`
  was not opened this session; the handoff says it is the same sheet.
- **The nine evidence scans** (`assets/card-art/bundles/cards/50185.png` to `50193.png`), read side by side this
  session. Each prints its kind as "EVIDENCE – MEANS", "– MOTIVE" or "– OPPORTUNITY", the set line "EXECUTIVE BOARD
  EVIDENCE (n/9)" with no word "Campaign", and one "Setup" ability. The icon and color of each are §1.16's table
  (checked), and the emitted text of all nine matches its scan word for word (checked).
- **The grid, a second reading.** The handoff's 27 rows by color (`docs/phase7-wave9-handoff.md`, "Evidence
  combinations", read by the main session) were read again from the 230 dpi render: all 27 agree (checked, two readers).
  By card id they are §1.16's table.
- **Rulings.** `marvel-champions-rulings-post-rrg-1-7.md` was searched for "S.H.I.E.L.D.", "evidence", "Zemo", "Board
  Member", "secret counter" and "campaign". **No ruling names this campaign, the evidence, a Board Member or Baron
  Zemo**, so none says a printed wording here is unintended. Two rulings on other boxes bear on it: August 3, 2026 –
  Ruling 4 (3), "Linked cards cannot be included in decks" (§3.77), and June 2, 2026 – Ruling 3 (2), "Campaign setup
  finishes before resolving Collector II's When Revealed damage" (the campaign design's Q7, not reopened).
- **RRG 1.8**, from the markdown text with page numbers from its index (the PDF pages were not opened this session):
  "Campaign-Specific Card" (p. 11), "Modes of Play" (p. 28: "During campaign mode or expert campaign mode, players can
  choose which other mode(s) they wish to play for each individual scenario"), "Player Elimination" (p. 34), "Player
  Side Scheme" (p. 34: "Any rules or card effects that refer to 'schemes' or 'side schemes' also refer to player side
  schemes"), Appendix II step 13 (p. 51).
- **The foundation, read this session:** `packages/engine/src/campaign.ts` (the type surface), `campaign/log.ts`,
  `campaign/ops.ts`, `campaign/result.ts` and `campaign/runner.ts` by grep and by section,
  `packages/cards/src/campaigns/aoa.ts` and `expert-helpers.ts`, `packages/content/src/data/aoa/campaign.ts`,
  `docs/campaign-mode-design.md` (the outline, §1's MC50 rows, Q4), `docs/campaign-client-per-box.md` §3 and
  `docs/wave-definition-of-done.md` §6. No test was run and no code was changed.

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

### 1.15 Trickster Takeover (pass 2c)

**The God of Lies scenario record is wrong as emitted.** `scenarios.ts` has Loki, God of Lies 55027a as `villainCardId`,
the four Avatars as `setAsideVillainCardIds`, Mischief and Mayhem 55033a as the main scheme and Worlds Collide 55028a in
`setAsideCardIds`. MC55 p. 10 (Single Group Mode): "the Avatar of Loki villain, his hit point dial, and the Mischief and
Mayhem main scheme should be front and center as these are the villain and main scheme that players can interact with as
normal", while "the Loki, God of Lies villain and the Worlds Collide main scheme cannot be interacted with by players …
These cards are not considered in your game area and can only be affected by cards that refer to them by name." MC55 p.
18: they "cannot be affected by any ability that refers to 'the villain' or 'the main scheme,' and Worlds Collide cannot
have acceleration tokens placed on it." So in Single Group Mode:

- **The villain is the Avatar of Loki in play**, one of 55029a–55032a chosen at random by Mischief and Mayhem 1A's Setup
  ("1. Put a random Avatar of Loki villain into play. Set each other Avatar of Loki villain and the Shatter the Illusion
  card aside.", checked). `villainCardId: 55029a` (the first in printed order, as On the Run names one Marauder),
  `setAsideVillainCardIds: [55030a, 55031a, 55032a]`, `startingVillain: "bySetup"`: the Setup ability draws among all
  four with `addVillain` (wave 5's On the Run shape), so the draw sits where the card puts it, after Worlds Collide
  (A)'s Setup, not as the game's first RNG draw.
- **The main scheme is Mischief and Mayhem** (`mainSchemeCardId: 55033a`, correct as emitted).
- **Loki, God of Lies and Worlds Collide are neither** the villain nor a main scheme nor set aside: they are in play in
  a game area of their own. New field, proposed:
  `Scenario.neutralCards?: { readonly villainCardId: CardId; readonly mainSchemeCardId: CardId }` =
  `{ 55027a, 55028a }`, read by the scenario builder into §3.59's neutral area and §3.66's shared record. Worlds Collide
  leaves `setAsideCardIds`.
- `victory: "cardAbility"` stays (55027b: "If Loki, God of Lies is defeated, all players in all groups win the game.").
  `villainStages: { standard: [1, 1], expert: [1, 1] }` stays: each Avatar has one stage per face in both modes, and the
  Contents line names "Loki, God of Lies (1)" for both (55028a, checked). **The modes differ only by Intense Focus**
  (55033a step 3) and by the "in expert mode" clauses on five cards (55034b by way of 55027b, 55045, 55049, 55050,
  55051).
- **Permanent cards** (Intense Focus 55034a, the four Synergy environments 55052–55055) are set aside by their keyword
  (RRG p. 32: "set aside before step 1 of setup and are put into play later by abilities on other cards") and need no
  `setAsideCardIds` entry. Confirm the builder does this for an encounter set's permanent cards (the setup code reads
  the keyword; the test is the scenario game's opening state, §8.4).

**The Enchantress record is right.** Stages: standard I and II, expert II and III ("Enchantress (I) and Enchantress
(II). (Enchantress (II) and Enchantress (III) instead for expert mode.)", 55004a, checked). Main scheme 55004a with
stages 1 and 2; Future of Despair set aside by 1A's Setup (it is not Permanent: `setAsideCardIds: [55006]` unless the
Setup script moves it out of the deck itself, the builder's choice). The five Hypnotic Gaze cards are Permanent and set
aside by keyword.

**The Expert set.** Neither Contents line and no page of the insert names an Expert set; both say "Standard encounter
sets" (plural, the sentence's object) and "One modular encounter set (Trickster Magic)". RRG "Modes of Play" (p. 28):
expert mode means "using the listed expert mode villain stages, and add the Expert encounter set to encounter deck." So
`expertEncounterSetIds: [expert]` (Core's) is the RRG's rule, not the pack's, for both scenarios; the `UNVERIFIED` note
in the curation file can be replaced by this citation. The player may pick Standard II or III and Expert II as for any
scenario.

**Other shapes and corrections** (the list for the data agent is §8.1 items 18 to 27):

1. **Spellbound 55022** is "**When Defeated**: Each player whose identity has the Defiant trait places 1 charm counter
   on the Enchantment card in their play area. Each player whose identity has the Enthralled trait discards a card they
   control." (scan, read twice). The raw cache and the emitted text say "When Revealed"; the ability id becomes
   `55022.when-defeated`.
2. **Wrapped in Chains 55035**: "Attach to your identity." (raw: "identiy").
3. **The Fading Figments** (55029b–55032b) print "HIT POINTS ∞" (checked): `infiniteHp: true` with
   `hp: { base: 0, perPlayer: 0 }`, as the schema's villain stage documents, not `hp: 99`.
4. **`definedCounterTypes`** (§1.6): `charm` on both faces of 55007a–55011a, `shatter` on both faces of 55029a–55032a,
   `synergy` on 55052–55055. None prints `uses`.
5. **Counter maximum, new field:**
   `EnvironmentCard.counterLimit?: { readonly counterType: string; readonly max: ScalingValue }` =
   `{ "synergy", perPlayerOnly(1) }` on 55052–55055 ("Max 1 [per player] synergy counters here.", checked: the icon is
   the per player icon, not the per group icon). §3.61 reads it.
6. **Linked, on the four allies** (55063–55066): the keyword's parentheses name a card by title and type, "Linked
   (Absorbing Man minion)". Emitted today as `cardTitle: "Absorbing Man minion"`, which matches no card. Proposed:
   `{ name: "linked", cardTitle: "Absorbing Man", cardType: "minion" }` (and Titania, Whirlwind, Zzzax), §3.57. The
   allies are `aspect: "basic"` (the frame and "BASIC/TRICKSTER MAGIC (8/11)", checked) with
   `encounterSetIds: [trickster_magic]`; they never enter a deck or the deck builder (RRG p. 27).
7. **Crown of the Enchantress 55016** prints a SCH box holding only a star (checked): no SCH modifier, and the star
   points at its Forced Response. Confirm it is emitted as a star with no `statModifiers.sch`.
8. **Printed values checked on scans** and right as emitted: Prime Real Estate 1B 1 / 6 / +1 per player; Sovereign
   Sorceress 2B 2 / 9 / +1 per player; Future of Despair 2 per player; Mischief and Mayhem 1B starting threat a flat 0,
   target 8 per player, +1 per player; Worlds Collide B target 2 per group with a dash for starting threat and for
   acceleration; The Mangog 10 per group; Door Between Worlds 7 per group with crisis, acceleration and hazard icons;
   Loki, God of Lies 20 per player on both faces with dashes for SCH and ATK; the Avatars 15 per player; Intense Focus
   and Total Focus +1 SCH and +1 ATK; Dark Scepter +1 ATK.
9. **The Shatter the Illusion card** has no record. It is a rules card: "set aside" by 55033a's Setup with no rules
   effect of its own. Proposed:
   `Scenario.referenceCards?: readonly { id: string; title: string; text: string; image: ImageRef }[]` with this card
   and the Epic Multiplayer Reminder, for the client's Inspect; its three steps are scripted inside each Fading
   Figment's When Revealed (§3.60), from a helper the four share.

### 1.16 The campaign record, the evidence icons and the grid (pass 1b)

1. **`AOS_CAMPAIGN`**, hand-authored in `packages/content/src/data/aos/campaign.ts` as `aoa/campaign.ts` is (there is no
   MarvelCDB record of a campaign), and registered in `CAMPAIGNS`: `id: campaignId("aos")`, `name: "Agents of
S.H.I.E.L.D."`, `boxCode: "MC50"`, `packCode: setCode("aos")`, `scenarioIds` in the order of MC50 p. 4
   (`black-widow`, `batroc`, `modok`, `thunderbolts`, `baron-zemo`), `logSheetReference` the sheet of §0.3.
   **`campaignSetIds` is empty**: a set listed there is barred from standalone play, and neither
   `s.h.i.e.l.d._executive_board` (a modular set, MC50 p. 6) nor `executive_board_evidence` (dealt in a standalone Baron
   Zemo game, p. 18) may be. No `perSeatSetIds`, no `roles`, no `prohibited`.
2. **`evidenceIcon` and the Setup each card prints** (nine scans, checked). The handoff's "pink (card)" is a fingerprint
   scanner.

   | Id    | Title              | Kind        | Icon                | Color  | Setup searches for |
   | ----- | ------------------ | ----------- | ------------------- | ------ | ------------------ |
   | 50185 | Medical Records    | means       | folder (caduceus)   | orange | Protection ally    |
   | 50186 | Wiretap            | means       | phone               | blue   | Justice ally       |
   | 50187 | Security Scanner   | means       | fingerprint scanner | pink   | Aggression ally    |
   | 50188 | Money              | motive      | dollar sign         | green  | Protection upgrade |
   | 50189 | Blackmail          | motive      | handshake           | black  | Justice upgrade    |
   | 50190 | Ideology           | motive      | flame               | yellow | Aggression upgrade |
   | 50191 | Security Clearance | opportunity | ID badge            | purple | Protection support |
   | 50192 | Travel             | opportunity | map pin             | red    | Justice support    |
   | 50193 | Authority          | opportunity | shield with a star  | blue   | Aggression support |

   **Proposed:** `evidenceIcon` takes the slugs `folder`, `phone`, `scanner`, `dollar`, `handshake`, `flame`, `badge`,
   `pin`, `shield`, and a new `evidenceColor` takes the color word. Two cards are blue (50186 and 50193), so the client
   tells evidence apart by icon and title, never by color alone.

3. **`AOS_EVIDENCE_COMBINATIONS`** (§1.12's shape), the 27 rows of MC50 p. 24 by card id (checked, §0.3). The board
   members are 50181a Chief Medical Officer, 50182a Chief Surveillance Officer and 50183a Chief Tactical Officer.

   | Means | Motive | Opportunity | Board member |
   | ----- | ------ | ----------- | ------------ |
   | 50185 | 50188  | 50191       | 50181a       |
   | 50185 | 50188  | 50192       | 50181a       |
   | 50185 | 50188  | 50193       | 50183a       |
   | 50185 | 50189  | 50191       | 50181a       |
   | 50185 | 50189  | 50192       | 50182a       |
   | 50185 | 50189  | 50193       | 50181a       |
   | 50185 | 50190  | 50191       | 50183a       |
   | 50185 | 50190  | 50192       | 50181a       |
   | 50185 | 50190  | 50193       | 50183a       |
   | 50186 | 50188  | 50191       | 50181a       |
   | 50186 | 50188  | 50192       | 50181a       |
   | 50186 | 50188  | 50193       | 50182a       |
   | 50186 | 50189  | 50191       | 50181a       |
   | 50186 | 50189  | 50192       | 50182a       |
   | 50186 | 50189  | 50193       | 50182a       |
   | 50186 | 50190  | 50191       | 50182a       |
   | 50186 | 50190  | 50192       | 50182a       |
   | 50186 | 50190  | 50193       | 50183a       |
   | 50187 | 50188  | 50191       | 50181a       |
   | 50187 | 50188  | 50192       | 50183a       |
   | 50187 | 50188  | 50193       | 50183a       |
   | 50187 | 50189  | 50191       | 50183a       |
   | 50187 | 50189  | 50192       | 50182a       |
   | 50187 | 50189  | 50193       | 50182a       |
   | 50187 | 50190  | 50191       | 50183a       |
   | 50187 | 50190  | 50192       | 50182a       |
   | 50187 | 50190  | 50193       | 50183a       |

   **Validation the data test carries** (computed from the table by script this session): the 27 triples are all
   different and cover every combination once; each board member has nine rows; and each evidence card's rows split
   among (Medical, Surveillance, Tactical) as 50185, 50188 and 50191: 5, 1, 3; 50186, 50189 and 50192: 3, 5, 1; 50187,
   50190 and 50193: 1, 3, 5. A wrong cell breaks that pattern, which is why it is worth a test of its own. This replaces
   §1.12's "not transcribed and unchecked" and satisfies §8.1 item 1's two readings.

4. **Counter names the campaign reads** (§1.6): `secret` on 50181a/b–50183a/b and `lock` on 50105a–50108a. A record
   instruction names a counter by the key `CardInstance.counters` uses, so these two spellings are fixed here.
5. **The Thunderbolt minion to encounter set map**, derived, not typed in: every minion with the Thunderbolt trait in
   the playable pool and the encounter set it belongs to. Scenario 5 reads it for "shuffle those minions and their
   encounter sets, except for Jolt's" (MC50 p. 19). Jolt 50133 belongs to the Thunderbolts scenario set, the one set the
   sentence leaves out. With §8.1 item 14 the map holds the ten Elite minions and Jolt.
6. **No scenario record changes.** What the campaign adds to a scenario (the Executive Board set in scenarios 1 to 4;
   Adaptoids, their environments and the Thunderbolt sets in scenario 5) is composed by the definition (§3.73), not
   written into `AOS_SCENARIOS`.

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

### 2.8 The two Trickster Takeover scenarios (pass 2c)

| Scenario    | Villain                                                    | Main scheme                                   | Sets                                                 | Standard / expert                                                     |
| ----------- | ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Enchantress | Enchantress 55001–55003                                    | Prime Real Estate 1, Sovereign Sorceress 2    | Enchantress, Standard, one modular (Trickster Magic) | stages I, II / II, III; the Expert set in expert mode (RRG p. 28)     |
| God of Lies | an Avatar of Loki 55029a–55032a; Loki, God of Lies neutral | Mischief and Mayhem 1; Worlds Collide neutral | God of Lies, Standard, one modular (Trickster Magic) | the same cards; Intense Focus attached at setup in expert; Expert set |

**Trickster Magic in either scenario** (MC55 pp. 2, 4): its seven encounter cards (55056–55062) are shuffled in; "Each
linked ally card should be set aside during setup for any scenario using Trickster Magic as a modular set" (55063–55066,
§3.57). It is a modular set like any other and may be used with any scenario.

**Enchantress** (MC55 pp. 6–7; 55004a, checked).

- Setup: "Set the Future of Despair side scheme aside. Attach a random Hypnotic Gaze to each identity (players cannot
  look at the reverse sides). Set each remaining Hypnotic Gaze aside." Five cards for at most four players, drawn with
  the game's RNG after the encounter deck is built; the reverse faces are hidden from every player (§3.54).
- Stage II's When Revealed is "In standard mode, put the set-aside Future of Despair into play, then place an additional
  3 [per player] threat on it"; stage III's has no mode clause and 4 per player. So in standard mode Future of Despair
  arrives when stage I is defeated with 2 + 3 = 5 per player; in expert mode stage II starts the game and its When
  Revealed does nothing, and Future of Despair arrives at stage III with 2 + 4 = 6 per player (MC55 p. 22 FAQ gives 5
  and 6, without the icon the scans print).
- While Future of Despair is in play "Enchantress gains stalwart and cannot take damage": the players must clear it.
  Sovereign Sorceress 2B: "If this stage is completed, the players lose the game."
- The win is the ordinary one (the last stage defeated); the loss is 2B's completion or every player defeated.

**God of Lies, Single Group Mode** (MC55 pp. 9–10, 18–21, 23; 55028a, 55033a, checked).

1. Standard setup. The neutral area is created with Loki, God of Lies (side 1) and Worlds Collide in it; Loki's hit
   points are 20 per player, counting "the total number of players in all game areas" (55028b), which in Single Group
   Mode is the table. Worlds Collide has no starting threat, no acceleration and a target of 2 per group, counting "the
   total number of groups in all pods": 2.
2. "During the 'Resolve Scenario Setup' step, first resolve the 'Setup' ability on the Worlds Collide (A) main scheme,
   then resolve the 'Setup' ability on the Mischief and Mayhem (1A) main scheme" (MC55 p. 10). Worlds Collide (A):
   "Create a separate game area for each player group … Each group follows the instructions on Mischief and Mayhem
   (1A)." With one group this creates nothing more; Worlds Collide turns to its B face.
3. Mischief and Mayhem 1A: a random Avatar into play, the other three and the rules card set aside; "Put each Synergy
   environment into play" (four, each with no counters); "In standard mode, set the Intense Focus attachment aside. In
   expert mode, attach it to the Avatar of Loki villain in play" (attached, not revealed: its When Revealed is worded
   for standard mode only). Then 1B: starting threat 0.
4. "GROUP PODS … In Single Group Mode, the only group in your pod is your own group of 1–4 players" (MC55 p. 10): every
   "group in your pod" is the table, every per group icon multiplies by 1.
5. **Win:** Loki, God of Lies is defeated (55027b). **Loss:** Worlds Collide is completed (55028b), by the timing of
   §3.66 and §4.1 Q9. **No player is ever eliminated** while Mischief and Mayhem 1B is in play: its second Forced
   Interrupt replaces every identity's defeat (§3.62), so "all players defeated" cannot end this game.
6. Who resolves a Fading Figment: "The first player. If an encounter card requires a card ability to be resolved, a game
   function to be performed, or a choice to be made but does not specify which player should act, the first player does
   so." (MC55 p. 23.)

### 2.9 The campaign (pass 1b; MC50 pp. 4–6, 9, 11, 13, 15, 19, 24)

Every quote here is checked against a rendered page (§0.3). The definition that carries it out is §3.73.

**The frame (p. 4).** "To complete the campaign, the players must win all five scenarios in numerical order." "Each
player must use their chosen identity for the entire campaign, but they are free to change aspects and alter the
contents of their deck between scenarios." "To play a scenario in campaign mode, set up the scenario as per the normal
rules of the game. Then, **before players draw their starting hands**, follow that scenario's setup instructions in the
order they are listed." "When the game ends, if the players won, follow that scenario's victory instructions in the
order they are listed … If the players lost, they may reset the scenario and try again with no penalty."

**The mole (p. 5).** "Preparing the Evidence": the nine evidence cards are separated "by their card backs into three
sets of three cards" (means, motive, opportunity); each set is shuffled and one card of each goes into the A.I.M.
envelope "**without looking at them**"; the other six are shuffled together into the S.H.I.E.L.D. envelope, also unseen.
The three A.I.M. cards name one row of the log's grid, and that row's board member is the mole. Scenario 1's Setup does
this once for the campaign (p. 9).

**The Executive Board (pp. 6, 9, 11).** The three Board Member environments 50181a–50183a are in play in every scenario,
with the three A.I.M. Interference treacheries 50184a–c in the encounter deck. Scenario 1 starts each at two secret
counters; every later scenario starts each at the number recorded after the scenario before. "If a board member ever has
four secrets on it (three in expert mode), that board member permanently turns against the heroes, flipping to its
attachment side." "In campaign mode, secrets placed on board members carry over from one scenario to the next. Because
of this, **once a board member flips to its attachment side, it remains an attachment for the rest of the campaign.**"
The Victory list records "the number of secret counters on each Board Member **card**", either face, which is the
campaign's own support for §4.1 Q1's default (a flipped member keeps its counters). Three attachments in play lose the
game in any scenario (50181b, pass 1a §3.26).

**Evidence (p. 6).** "If at least one of the board members has no secret counters on them when the scenario ends, the
players gain an evidence card from the S.H.I.E.L.D. envelope. Evidence cards are **not** added to any deck once gained.
Instead, they provide the players with information about the mole, as well as a 'Setup' ability that is resolved by the
campaign setup instructions for each subsequent scenario." One card for a scenario, however many members are clean. That
card is the campaign's only reward; it has no other.

**Scenario by scenario.** "Board" is the three bullets "Put the three Board Member environments into play", place the
secret counters, "Shuffle the three copies of the A.I.M. Interference treachery into the encounter deck". "Common
Victory" is the three bullets every scenario from 1 to 4 prints: "Record the number of secret counters on each Board
Member card in the campaign log"; "If at least one Board Member environment in play has no secret counters on it, gain
one evidence card from the S.H.I.E.L.D. envelope and cross out each combination of means, motive, and opportunity in the
campaign log that includes the icon on the evidence card gained"; and the shaded "Expert Campaign Only: Record each
identity's remaining hit points in the campaign log". "Expert Setup" is the two shaded bullets of §0.3.

| Scenario               | Setup, in printed order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Victory, in printed order                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1 Black Widow (p. 9)   | "Each player records their identity in the campaign log … Players cannot switch identities during a campaign." "Prepare the evidence (see page 5)." Board, with "two secret counters on each Board Member environment".                                                                                                                                                                                                                                                                                                                                                                                                          | "Record the total number of minions and side schemes in play in the campaign log." Common Victory.              |
| 2 Batroc (p. 11)       | "Place threat on the Alert Level environment equal to the number of minions and side schemes recorded in the campaign log for scenario #1." Board, with the counters "recorded for that environment in scenario #1. (This will cause the environment to flip to its attachment side if enough secrets are placed on it.)" The evidence bullet. Expert Setup.                                                                                                                                                                                                                                                                     | "Record the number of Rescued Captive (91) allies in play in the campaign log." Common Victory.                 |
| 3 M.O.D.O.K. (p. 13)   | "Place 3[per_hero] additional lock counters on the top card of the Holding Cell deck, then remove X[per_hero] lock counters from that card, where X is the number of 'Rescued Captives in Play' recorded in the campaign log." Board, from scenario #2. The evidence bullet. Expert Setup.                                                                                                                                                                                                                                                                                                                                       | "Mark each Adaptoid environment (109-112) in play in the campaign log." Common Victory.                         |
| 4 Thunderbolts (p. 15) | Board, from scenario #3. The evidence bullet. Expert Setup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | "If there are any Thunderbolt minions in play, record each of their names in the campaign log." Common Victory. |
| 5 Baron Zemo (p. 19)   | "Put into play each Adaptoid environment (109-112) marked as 'in play' in the campaign log." "Shuffle each copy of the Adaptoid minion (113) into the encounter deck." "If you recorded any 'Surviving Thunderbolts' in the campaign log, shuffle those minions and their encounter sets, except for Jolt's (133), into the encounter deck." "Set the A.I.M. and S.H.I.E.L.D. envelopes aside so that you can access them during the scenario." "Place secret counters on each Board Member environment equal to the number of secret counters recorded for that environment in scenario #4." The evidence bullet. Expert Setup. | "Zemo is defeated, the mole is exposed, the heroes are exonerated, and the players win the campaign!"           |

The evidence bullet is "**After resolving mulligans,** resolve the 'Setup' ability of each evidence card the players
have earned" (pp. 11, 13, 15, 19). Expert Setup is "Expert Campaign Only: Set each player's hit points to their
remaining hit point value recorded in the campaign log for the previous scenario" and "Expert Campaign Only: Each player
may place one secret counter on a Board Member environment to heal damage from their identity equal to their REC".

**What carries, and what it does next.**

| Carried (log, p. 24)                           | Written                           | Read                                                                                          |
| ---------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| Each player's identity                         | scenario 1 Setup                  | every scenario: it cannot change                                                              |
| Remaining hit points (expert campaign)         | Victory of 1 to 4, capped at base | Setup of 2 to 5                                                                               |
| Secret counters on each Board Member, #1 to #4 | Victory of 1 to 4                 | Setup of the next scenario; a flipped member stays flipped (p. 6)                             |
| Scenario 1: minions and side schemes in play   | Victory of 1                      | Setup of 2: that much threat on Alert Level (at 4 per player it flips to High at once, §3.16) |
| Scenario 2: Rescued Captives in play           | Victory of 2                      | Setup of 3: the first Holding Cell has (5 − X) per player lock counters, X from 1 to 4        |
| Scenario 3: Adaptoid environments in play      | Victory of 3                      | Setup of 5: those environments in play, with all four Adaptoids in the encounter deck         |
| Scenario 4: surviving Thunderbolts             | Victory of 4                      | Setup of 5: those minions and their sets in the encounter deck                                |
| Evidence gained                                | Victory of 1 to 4                 | Setup of 2 to 5 (each card's Setup ability); the grid; scenario 5's accusation                |
| The A.I.M. envelope (hidden; not on the sheet) | scenario 1 Setup                  | scenario 5's stage 2 only                                                                     |

**Scenario 5 in campaign mode (pp. 18–19; cards 50167a/b, pass 1a §3.29).** The evidence is not dealt again: "If you are
playing in campaign mode, simply place the A.I.M. and S.H.I.E.L.D. envelopes within reach" (p. 18, from the conversion).
Zemo's Manipulations 1B gains "2 cards from the S.H.I.E.L.D. envelope (1 card instead in campaign mode)", and its Setup
places the two starting secret counters only "If not playing campaign mode". The accusation, the mole, the wrong guesses
and their secret counters, and the mole's flip at stage 3B are the standalone game's, unchanged (§3.26, §3.29). The
players enter with at most four evidence cards, so at least two are still in the S.H.I.E.L.D. envelope.

**Rewards and penalties, as a list.** Rewards: an evidence card for a scenario ended with a clean board member (fewer
rows left in the grid, and one more Setup ability in every later scenario). Penalties, all carried by the log: secret
counters and flipped members; threat on Alert Level for scenario 1's minions and side schemes; more lock counters for
fewer captives; Adaptoid environments and Thunderbolt sets in scenario 5; and in scenario 5 the secret counters for a
wrong accusation.

**Expert campaign (p. 6).** "Some Setup and Victory instructions are preceded by Expert Campaign Only. Ignore these
instructions unless you are playing an expert campaign." Persistent damage: "each player must record their remaining hit
points in the campaign log after they win a game. This determines each player's starting hit points for the next
scenario. If a player's remaining hit point value is greater than their base hit point value, record their base hit
points in the campaign log instead." "In an expert campaign, if a player is defeated during a scenario that their
teammates go on to win, the defeated player does not participate in the Victory steps of that scenario. However, during
the Setup instructions of the next scenario, the defeated player can rejoin their teammates for the next scenario by
following that scenario's Setup instructions for healing their identity to its full hit points." The same page says the
Setup instructions "offer each player the opportunity to restore their identity to their full hit point value at a cost
specific to that scenario", but every Setup list prints the same bullet, and it heals REC, not to full (§4.1 Q14). The
expert campaign and expert mode are separate choices: each scenario may be played in standard or expert mode (RRG "Modes
of Play", p. 28), which changes a Board Member's threshold from one scenario to the next (§4.1 Q11).

**A loss.**

- Scenarios 1 to 4, either campaign: "they may reset the scenario and try again with no penalty" (p. 4). Nothing of the
  lost game is recorded: the log, the envelopes and the decks are as they stood when the scenario began.
- Scenario 5, expert campaign (p. 19): "The heroes are arrested by S.H.I.E.L.D., convicted of their alleged crimes, and
  the players lose the campaign."
- Scenario 5, standard campaign (p. 19): "To replay this scenario, do the following: Prepare the evidence as if you are
  starting a new campaign (see page 5). Gain one evidence card from the S.H.I.E.L.D. envelope for each scenario in which
  you had at least one Board Member environment with no secret counters on it. Perform the campaign setup instructions
  above." The lost game opened the A.I.M. envelope, so the mole is drawn again and may be a different member; the
  players keep the **number** of evidence cards they had earned, not the cards.

## 3. Engine primitives (owner: `game-rules-architect`)

**Build the mechanism, not the card.** Engine code never names a card; card names say where each primitive is needed.
Every status below comes from a search by behavior (2026-10-09) of `packages/engine/src` (`spec.ts`, `abilities.ts`,
`trigger-events.ts`, `state.ts`, `effects.ts`, `keywords.ts`, `resolve/*`), the DSL in `packages/cards/src/dsl`, the
content schema and the wave 8 spec. **Nothing of this wave is started: every row is "not started"**, and the word after
it says what kind of work it is: **exists (verify)** (found by name and doc comment, its behavior for this card not
run: the scripting agent proves it in a test before relying on it, and a failure becomes an extend here); **exists
(compose)** (several existing pieces, no engine change); **extend** (an existing primitive needs one more case);
**new**. Each section is one agent, one commit. Searches that found nothing are named, so nobody repeats them.

| §    | Primitive                                                                                           | Needed by                                                                    | Status (all not started) |
| ---- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------ |
| 3.1  | Vulnerable                                                                                          | 50083, 50093, 50094, 50098, 50125, 50126, 50172, 50178                       | new                      |
| 3.2  | Preparation: a labeled ability that is not a boost ability, resolved from the discard pile          | 50064–50066, 50068–50073, 50076–50079                                        | extend                   |
| 3.3  | An ability a rule gives to every encounter card that does not print one of that label               | 50070, 50074                                                                 | new                      |
| 3.4  | The attack in progress as a Preparation reads it; the villain's Forced Interrupt                    | 50064–50066, 50068, 50071–50073, 50076, 50079                                | extend                   |
| 3.5  | "Would be defeated … reset his hit points to N instead": fixed hit points, never defeated           | 50086a/b, 50103a/b, 50165a, 50166a, 50114–50119                              | exists (verify)          |
| 3.6  | All-purpose counters: any type, retyped by the card they land on, a uses card emptied by a move     | 50001a, 50002, 50005, 50007, 50011, 50024, 50029, 50030, 50031, 50033, 50113 | extend                   |
| 3.7  | Threat on a card that is not a scheme; threat removed from a card as a cost of a chosen size        | 50034a, 50035a/b, 50036–50046, 50059, 50090a/b                               | extend                   |
| 3.8  | A suit form: a permanent double-sided upgrade as an additional form; a forced change on attack      | 50034a/b, 50035a/b, 50037, 50038, 50059                                      | exists (verify)          |
| 3.9  | An attack that becomes a scheme; one threat of that activation placed elsewhere                     | 50035b                                                                       | extend                   |
| 3.10 | Deck building: an all-or-nothing off-aspect package; Team-Up with "Max 1 per deck"                  | 50001b, 50024                                                                | exists (verify)          |
| 3.11 | A choice of cards capped by their combined printed cost                                             | 50004, 50005                                                                 | extend                   |
| 3.12 | Looking at every dealt encounter card and the top of the deck, and swapping them                    | 50051                                                                        | extend                   |
| 3.13 | An enemy attack on an ally: chosen by a superlative, redirected by the main scheme                  | 50089b, 50096, 50120                                                         | exists (verify)          |
| 3.14 | Main scheme stages left by removing the last threat: forced, by choice, and a win at no threat      | 50087b, 50088b, 50089b                                                       | exists (verify)          |
| 3.15 | Allies the scenario owns: set aside, put into play under any player, not removable by abilities     | 50091, 50105b–50108b                                                         | exists (verify)          |
| 3.16 | An environment that holds threat, flips at a threshold and loses the game at one                    | 50090a/b, 50093–50097                                                        | exists (compose)         |
| 3.17 | A scenario deck whose top card is in play, flips to an ally and comes back to the bottom            | 50105a/b–50108a/b                                                            | extend                   |
| 3.18 | Environments that change every card of a title; a main scheme whose completion is replaced          | 50104b, 50109–50113                                                          | exists (compose)         |
| 3.19 | An ally held on a side scheme under no player's control                                             | 50121                                                                        | exists (verify)          |
| 3.20 | An ally that would leave play tucked under a scheme instead; X from a tucked card's printed cost    | 50080–50082, 50100, 50119                                                    | extend                   |
| 3.21 | A minion attached to an environment: in play, engaged with nobody, swapped as the round ends        | 50130b, 50131a/b                                                             | extend                   |
| 3.22 | Setup that picks sets by the minion they hold; each player reveals a random set-aside minion        | 50130a, 50131a                                                               | exists (verify)          |
| 3.23 | A villain that cannot be defeated below a victory display count; an activation given up to heal     | 50129a/b                                                                     | exists (verify)          |
| 3.24 | Every player engages the next player's minions at once                                              | 50135, 50136, 50164                                                          | extend                   |
| 3.25 | Damage that goes somewhere else: threat off a scheme, onto the attachment, back at the attacker     | 50092, 50117, 50146, 50149, 50154                                            | exists (compose)         |
| 3.26 | Board Members: named counters, a flip to an attachment on the villain, a loss at three              | 50181a/b–50183a/b, 50168b, 50169b                                            | extend                   |
| 3.27 | "Remove N counters from among" several cards; "the [card] with the fewest counters"                 | 50165a, 50166a, 50170, 50172–50177                                           | extend                   |
| 3.28 | "You may spend X [type] resources to prevent X of …"                                                | 50175, 50184a–c                                                              | exists (verify)          |
| 3.29 | Evidence in a standalone game: two hidden piles, gained cards, the grid, the accusation             | 50167a/b, 50168a/b, 50169b, 50185–50193                                      | new                      |
| 3.30 | A hero from the collection in play as a minion                                                      | 50171                                                                        | extend                   |
| 3.31 | An additional cost to attack, thwart or defend with an ally                                         | 50173                                                                        | extend                   |
| 3.32 | Player-deck cards facedown as minions whose base stats an environment sets                          | 50030–50033                                                                  | exists (verify)          |
| 3.33 | Keywords and icons a rule gives to other cards, to cards being revealed, and takes away             | 50075, 50085, 50089b, 50093, 50094, 50101, 50144, 50060                      | exists (verify)          |
| 3.34 | An attachment's stat box on an identity, replaced under a trait; the two errata                     | 50153, 50156, 50159                                                          | exists (compose)         |
| 3.35 | Reusable as is                                                                                      | the rest (§7)                                                                | checked by name          |
| 3.36 | Specials resolved by count and by choice; a Special that discards its own card; on allies           | 51001a, 51002–51005, 51010–51013, 51022–51025, 51030                         | exists (verify)          |
| 3.37 | A card searched for in the deck and played at a reduced cost                                        | 51001b                                                                       | exists (verify)          |
| 3.38 | Threat a scheme loses placed on a minion; the minion taken as an ally by a linked attachment        | 51017, 51036                                                                 | exists (compose)         |
| 3.39 | Encounter cards tucked under an identity: a cap, tucks from the discard pile, "the same set"        | 52001a/b, 52002–52006, 52009–52012, 52029, 52030, 51018                      | exists (verify)          |
| 3.40 | A tuck sent somewhere else; a tucked card that answers its own discard                              | 52028, 52029, 52031                                                          | new                      |
| 3.41 | A revealed card swapped with a tucked card of its set                                               | 52008                                                                        | exists (verify)          |
| 3.42 | The top card of the encounter deck faceup; an ability refused when the visible card gives nothing   | 53001a, 53002–53004, 53010, 53012                                            | extend                   |
| 3.43 | Cards discarded from the top of the encounter deck: a chosen cost, a trigger, a card handed on      | 51015, 53001a, 53002–53004, 53010, 53012, 53017, 53030, 53031, 53036         | extend                   |
| 3.44 | A response to a boost card being given: look at it and the deck top, and swap them                  | 53005                                                                        | extend                   |
| 3.45 | An interrupt to an encounter card being dealt to a player                                           | 53009                                                                        | new                      |
| 3.46 | Payment: once per card paid for; the cards that paid; a tucked resource card anyone may spend       | 53006, 53018, 53021                                                          | extend                   |
| 3.47 | A hero that does not exhaust to defend                                                              | 53011                                                                        | extend                   |
| 3.48 | The number of different traits among a group of cards                                               | 53019                                                                        | extend                   |
| 3.49 | An attachment bound for the villain attached to another enemy; "the villain" on that card           | 53038–53040, 51040, 54030                                                    | new                      |
| 3.50 | An attachment that players attack "as if it were a minion"                                          | 54034, 54035                                                                 | new                      |
| 3.51 | Rulings, FAQ entries and errata on cards the engine already covers                                  | 51007, 51038, 52016, 52034, 53008, 53023, 53034, 54004, 54033, the Team-Ups  | exists (verify)          |
| 3.52 | Reusable as is (pass 2)                                                                             | the rest (§7.9–§7.12)                                                        | checked by name          |
| 3.53 | Forced Action: an action a player must take before the player phase can end                         | 55007b–55011b, 55012–55014                                                   | new                      |
| 3.54 | Enchantment attachments: dealt at random, a hidden reverse, flipped at five counters and revealed   | 55004a, 55007a/b–55011a/b                                                    | extend                   |
| 3.55 | A counter that "would be placed": an interrupt window, the placement replaced                       | 55004b, 55005b                                                               | extend                   |
| 3.56 | "If Defiant, choose one. If Enthralled, do both in any order"                                       | 55023–55025                                                                  | exists (compose)         |
| 3.57 | Linked to an encounter card: allies set aside for a modular set, taken by the defeating player      | 55056–55059, 55063–55066                                                     | extend                   |
| 3.58 | A cost every player pays                                                                            | 55016                                                                        | extend                   |
| 3.59 | A villain and a main scheme in a neutral area only abilities naming them reach                      | 55027a/b, 55028a/b, 55033a                                                   | exists (compose)         |
| 3.60 | Avatars of Loki: a defeat replaced by a flip, the Shatter steps, a swap by trait that sets the dial | 55029a/b–55032a/b, 55051                                                     | extend                   |
| 3.61 | A maximum on the counters a card holds                                                              | 55052–55055                                                                  | new                      |
| 3.62 | An identity that "would be defeated" stays in the game; a completion replaced                       | 55033b                                                                       | exists (verify)          |
| 3.63 | "Find and reveal" a card in play; "did not enter play this way"                                     | 55034b, 55036                                                                | exists (verify)          |
| 3.64 | Epic groundwork: the pod record and `GroupId` on game state                                         | every God of Lies card                                                       | new                      |
| 3.65 | Epic groundwork: the per group icon read from the group counts                                      | 55028b, 55041, 55046                                                         | extend                   |
| 3.66 | Epic groundwork: shared villain damage and shared scheme threat as events through one reducer       | 55027a/b, 55028b, 55029b–55032b, 55033b                                      | new                      |
| 3.67 | Epic groundwork: "this group", "a group in your pod", "each group in your pod"                      | 55027b, 55029b–55032b, 55041–55044, 55046, 55048                             | new                      |
| 3.68 | Epic groundwork: the `externalEvent` command                                                        | none in Single Group Mode                                                    | new                      |
| 3.69 | Epic groundwork: a seed per group; inbound events that take no draw                                 | none in Single Group Mode                                                    | extend                   |
| 3.70 | Rulings and FAQ answers on behavior the engine already covers                                       | 55006, 55025, 55034a, 55036, 55042, 55051, 55065                             | exists (verify)          |
| 3.71 | Reusable as is (pass 2c)                                                                            | the rest (§7.13–§7.15)                                                       | checked by name          |
| 3.72 | "You cannot make basic attacks"                                                                     | 55015                                                                        | extend                   |

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

### 3.53 Forced Action: an action a player must take before the player phase can end

> **Status: not started (new).** Searched: `forcedAction`, "Forced Action" in `packages/engine/src` and
> `packages/cards/src/dsl`: nothing. `AbilityTriggerSpec` `action` has `form`, `while`, `firstPlayerOnly` and
> `triggerableBy` but no `forced`; `forced: boolean` exists only on interrupts and responses. `endTurn` (`actions.ts`)
> checks the phase and "when your turn ends" windows, nothing else.

**Cards.** Alluring Call 55012, Kiss of Temptation 55013, Love Concoction 55014 ("Forced Action: Exhaust this card →
place 1 charm counter on the Enchantment card in your play area. …", each beside "Alter-Ego Action: Exhaust this card →
discard this card."); the five Trances 55007b–55011b ("Forced Action: Exhaust this card → …"). All checked. Every Forced
Action in the pack costs "Exhaust this card".

**Rules.** RRG p. 6: "Each 'Forced Action' ability must be resolved before the player phase can end. » A forced action
ability can be triggered at any time a non-forced action ability could be triggered. » If such an ability has a cost
that cannot be paid or requires one or more valid targets and has none, the phase can end without that ability being
resolved." RRG p. 20 repeats it. MC55 p. 7: "the player phase cannot end until all possible forced actions among all
players have been performed. If a card with a Forced Action ability is discarded, or the cost cannot otherwise be paid
(such as by the card becoming exhausted …), then the action cannot be performed and the players are free to end the
player phase as normal." MC55 p. 22 FAQ: "Even if you cannot benefit from a Temptation attachment's effect every round,
you still must trigger its 'Forced Action' … in some rounds, the only outcome of the effect will be placing 1 charm
counter".

**Plan.**

- `action` gains `forced?: true`. A forced action is offered by `legalActions` like any action its controller may take,
  with the same form gate and costs. "Controller" for an encounter attachment on an identity is that identity's player
  (the "you" of its text).
- **Outstanding** = in play, cost payable now, and every target its effects require exists (the RRG's two outs; an
  effect that will do nothing is not an out, per the FAQ). `outstandingForcedActions(state, playerId)` is a pure query,
  used by `legalActions`, by `why-not.ts` and by the client.
- `endTurn` is refused (`forced_action_outstanding`, naming the card) while the ending player has one. When the last
  player's turn ends, the engine looks at every player: one that became outstanding after its controller's turn (the
  card was readied by an effect) is put to that controller before the phase ends, in player order from the first player,
  as a prompt that has only "resolve it" (the choices inside the ability are asked as usual). `playerPhaseEnded` is
  announced only after none is outstanding.
- The Alter-Ego Action on the same card is an ordinary action: exhausting the card for it leaves the Forced Action
  unpayable, which the rules allow (MC55 p. 7). Nothing orders the two.
- Log: the ordinary `abilityUsed`, with `forced: true`; a phase end that waited logs `forcedActionsRequired` with the
  cards.

**Tests (exact numbers).** Kiss of Temptation on a Defiant hero with 2 charm counters: `endTurn` is refused; the action
leaves 3 charm counters, 1 card drawn, 1 discarded, the card exhausted; `endTurn` then passes. The same card on an
alter-ego: the Alter-Ego Action discards it and `endTurn` passes with 2 charm counters. Love Concoction with a ready
identity: still outstanding (the FAQ), 3 counters after. Alluring Call with an empty hand: outstanding, the counter is
placed and nothing is played. Two players, player 1's Kiss of Temptation readied by an effect during player 2's turn:
player 2's `endTurn` opens player 1's prompt; the phase ends after it. A Trance of Pride with no side scheme in play: 1
threat on the main scheme, nothing removed (the first sentence has no target of its own to lack).

### 3.54 Enchantment attachments: dealt at random with a hidden reverse, flipped at five counters and revealed

> **Status: not started (extend).** Exists: double-sided encounter cards (`flipSide`), `flipCard { reveal: true }` with
> the new face revealed where it is (`revealNewFaceFrame`, wave 7 §3.14), `stateCheck` constants, `traitGrants` on a
> constant, `removeCounters`, permanent cards set aside by keyword. Missing: a card picked at random from set aside by a
> Setup ability and attached; a reverse face no player may read (`visibility.ts` has no notion of the other face of a
> card in play: searched `flipSide`, "reverse").

**Cards.** Prime Real Estate 1A 55004a ("Attach a random Hypnotic Gaze to each identity (players cannot look at the
reverse sides). Set each remaining Hypnotic Gaze aside."); Hypnotic Gaze 55007a–55011a ("Permanent. Your identity gains
the Defiant trait. If there are 5 or more charm counters here, remove each charm counter from here and flip this
card."); the Trances 55007b–55011b ("Permanent. Your identity gains the Enthralled trait. When Revealed: … Forced
Action: …"). Checked.

**Rules.** MC55 p. 7: "Players cannot look at the 'Trance' side of any Enchantment attachment until it flips through
Hypnotic Gaze's ability. … When the 'Trance' side is revealed this way, trigger its 'When Revealed' ability as normal."
RRG "Flip" (p. 20): a new face of the same card type "retains all attached cards, tucked cards, status cards, and
tokens". RRG "Permanent" (p. 32).

**Plan.**

- `attach` (and `putIntoPlay`) take `card: { randomSetAside: TargetQuery }`: one matching set-aside card by the game's
  RNG, logged `randomCardChosen` with the instance only. The Setup ability runs it once per player in player order.
- `CardInstance.reverseHidden?: true`, set by `attach { hideReverse: true }` and cleared by the card's first flip.
  `visibility.ts` gains `otherFaceVisible(state, id)`: false while the flag is set, for every viewer. The engine's
  views, `preview()` and the log never name the hidden face's card id or title while it is set (the instance's `cardId`
  is the pair's and stays, as for any `flipSide` card; what is withheld is the face). The multiplayer phase redacts the
  same predicate server side.
- The flip is a `stateCheck` on `counterAtLeast charm 5`: `removeCounters` (every charm counter), then
  `flipCard { reveal: true }`. The insert, not the card, asks for the reveal; cite MC55 p. 7 in the script. "You" for
  the When Revealed is the attached identity's player. The check is immediate, in the middle of whatever placed the
  fifth counter (§3.56 says what that does to a "choose one").
- Both faces grant a trait to "your identity" by `traitGrants` with the host as target; it holds in both forms.
- Counters beyond five placed at once are all removed ("remove each charm counter from here").

**Tests.** Three players, seed fixed: three different Hypnotic Gazes attached, two set aside, replay deep-equal;
`otherFaceVisible` false for all five. A Gaze at 4 charm counters takes 1: 0 counters, the Trance face up, its When
Revealed resolved by its player, the identity Enthralled and no longer Defiant, `otherFaceVisible` true. A Gaze at 4
that is due two counters one after the other (Future of Despair's, then an attack's): it flips at the first, and the
second is replaced by 1 threat (§3.55). Trance of Greed revealed on an identity already confused: "Otherwise, take 2
damage."

### 3.55 A counter that "would be placed" on a card: an interrupt window, and the placement replaced

> **Status: not started (extend).** `TriggerEvent countersPlaced` is announced after `addCounters` and `moveCounters`
> (response window only, one event per placement). No "would be placed" window: searched `countersWouldBePlaced`,
> `replaceCounterPlacement`, nothing. `replaceTriggeringEvent` and `placeThreat` exist.

**Cards.** Prime Real Estate 1B 55004b and Sovereign Sorceress 2B 55005b: "Forced Interrupt: When a charm counter would
be placed on the Enchantment card in your play area, if your identity has the Enthralled trait, place 1 threat here
instead." (Checked.) Every "place 1 charm counter" in the Enchantress set meets it: 55001–55003, 55006, 55012–55014,
55016–55018, 55021, 55022, 55024, 55026.

**Rules.** RRG "'Would'" (p. 48) and "Replacement Effect" (p. 37). The interrupt is per counter: "a charm counter …
place 1 threat here instead".

**Plan.** `TriggerEvent countersBeingPlaced { targetInstanceId, counterType, amount, playerId }`, opened before
`addCounters` places (and before a `moveCounters` arrival), only when an ability listens, as `encounterCardBeingDealt`
is planned (§3.45). A replacement resolves once per counter of the event: N charm counters become N threat. The replaced
placement announces no `countersPlaced`. The threat is placed by the scheme's ability, so it is not "threat placed by
the villain's scheme" and no boost or crisis rule reads it; it does count toward the stage's target and can complete it.

**Tests.** An Enthralled player with Prime Real Estate 1B at 3 threat is attacked by Enchantress: 4 threat, the Trance
holds 0 counters. A Defiant player in the same game: 1 charm counter, 3 threat. Future of Despair revealed with one
Defiant and two Enthralled players: 1 counter, 2 threat. Kiss of Temptation's Forced Action for an Enthralled player: 1
threat, then the draw and discard.

### 3.56 "If Defiant, choose one. If Enthralled, do both in any order": options chosen before they resolve

> **Status: not started (exists (compose)).** `chooseOne` with `count` ("`count` options are chosen and resolve in the
> order chosen", wave 2 §3.7), `Predicate hasTrait` on an identity with gained traits, `enemyScheme` and `enemyAttack`
> with a stat bonus, `Predicate inMode`.

**Cards.** "Do My Bidding" 55023, Magical Restraints 55024, Spell Blast 55025: "When Revealed: If your identity has the
Defiant trait, choose one. If your identity has the Enthralled trait, do both in any order: • … • …". (Checked.) Sindr
55019 and Spellbound 55022 read the two traits in separate sentences.

**Rules.** Ruling February 28, 2026 – Ruling 5: "(1) You resolve the first sentence by choosing (not yet resolving) an
option. If not Enthralled, the second sentence has no effect. Then you resolve the chosen option. (2) Yes. You can
choose for Enchantress to scheme even if confused, which removes her Confused status card." RRG "Choose (Option)" (p.
12).

**Plan.** Read both traits **before any option resolves**: Defiant → `chooseOne` (count 1); Enthralled →
`chooseOne { count: 2 }`, the order chosen being the "any order"; neither trait (no Enchantment attached: the set in
another scenario's deck by a custom game) → nothing. An option that flips the Hypnotic Gaze while resolving (Magical
Restraints' counter being the fifth) does not add the second option: the second sentence was read before. Options are
offered whether or not they would change anything (a confused Enchantress may be chosen to scheme; a stalwart identity
may choose "You are stunned" and still places the counter). The "(with +1 SCH in expert mode)" is `inMode` inside the
option.

**Tests.** A Defiant player at 4 charm counters picks Magical Restraints' first option: stunned, the counter flips the
Gaze, the Trance's When Revealed resolves, the second option is not resolved. An Enthralled player resolves Spell Blast
in expert mode in the order attack, scheme: an attack at ATK + 1, then a scheme at SCH + 1. Spell Blast with Enchantress
confused, option scheme: no threat, the status card discarded.

### 3.57 Linked to an encounter card: allies set aside for a modular set, taken by the defeating player

> **Status: not started (extend).** Exists: `KeywordInstance linked { cardTitle }`, set aside per **player deck**
> holding the named title (`setup.ts`, wave 7 §3.75), owner on taking control; `RuleSpec excludedFromAllyLimit`
> (Stinger); `putIntoPlay` from set aside under a player; `PlayerRef defeatingPlayer`; Victory 0 on player cards
> (Redemption 51036, §3.38). Missing: a linked card whose named card is in the **encounter deck**, and a name with a
> card type in it.

**Cards.** Absorbing Man 55063, Titania 55064, Whirlwind 55065, Zzzax 55066: "Linked ([title] minion). Victory 0. Does
not count against your ally limit." The minions 55056–55059: "When Defeated: The player who defeated this minion puts
the set-aside [title] ally into play under their control." (Checked.)

**Rules.** MC55 p. 2: a linked card "is set aside at the start of the game if any encounter card or card in a player's
deck includes the card that brings the linked card into play". RRG p. 27: "if any deck includes the card"; "The number
of linked cards set aside during setup is equal to the number of those cards included in the product"; "When a player
takes control of a card with the linked keyword, that player becomes the owner of that card." MC55 p. 4: "The player who
defeated that minion puts the set-aside ally version of that minion into play under their control." RRG "Victory X" (p.
46).

**Plan.**

- The linked keyword's `cardType` (§1.15 item 6) narrows the named card. Setup's linked pass also looks at the
  scenario's encounter cards (every encounter deck and set-aside encounter card of the game): one set of linked cards
  for the game when any holds the named card, in the shared set-aside area with no owner. A player deck match is
  unchanged.
- The minion's When Defeated: `putIntoPlay` the set-aside card of that title and type `ally` under `defeatingPlayer`.
  With no defeating player (the minion is defeated by an encounter card's damage) the first player decides who takes it,
  by MC55 p. 23's rule for an unspecified player; flagged in §4.2. The minion goes to the victory display (Victory 1),
  so it is never defeated twice.
- The ally is its taker's from then on: ready, in their play area, owner set. Defeated, it goes to the victory display
  (Victory 0), not to a discard pile, and never returns.
- `excludedFromAllyLimit` with the card itself as target.

**Tests.** An Enchantress game with Trickster Magic: four allies set aside at setup, none in any deck or hand; a game
without the set: none. Player 2 with three allies defeats Titania: the Titania ally is in player 2's play area, ready,
owned by player 2; the ally limit is not exceeded and no ally is discarded; the minion is in the victory display. The
ally defeated: 2 cards of that title in the victory display, worth 1 and 0.

### 3.58 A cost every player pays

> **Status: not started (extend).** `AbilityCost` has `exhaustIdentity` and `damageSelf` for the paying player, and
> alliance costs paid from every hand (`paidAsGroup`). Searched for a cost each player pays in kind: `eachPlayer` in
> `abilities.ts`, nothing.

**Card.** Crown of the Enchantress 55016: "Hero Action: Each player exhausts their identity and takes 1 damage → discard
this card." (Checked.)

**Rules.** RRG "Cost" (p. 13): a cost that cannot be paid in full cannot be paid. The triggering player must be in hero
form; the card asks nothing of the other players' forms.

**Plan.** `AbilityCost.eachPlayer?: AbilityCost`: the inner cost is checked and paid for every player not eliminated, in
player order; one player who cannot (an exhausted identity; an identity that "cannot take damage") makes the whole cost
unpayable. Damage paid this way is damage from a cost (`settleCostDamage`): tough status cards prevent it and are
discarded, and the cost is still paid, as for `damageSelf` today. An identity brought to 0 by it is defeated after the
ability resolves.

**Tests.** Three players, one exhausted: not offered, and `why-not` names that player. All ready: three identities
exhausted, 1 damage each, the Crown discarded; in expert mode Enchantress loses stalwart with it. One player with a
tough status card: no damage to them, the card discarded, the cost paid.

### 3.59 God of Lies: a villain and a main scheme in a neutral area that only abilities naming them can reach

> **Status: not started (exists (compose)).** Exists: closed in-play scenario areas (`ScenarioPlayAreaState.closed`,
> `createScenarioPlayArea`, `TargetQuery.inScenarioPlayArea`, `AbilityDefinition.reaches`; wave 8 §3.33: "skipped by
> every query and selector of an ability that does not name the area"); `Scenario.startingVillain: "bySetup"` with
> `addVillain` among set-aside villains (wave 5 §3.1); `ScenarioRules.victory: "cardAbility"`; main scheme A faces with
> two Setup abilities in a stated order. The numbers on the two neutral cards are §3.66's.

**Cards.** Loki, God of Lies 55027a/b; Worlds Collide 55028a/b ("Cards cannot affect this scheme or Loki, God of Lies,
unless they refer to those cards by title."); Mischief and Mayhem 55033a/b. (Checked.)

**Rules.** §1.15 and §2.8 quote MC55 pp. 10 and 18.

**Plan.**

- The scenario builder creates a closed scenario play area named `neutral` and puts the two `Scenario.neutralCards` in
  it as plain instances. **Neither gets a `VillainState` or a `MainSchemeState`**: `state.villains`, `activeVillainId`
  and `state.mainScheme` are the Avatar and Mischief and Mayhem, so "the villain", "the main scheme", step one's threat,
  acceleration tokens, crisis and hazard icons, attacks, thwarts and status cards never find the neutral cards, with no
  special case anywhere. This is the insert's rule and the engine's existing closed-area rule at once.
- An ability "refers to them by title" by `reaches: { scenarioPlayArea: "neutral" }`. In this pack that is four:
  Mischief and Mayhem 1B's two interrupts, the Shatter helper's step 1, and the neutral cards' own text.
- Loki's hit points and Worlds Collide's threat are **not** `damage` and `threat` on those instances: they are the
  group's copy of the pod's shared record (§3.66), which is the one place they live. Views read them through
  `sharedVillain(state)` and `sharedScheme(state)`; the instances carry the faces and the text.
- "If Loki, God of Lies has 10 [per player] or fewer remaining hit points, flip this card" and "If this stage is
  completed" are not scripted as state checks on the instances: they are results of the shared reducer (§3.66), which is
  what lets a coordinator own them later. Loki's When Revealed and the two bold outcome lines are abilities of 55027b
  and 55028b in the registry, run when the reducer's result is applied.
- Setup order (MC55 p. 10): the builder lists Worlds Collide (A)'s Setup before Mischief and Mayhem (1A)'s. The first
  creates the area and the shared record; the second is §2.8 step 3.

**Tests.** One player, standard: after setup `state.villains` holds four Avatars, one in play, `state.mainScheme` is
Mischief and Mayhem 1B at 0 threat of 8, the neutral area holds two cards, the shared record reads 20 hit points,
target 2. A player card that says "deal 5 damage to the villain" damages the Avatar and offers no neutral card; "remove
2 threat from a scheme" offers Mischief and Mayhem and side schemes only; a card that stuns "an enemy" does not offer
Loki, God of Lies. Step one of the villain phase places 1 threat (one player) on Mischief and Mayhem and none on Worlds
Collide. Three players: 60 hit points, flip at 30, target still 2.

### 3.60 The Avatars of Loki: never defeated, flipped, shattered, and swapped by trait

> **Status: not started (extend).** Exists: `swapVillain` and `advanceToSetAsideVillain` (`resolve/villain-swap.ts`,
> wave 4 §3.7): the villain stays one instance, takes a random set-aside villain card **of its title**, the old card
> goes set aside, everything on the instance stays, a swap keeps the dial and announces `villainSwapped`; `flipCard` on
> a villain (the new face's When Revealed resolves); `infiniteHp` stages; a defeat replaced from a forced interrupt
> (§3.5); `dealEncounterCard`; counters on a villain instance. Missing: a pool chosen by trait rather than title (the
> four Avatars have four titles, and the card in play is a Fading Figment when the Shatter swap happens), the starting
> face, and a swap that sets the dial.

**Cards.** Loki the Rascal 55029a, the Miscreant 55030a, the Knave 55031a, the Wretch 55032a: "Forced Interrupt: When
this villain would be defeated, place 5 [per player] shatter counters here and flip this card instead." Fading Figment
55029b–55032b: "When Revealed: Shatter the illusion (see the set-aside Shatter the Illusion card). Choose a group in
your pod, then place synergy counters on their [Unified Front / Mounting Resistance / Domineering Force / Feigned
Retreat] environment equal to the number of players in their group." The rules card: "1. Remove each shatter counter
from Fading Figment, then deal damage to Loki, God of Lies equal to the number of shatter counters removed this way. 2.
Swap the Fading Figment in play with a random set-aside villain, Avatar of Loki side faceup, then set the hit point dial
of that Avatar of Loki villain to its printed hit point value. 3. Deal each player 1 facedown encounter card." Stories
and Lies 55051: "Swap the Avatar of Loki villain in play with a random set-aside Avatar of Loki villain. Then: …". All
checked.

**Rules.**

- MC55 p. 19: the steps are followed "in order, resolving each fully before proceeding to the next step in the sequence,
  and resolve all such steps before the second sentence of the Fading Figment's 'When Revealed' ability." A swap "does
  not cause any Avatar of Loki villain to leave play, enter play, or be revealed. Sustained damage (on the villain's hit
  point dial), attachments, status cards, counters, and tokens on the Avatar of Loki villain should be transferred … The
  Avatar of Loki villain that was swapped out should be set aside with the other remaining set-aside versions of the
  villain."
- **RRG 1.8 erratum, p. 70** ("Rulebook pg. 19, Swapping Avatars of Loki, paragraph 1"): "Should read: 'When a card
  effect instructs the players to swap an Avatar of Loki villain or Fading Figment with a random set-aside Avatar of
  Loki villain, they should replace the villain in play with one of the other set-aside versions of the Avatar of Loki
  villain.' (Rewritten to apply section's rules to swapping a Fading Figment with an Avatar of Loki villain.)"
- **Ruling February 28, 2026 – Ruling 3**, asked whether Intense Focus and Total Focus are removed from the game by the
  Shatter swap: "Scenario intent takes precedence: Intense Focus / Total Focus should not leave play. They attach to the
  swapped-in Avatar of Loki." This is the stated-intent case of the rules policy. The printed rules it overrides are RRG
  "'Swap'" (p. 42), under which two cards that "do not share a title" make the in-play card leave play with nothing
  transferred, and RRG "Permanent" (p. 32). **Built as ruled, and as the erratum now reads:** every Avatar swap in this
  scenario, from an Avatar or from a Fading Figment, transfers everything and nothing leaves or enters play.
- MC55 p. 18: "Shatter counters remain on an Avatar of Loki villain until that villain would be defeated and flips … if
  one Avatar of Loki villain swaps with another, any shatter counters on the previous villain transfer to the new
  villain". MC55 p. 20: the only way to damage Loki, God of Lies.

**Plan.**

- `swapVillain { villain, with?: { setAsideTrait: Trait }, face?: "starting", dial?: "keep" | "printed" }`. `with`
  absent is today's pool (the villain's own title), so Loki of wave 4 is unchanged. With a trait the pool is every
  set-aside villain card whose **starting face** has the trait: three of the four, since the one in play is not set
  aside; the outgoing card joins the pool with its starting face up, so it can come back later but not at once. The pick
  is one draw of the game's RNG. `dial: "printed"` sets remaining hit points after the exchange (§4.1 Q8 says to what,
  with Intense Focus attached); `"keep"` is Stories and Lies, which keeps sustained damage as MC55 p. 19 says.
- The transfer is what `villain-swap.ts` already does (one instance, a new card): attachments (Intense or Total Focus,
  Dark Scepter), status cards, counters and boost cards stay. No `cardLeavesPlay`, no `cardEntersPlay`, no When Revealed
  for the incoming Avatar; `villainSwapped` is announced. A stalwart or steady rule the new card is under is applied to
  the status cards it arrives with, as wave 4 does.
- **The defeat.** Each Avatar's Forced Interrupt replaces its defeat: `addCounters shatter` of 5 per player (the group's
  players: the icon is on a card in the group's area), then `flipCard` to the Fading Figment, whose When Revealed
  resolves. Excess damage is lost; the attack that dealt it finishes against a villain with infinite hit points.
  Overkill has nothing to spill (it reads a minion's defeat). A "when the villain is defeated" ability on a player card
  does not resolve: the villain was not defeated.
- **The Fading Figment's When Revealed**, resolved by the first player (MC55 p. 23), one frame at a time so each step is
  finished before the next: (1) `removeCounters shatter` (all), then the shared event of §3.66 with the number removed;
  (2) `swapVillain { with: { setAsideTrait: "AVATAR OF LOKI" }, face: "starting", dial: "printed" }`; (3)
  `dealEncounterCard` to each player; then the card's second sentence by §3.67's selectors. The three steps are one
  helper in `@mc/cards` used by all four faces; the engine has no "shatter" effect.
- A Fading Figment is in play only inside its own When Revealed. It has dashes for SCH and ATK and no Avatar of Loki
  trait, so Intense Focus's "+2 [per player] hit points" and steady, and Dark Scepter's stalwart, do not apply while it
  is the face up; they apply again to the Avatar swapped in.
- Loki, God of Lies flipping or being defeated during step 1 does not interrupt the steps: §3.66 queues its consequences
  behind the resolution in progress (MC55 p. 20).

**Tests (exact numbers).** One player, Loki the Knave at 15 hit points with 2 shatter counters and Dark Scepter attached
takes 20 damage: 7 shatter counters, the Fading Figment up, 0 counters, Loki, God of Lies at 13 of 20; a different
Avatar is in play at its hit points with Dark Scepter attached, the Knave is set aside Avatar side up, the player holds
1 facedown encounter card, and the environment named on the Knave's reverse (Domineering Force) holds 1 synergy counter;
replay deep-equal. Two players: 10 shatter counters from the defeat, 2 encounter cards dealt, 2 synergy counters.
Expert, Intense Focus attached: it is attached to the new Avatar and no `cardLeavesPlay` was announced for it (the
ruling's test). Stories and Lies on an Avatar with 6 damage, 3 shatter counters and a tough status card: the new Avatar
has all three, then schemes or attacks by its name. With no set-aside Avatar (a hand-built state): nothing is swapped
(RRG p. 42: "A swap cannot be completed if there is not a component in both locations").

### 3.61 A maximum on the counters a card holds

> **Status: not started (new).** `addCounters.upTo` is the "(to a maximum of X)" of one ability, local to it by ruling
> June 2, 2026 (1) as its doc says. Nothing caps a card's counters whoever places them: searched `maxCounters`,
> `counterCap`, `counterLimit`, nothing.

**Cards.** Domineering Force 55052, Feigned Retreat 55053, Mounting Resistance 55054, Unified Front 55055: "Permanent.
Max 1 [per player] synergy counters here." (Checked: the per player icon.) Placed by the four Fading Figments ("equal to
the number of players in their group"), The Mangog and Door Between Worlds (1 on one of the group's choice), Fenris
Wolf, Hraesvelgr, Laufey and New Jotunheim (1 on the named one).

**Rules.** RRG "Max, Maximum" (p. 28). The sentence is a constant on the card that holds the counters, so it binds every
placement, unlike a parenthesis on a placing ability.

**Plan.** The card's `counterLimit` (§1.15 item 5) becomes
`RuleSpec counterLimit { card: self, counterType, max: ValueSpec }`. `addCounters` and a `moveCounters` arrival place
`min(amount, max − held)`; the rest is not placed, announces nothing, and is logged
`countersNotPlaced { instanceId, counterType, amount, reason: "limit" }`. `countersPlaced` carries the number really
placed and is not announced for 0. A choice "on one of their Synergy environments" offers every environment, full or not
(the card does not say "that can hold one"); choosing a full one places nothing.

**Tests.** One player: a Fading Figment places 1 on Unified Front (max 1); Laufey's defeat then places 0 and logs the 1
not placed. Three players: max 3; at 2, a Fading Figment's 3 places 1. Four players at 4: nothing. The Mangog defeated
with all four full: 3 shatter counters placed, no synergy counter.

### 3.62 An identity that "would be defeated" stays in the game; a main scheme's completion replaced

> **Status: not started (exists (verify)).** `TriggerEvent defeat` with a forced interrupt and `replaceTriggeringEvent`;
> `setRemainingHitPoints` ("Set his hit point dial to 1 instead", Captain America's Helmet);
> `changeForm { to: "alterEgo" }`; `mainSchemeCompleting` with a replacement (§3.18: "a main scheme whose completion is
> replaced");
> `removeThreat` of all. Unproved: the interrupt on an encounter card answering **any identity's** defeat, and
> `changeForm` for an identity already in alter-ego form or one that changed form this round.

**Card.** Mischief and Mayhem 1B 55033b: "Forced Interrupt: When this scheme would be completed, remove all threat from
here and place 1 threat on Worlds Collide instead. Forced Interrupt: When an identity would be defeated, change that
identity's form to alter-ego, set its hit point dial to 1, and place 1 threat on Worlds Collide instead." (Checked,
twice.)

**Rules.** MC55 p. 21 calls the second "an identity is defeated"; the card replaces the defeat, so RRG "Player
Elimination" (p. 34) never begins: the player keeps everything, minions stay engaged, the first player token does not
move. RRG "'Would'" (p. 48).

**Plan.**

- First interrupt: `removeThreat` of all from this scheme, then §3.66's shared event (cause `schemeCompleted`, amount
  1). The stage stays 1B at 0 threat with its acceleration tokens (the card removes threat, not tokens); it is not
  advanced, not "completed", and can fill again.
- Second: `changeForm` to alter-ego as an effect of the scheme (not the player's once-per-round change; `formChanged` is
  announced when the form does change, and nothing happens for an identity already in alter-ego form),
  `setRemainingHitPoints` 1, then the shared event (cause `identityDefeated`, amount 1). Damage beyond the defeat is
  lost. An ability that reads "after your identity is defeated" does not resolve. An identity with a multi-form or suit
  form goes to its alter-ego face by the existing `changeForm`.
- Both abilities carry `reaches: { scenarioPlayArea: "neutral" }`.

**Tests.** One player, the scheme at 7 of 8 in step one: 0 threat on it, Worlds Collide at 1 of 2, the game goes on. A
hero at 2 hit points takes 5: alter-ego, 1 hit point, Worlds Collide +1, not eliminated, engaged minions unchanged, and
the attack's "after … attacks you" responses still resolve. The same in alter-ego form: no `formChanged`. The second
threat on Worlds Collide: §3.66's loss.

### 3.63 "Find [card] and reveal it" for a card in play; "did not enter play this way"

> **Status: not started (exists (verify)).** `findCard` and `TargetRef find` reach a card in play first (RRG p. 19;
> ruling December 17, 2025 – Ruling 4 (3) for what is "in the game"); "find and reveal, already in play" is in §3.35's
> vocabulary (51042 and its siblings); `flipCard { reveal: true }` from a result of another card; `giveStatus`;
> `discardEncounterCards` and a player deck discard by count.

**Cards.** Total Focus 55034b: "When Revealed: Discard the top 2 [per player] cards of the encounter deck and the top 5
cards of each player deck. Find Dark Scepter and reveal it. If Dark Scepter did not enter play this way, give the Avatar
of Loki villain a tough status card." Dark Scepter 55036: "Attach to the Avatar of Loki villain. The Avatar of Loki
villain gains stalwart. Treacheries cannot be canceled. Hero Response: After you resolve a treachery, spend 2 resources
of the same type → discard this card." (Checked.)

**Rules.** Ruling June 25, 2026 – Ruling 5: "Yes. Finding and revealing an attachment already in play triggers its When
Revealed abilities and keywords." RRG "Find" (p. 19); "When Revealed Abilities" (p. 48). Dark Scepter prints no When
Revealed and no keyword, so for this card the ruling changes nothing that resolves; what it settles is that the reveal
**happens** for a card in play.

**Plan.** The find looks in play, then the encounter discard pile (where step one of this very ability may just have put
it), then the encounter deck (shuffled after). Found out of play, it is revealed and attaches to the Avatar: it entered
play this way, no tough card. Found in play, it is revealed where it is (incite, surge and When Revealed would resolve;
it has none): it **did not enter play**, so the Avatar gets a tough status card. Found nowhere (in the victory display
or removed from the game, which a find does not search): the tough card. The condition reads the find's result
(`eventResult` of the reveal: entered play or not), not whether the card is in play afterward.

**Tests.** Dark Scepter in the encounter deck: revealed, attached, no tough card, the deck shuffled. In the discard pile
after the 2 discarded cards: the same, no shuffle. Already attached: one `cardRevealed` for it, it stays, the Avatar has
a tough status card. One player: 2 encounter cards and 5 player cards discarded; three players: 6 and 5 each.

### 3.64 Epic groundwork: the pod record and `GroupId` on game state

> **Status: not started (new).** Plan item 2 (`docs/epic-multiplayer-plan.md` §3). Searched: `GroupId`, `pod`,
> `groupsAtStart` in `packages/engine/src`: nothing. `ids.ts` has the branded ids (`GameAreaId` and its maker
> `gameAreaId`); `GameAreaState` is Kang's split of one table and is **not** a group (its areas share one phase clock,
> one encounter deck and one RNG). `GameLog` is `{ initialState, commands }`: it has **no header**.

**Why now.** Every other Epic item reads it: the per group count (§3.65), the shared record (§3.66), "a group in your
pod" (§3.67), the inbound sequence (§3.68), the seed (§3.69).

**Corrections to the plan's shape.**

- The plan puts `GroupId` "in the log header". There is none, and none is needed: `GameLog.initialState` is the replay
  baseline and already carries everything fixed at setup (seed, card pool, `startingPlayerCount`). The pod record goes
  on `GameState`, so it is in the baseline and a group's log names its group with no format change.
- The plan's `pod: { groupId, groupsAtStart }` has one group count. The cards need three numbers that differ in Epic:
  groups in **this pod** (a per group icon on a card in a group's area, MC55 p. 4), groups in **the whole game** (the
  icon on Worlds Collide: "the total number of groups in all pods", 55028b), and players in **the whole game** (the per
  player icons on Loki, God of Lies: "the total number of players in all game areas", 55028b). All three are fixed at
  setup: the Epic Multiplayer Reminder card says "the number of groups that began the scenario in that pod" (checked),
  as RRG "Per Player Icon" (p. 32) says "the number of players who started the scenario. If a player is eliminated, this
  value does not change."
- The plan leaves out who applies shared events. With one group the engine is its own coordinator; with several it must
  not be. That is one explicit field, not a guess from the group count.

**Plan.** A new pure module `pod.ts` (no `Ctx`, no card names):

```ts
export type GroupId = Brand<string, "GroupId">;
export const groupId = (value: string): GroupId => value as GroupId;
export const SINGLE_GROUP = groupId("g1");

export interface PodState {
  readonly groupId: GroupId;
  /** Who applies shared events: this engine (Single Group Mode) or a pod coordinator outside it (Epic). */
  readonly coordinator: "local" | "remote";
  readonly groupsInPodAtStart: number;
  readonly groupsInGameAtStart: number;
  readonly playersInGameAtStart: number;
  /** The shared villain and scheme (§3.66); null in a scenario with no neutral cards. */
  readonly shared: SharedPodState | null;
  /** Shared events this group has emitted, and inbound events it has applied (§3.66, §3.68). */
  readonly outboundSeq: number;
  readonly inboundSeq: number;
}
```

- `GameState.pod?: PodState`, absent in every game without a pod so older saves and every existing snapshot read
  unchanged. `podOf(state)` returns the record or the single-group default (`g1`, `local`, 1, 1, `startingPlayerCount`,
  `shared: null`), and is the only reader.
- `GameSetupConfig.pod?: { groupId; coordinator; groupsInPod; groupsInGame; playersInGame }`. The scenario builder
  passes it for a scenario with `neutralCards` (§1.15), with the single-group values; nothing else does. Setup rejects
  `coordinator: "local"` with more than one group in the game (a local coordinator cannot hear the others).
- **Per-group difficulty (plan item 8, verify only):** checked by reading. `ScenarioRules.difficulty` is on `GameState`,
  and under the plan's option B a `GameState` is one group, so difficulty is per group already; `Predicate inMode` reads
  it. Nothing to build. The scenario game of §8.4 pins it: Loki's When Revealed attaches Intense Focus in a standard
  game and flips it in an expert one.
- **Deferred with the plan** (items 7 and 9): a group's status in the pod, and cross-area attacks and thwarts. §3.67
  declares the rule kind the two cards need so they do not change later.

**Tests.** An ordinary Core game has no `pod` key, `podOf` gives the default, and its saved log replays byte for byte as
before. A God of Lies game for three players:
`{ groupId: "g1", coordinator: "local", groupsInPodAtStart: 1, groupsInGameAtStart: 1, playersInGameAtStart: 3 }`,
present in `log.initialState`, and JSON round-trips. Setup with `local` and `groupsInGame: 2` is an error.

### 3.65 Epic groundwork: the per group icon read from the group counts

> **Status: not started (extend).** Plan item 1. The schema has it (`ScalingValue.perGroup`, `perGroupOnly`,
> `MinionCard.hpPerGroup`, validation) and the data emits it (Worlds Collide `targetThreat.perGroup: 2`, Door Between
> Worlds `startingThreat.perGroup: 7`, The Mangog `hpPerGroup: true`). The engine ignores it: `scale` is
> `value.base + value.perPlayer * playerCount` (`query.ts` line 33), so today Door Between Worlds enters with **0**
> threat, and
> `minionPrintedHp` (line 76) reads only `hpPerPlayer`, so The Mangog has 10 by accident.

**Cards.** The Mangog 55041 (hit points 10 per group), Door Between Worlds 55046 (starting threat 7 per group), Worlds
Collide 55028b (target 2 per group). Checked: the three-figure icon, distinct from the per player icon on the Synergy
environments.

**Rules.** MC55 p. 4: "If the [per group] icon is on a card in a group's game area, that icon multiplies the value it is
next to by the number of groups in the respective pod. If the icon is on a card that is not in a specific group's game
area (such as the Worlds Collide main scheme), that icon multiplies the value it is next to by the total number of
groups in the game." The Reminder card: "groups that began the scenario in that pod". MC55 p. 10: one group in Single
Group Mode.

**Corrections to the plan's shape.** The plan names the three `scale` callers in `query.ts` (lines 595, 604, 822) and
misses the fourth place: a minion's hit points do not go through `scale` at all. It also gives `scale` one group count,
where Worlds Collide needs the game's (§3.64).

**Plan.**

- `scale(value, playerCount, groupCount)` = `base + perPlayer * playerCount + (perGroup ?? 0) * groupCount`, the third
  argument **required**, so the compiler finds every caller in the engine, the DSL, the client's view models and the
  tests. `scaleIn(state, value)` is the common call: the group's own `startingPlayerCount` and
  `podOf(state).groupsInPodAtStart`. The three `query.ts` callers become `scaleIn`.
- `minionPrintedHp`: `hpPerGroup` multiplies by `groupsInPodAtStart`, beside `hpPerPlayer`.
- The neutral cards' two values are scaled once, at setup, into the shared record, with the **game's** counts (§3.66):
  `playersInGameAtStart` for Loki's 20 and 10, `groupsInGameAtStart` for Worlds Collide's 2. No query scales a neutral
  card afterward.
- No `ValueSpec` for the icon: no ability text in the pack prints it (Puppet Master's "hinder 1" and the shatter and
  synergy numbers print the per player icon, which is the group's players).

**Tests (exact numbers; `scale-per-group.test.ts`).** In play, one group: The Mangog has 10 hit points, Door Between
Worlds enters with 7 threat, the shared record's target is 2. **Proving the multiplier is read, on hand-built states:**
`groupsInPodAtStart: 2` gives The Mangog 20 and Door Between Worlds 14; `groupsInGameAtStart: 2` at setup gives a target
of 4; `groupsInPodAtStart: 3` with `groupsInGameAtStart: 6` gives 30, 21 and 12, so the two counts are not confused.
`scale(perGroupOnly(7), 4, 1)` is 7 (players do not multiply it); `scale(scaling(2, 1), 3, 5)` is 5 (groups do not touch
a value without the icon). Door Between Worlds in expert mode has no hinder; a side scheme with hinder and a per group
value adds them.

### 3.66 Epic groundwork: shared villain damage and shared scheme threat as events through one pure reducer

> **Status: not started (new).** Plan items 3 and 4. Nothing like it exists: every change in the engine is a mutation of
> `ctx.state` logged as a `GameEvent`; `CommandResult.events` is the only thing that leaves `applyCommand`.

**Cards.** The Shatter the Illusion card, step 1 ("deal damage to Loki, God of Lies equal to the number of shatter
counters removed this way"); Mischief and Mayhem 1B's two interrupts ("place 1 threat on Worlds Collide"); Loki, God of
Lies 55027a ("If Loki, God of Lies has 10 [per player] or fewer remaining hit points, flip this card.") and 55027b (its
When Revealed; "If Loki, God of Lies is defeated, all players in all groups win the game."); Worlds Collide 55028b ("If
this stage is completed, the players lose the game."). Checked.

**Rules.** MC55 p. 20: "There is only one way for players to deal damage to Loki, God of Lies"; at 10 per player
remaining "the ability on Loki, God of Lies causes it to flip … Each group should pause gameplay activity in their game
area, first finishing any actions or abilities that are currently resolving. Then, the 'When Revealed' ability on Loki,
God of Lies triggers, affecting all groups simultaneously." MC55 p. 21: the "two ways to place threat on the Worlds
Collide main scheme"; at its target "Each group in the middle of a villain phase must finish any abilities currently
resolving, then stop play immediately; each group in the middle of a player phase may finish that phase as normal. If
Loki, God of Lies is defeated before all player phases in all groups end, all players in all groups win the game!
However, if Loki, God of Lies remains undefeated when all player phases in all groups end, all players in all groups
lose the game." §4.1 Q9 is the card's shorter sentence against this page.

**Corrections to the plan's shape.**

- The plan's `SharedPodState` is `{ lokiHp, worldsCollideThreat }`. Engine code names no card, and two numbers cannot
  say whether the flip already happened or whether the scheme is complete, which a coordinator must answer the same way
  every time an event is re-sent. The record below carries the thresholds, fixed at setup, and the two latches.
- The plan has the reducer return a new state only. It must also return **what happened** (flipped, defeated,
  completed), because those are exactly the inbound events of §3.68. One function, two outputs.
- The plan's event names say "villain" and "scheme" already; `source` and `cause` are kept, as a card-neutral enum.

**Plan.** In `pod.ts`:

```ts
export interface SharedPodState {
  readonly villainHp: number; // fixed at setup: 20 per player in the game
  readonly villainDamage: number;
  readonly villainFlipAtRemaining: number | null; // 10 per player in the game
  readonly villainFlipped: boolean;
  readonly schemeThreat: number;
  readonly schemeTarget: number; // 2 per group in the game
  readonly status: "playing" | "schemeCompleted" | "won" | "lost";
}

export type SharedEvent =
  | { readonly type: "sharedVillainDamaged"; readonly groupId: GroupId; readonly amount: number }
  | {
      readonly type: "sharedSchemeThreatPlaced";
      readonly groupId: GroupId;
      readonly amount: number;
      readonly cause: "schemeCompleted" | "identityDefeated";
    };

export type SharedResult = "sharedVillainFlipped" | "sharedVillainDefeated" | "sharedSchemeCompleted";

export function applySharedEvent(
  shared: SharedPodState,
  event: SharedEvent,
): { readonly shared: SharedPodState; readonly results: readonly SharedResult[] };
```

- **The reducer is total and pure.** Damage is capped at the hit points left; a flip is reported once (the latch);
  damage that crosses the flip line and reaches 0 in one event reports only `sharedVillainDefeated`; threat reaching the
  target sets `status: "schemeCompleted"` and reports it once; damage still applies after that (the race MC55 p. 21
  describes), and reaching 0 then sets `"won"`; every event is a no-op once the status is `"won"` or `"lost"`. It never
  reads a `GameState`, so the multiplayer phase moves it into the coordinator unchanged.
- **`EffectSpec sharedEvent { event: "villainDamaged" | "schemeThreatPlaced"; amount: ValueSpec; cause? }`** is what a
  script writes, on an ability that `reaches` the neutral area (§3.59). It always appends
  `GameEvent sharedEventEmitted { seq, event }` to the command's events, `seq` being `pod.outboundSeq + 1`: this is the
  seam a host reads in Epic.
- **`coordinator: "local"`** (every game of this wave): in the same command the engine calls `applySharedEvent` on
  `pod.shared`, stores the result, logs `sharedStateChanged`, and queues each result. **`"remote"`:** it does nothing
  more; the record changes only by §3.68.
- **Results are applied when the resolution in progress has finished** (the stack is empty), by one handler,
  `applyInbound`, shared with §3.68, so the local path and the remote path cannot drift:
  - `sharedVillainFlipped`: the neutral villain instance flips and its new face is revealed for this group
    (`TriggerEvent sharedVillainFlipped`; 55027b's When Revealed is an ability of that card, written with `inMode` and
    §3.67's "this group").
  - `sharedVillainDefeated`: `TriggerEvent sharedVillainDefeated`, answered by 55027b's bold line with
    `endGame { result: "win" }`.
  - `sharedSchemeCompleted`: `TriggerEvent sharedSchemeCompleted`, answered by 55028b's bold line. By default A of Q9:
    in the villain phase the loss is at once (with one group no player phase is running, so "all player phases … end" is
    already true); in the player phase the phase is played to its end (`pod.shared.status` stays `"schemeCompleted"`,
    the client shows it), and at `playerPhaseEnded` the players lose unless the status has become `"won"`. A win and a
    completion queued together resolve as the reducer left the status: `"won"` wins.
- The outcome uses the existing `endGame`, so `GameOutcome` gains no reason: the win is recorded as `endGame` records
  one today and the loss as `cardAbility` with the neutral scheme as its source.
- Views: `sharedVillain(state)` (hit points, remaining, flipped) and `sharedScheme(state)` (threat, target), for the
  client's two dials.

**Tests (exact numbers; `shared-villain-event.test.ts`, `shared-scheme-event.test.ts`).**

- Reducer alone, one player (20, flip at 10, target 2): damage 7 → 13 left, no result; 5 more → 8 left,
  `sharedVillainFlipped`; 1 more → 7, no result (latched); 9 more → 0, `sharedVillainDefeated`, status `"won"`, damage
  stored as 20; a further event changes nothing. From 12 left, 12 damage: `sharedVillainDefeated` only. Threat 1 → no
  result; 1 more → `sharedSchemeCompleted`; a third → threat 3, no second result.
- Reducer alone, **two groups and five players, hand-built** (100, flip at 50, target 4): 49 damage → no result; 1 more
  → flipped; three threat events from `g1`, `g2`, `g1` → no result; a fourth → completed.
- In play, one player: the Shatter test of §3.60 emits exactly one
  `sharedEventEmitted { seq: 1, event: { type: "sharedVillainDamaged", groupId: "g1", amount: 7 } }`. A second defeat
  with 6 shatter counters: 7 hit points left, and Loki's When Revealed resolves **after** the Fading Figment's whole
  When Revealed, so Intense Focus attaches to the Avatar that was swapped in (standard). A defeat that brings Loki to 0:
  the players win once the Shatter steps and the attack have finished.
- In play: Mischief and Mayhem completed in step one, twice: after the second the game is lost at once (villain phase).
  An identity "defeated" by retaliate in its own player phase with Worlds Collide at 1: status `"schemeCompleted"`, the
  player finishes the phase; if they defeat the Avatar and Loki reaches 0 in it they win, otherwise the loss is at
  `playerPhaseEnded`.
- **Remote, hand-built** (`coordinator: "remote"`): the same Shatter leaves `pod.shared` untouched, emits the same one
  event, flips nothing and ends nothing.
- Replay of every case deep-equal.

### 3.67 Epic groundwork: "this group", "a group in your pod", "each group in your pod"

> **Status: not started (new).** Plan item 5. Searched `group:` in `spec.ts` and the DSL: nothing about player groups.

**Cards.** The Fading Figments ("Choose a group in your pod, then place synergy counters on their [environment] equal to
the number of players in their group"); Fenris Wolf 55042, Hraesvelgr 55043, Laufey 55044, New Jotunheim 55048 ("Choose
a group in your pod, then place 1 synergy counter on their [environment]"); The Mangog 55041 and Door Between Worlds
55046 ("Each group in your pod places 3 shatter counters on their Avatar of Loki villain and 1 synergy counter on one of
their Synergy environments."; "Any player in your pod can attack The Mangog [thwart Door Between Worlds] as if it were
in their game area."); Loki, God of Lies 55027b ("Each group in standard mode … Each group in expert mode …"). Checked.

**Rules.** MC55 pp. 10, 13, 16, 17; MC55 p. 12: "Unless explicitly stated otherwise, cards and components in one game
area cannot affect another game area."

**Correction to the plan's shape.** The plan adds `group: "self" | "inPod"` to the **target** DSL, "resolved as the own
group … a choice later", with "Synergy placement targets `{ group, environment }`". That cannot work under the plan's
own option B: another group's environment is not an instance in this engine's state, so no `TargetQuery` in this state
can match it, now or later. What crosses to another group is not a target but **a block of effects to run there**. So
the selector goes on a block, and the block is what is local today and sent tomorrow.

**Plan.**

- `type GroupRef = "self" | { readonly var: string }`.
- `EffectSpec chooseGroup { chooser: PlayerRef; among: "inPod"; bind: string }`: the groups of the pod, this one
  included. With one group it binds `podOf(state).groupId` with no prompt (the existing one-option rule) and logs
  `groupChosen`. The multiplayer phase gives it its prompt and its list.
- `EffectSpec inGroup { group: GroupRef | "eachInPod"; effects: readonly EffectSpec[] }`: the effects are resolved **in
  that group's game area by that group's players**. For this group they resolve here, in place. For another group the
  engine resolves nothing and emits `GameEvent podEffectRequested { toGroupId, sourceCardId, abilityId, block }` (the
  block's index in the ability), which a coordinator turns into §3.68's `podEffect` there; `"eachInPod"` does both.
  Inside the block every ref means the receiving group: "their Avatar of Loki villain" is `theVillain`, "one of their
  Synergy environments" is a `chooseTarget` by that group's first player, "you" is that group's first player. A block
  may hold no ref to a card bound outside it (the DSL validator refuses one), since such a card does not exist there.
- `ValueSpec groupPlayerCount { group: GroupRef }`: "the number of players in their group". Inside a block, `"self"` is
  the receiving group, so the count is read where the counters land.
- `RuleSpec reachableFromPod { card: self; by: "attack" | "thwart" }`, for The Mangog and Door Between Worlds: declared
  now, **with no effect while the pod is one group** (every player of the pod is already in this game area). The
  multiplayer phase gives it meaning (plan item 9, deferred). Declared so the two cards' scripts are final.
- DSL builders `chooseGroup`, `inGroup`, `eachGroupInPod`, `thisGroup`, `groupPlayerCount`; `validate.ts` knows them.

**Tests (exact numbers; `group-selector.test.ts`).** One group, two players: a Fading Figment asks no group question and
places 2 synergy counters on its environment (max 2); `groupChosen { groupId: "g1" }` is logged; The Mangog's defeat
places 3 shatter counters and asks the first player for one environment. `legalActions` is identical with and without
`reachableFromPod` on The Mangog. **Hand-built, two groups, remote:** `inGroup` bound to `g2` places nothing here and
emits one `podEffectRequested { toGroupId: "g2", sourceCardId: "55044", abilityId, block: 1 }`; `"eachInPod"` places
here and emits one event per other group. The validator refuses a block that reads an outer slot.

### 3.68 Epic groundwork: the `externalEvent` command

> **Status: not started (new).** Plan item 6. `Command` (`commands.ts`) is a union of eight types, each from a player
> (`playerId`); `applyCommand` refuses any but `resolveChoice` and `concede` while a choice is pending, and everything
> once `state.outcome` is set; `legalActions(state, playerId)` lists a player's actions.

**Rules.** MC55 p. 20: a group hears of the flip and applies it after "finishing any actions or abilities that are
currently resolving". MC55 pp. 14–15: the organizer's announcements. Plan §2, option B: every inbound event is recorded
in the receiving group's own log, at its position, so the group replays alone.

**Corrections to the plan's shape.**

- "The command is rejected from a player seat." `applyCommand(state, command, deps)` has no notion of a seat or of who
  sent a command, and adding one would make the engine an authority, which the netcode owns. The engine's part: the
  command has **no `playerId`**, `legalActions` never offers it, and `commands.ts` exports `isAuthorityCommand(command)`
  for the host to refuse it from a seat. The seat rule is the multiplayer phase's and is tested there.
- "Applied at the next command boundary" is already the engine's rule: while `pendingChoice` is set the command is
  refused with the existing `choice_pending`, and the host re-sends it after the answer. No new queue in state.
- The plan's kinds (`lokiFlipped | podWon | podLost | synergyGranted`) name a card and a mechanic. The kinds below are
  card-neutral, and `synergyGranted` becomes the general `podEffect` of §3.67.
- A single-group game must never accept one, or its log would stop being a record of the players' commands alone.

**Plan.**

```ts
export type PodInboundEvent =
  | { readonly kind: "sharedStateChanged"; readonly shared: SharedPodState }
  | { readonly kind: "sharedVillainFlipped" }
  | { readonly kind: "sharedSchemeCompleted" }
  | { readonly kind: "podWon" }
  | { readonly kind: "podLost" }
  | {
      readonly kind: "podEffect";
      readonly fromGroupId: GroupId;
      readonly sourceCardId: CardId;
      readonly abilityId: string;
      readonly block: number;
    };

// added to Command
| { readonly type: "externalEvent"; readonly sequence: number; readonly event: PodInboundEvent }
```

- Refused with `no_remote_coordinator` unless `state.pod?.coordinator === "remote"`; with `external_event_out_of_order`
  unless `sequence === pod.inboundSeq + 1` (a re-sent event is refused, not applied twice; a gap is refused, so the host
  fills it); with `choice_pending` and `game_over` by the existing gates. Accepted, it sets `inboundSeq`, logs
  `podInboundApplied { sequence, kind }` and runs §3.66's `applyInbound`: `sharedStateChanged` replaces the group's copy
  of the record; the flip and the completion are the same handlers the local path uses; `podWon` and `podLost` end the
  game through the neutral cards' own lines; `podEffect` resolves the named block of the named ability from this group's
  registry, with this group's first player as "you" (an unknown card, ability or block is `unknown_pod_effect`).
- After `sharedSchemeCompleted` in a villain phase the group has stopped: every command but `externalEvent` and
  `concede` is refused with `pod_halted` until `podWon` or `podLost` arrives. In a player phase the phase goes on, and
  its end emits `GameEvent groupFinalPhaseEnded` for the coordinator and then halts the same way.
- Every exhaustive `switch` on `Command["type"]` (the engine's dispatch, the client's log view, the save migration) gets
  its arm; the compiler lists them.

**Tests (`external-event-command.test.ts`; every state hand-built with `coordinator: "remote"`, two groups).**
`legalActions` for each player never holds the command, in any step. In a one-group game the command is
`no_remote_coordinator`. Sequence 1 `sharedVillainFlipped` in a standard-mode group: Intense Focus is attached to the
Avatar, whose hit points rise by 2 per player of this group; sequence 1 again and sequence 3 are both
`external_event_out_of_order`; during a defend prompt it is `choice_pending` and passes after the answer.
`sharedStateChanged` then `podLost`: the outcome is a loss whose source is the neutral scheme. `podEffect` for a Fading
Figment's block in a three-player group with an empty environment: 3 synergy counters. **Equivalence:** a local
one-group game whose Shatter crosses the flip line, and a remote hand-built copy of the state before it given the same
Shatter, then `sharedStateChanged` and `sharedVillainFlipped`, end in states equal but for `pod.coordinator` and the two
sequence numbers. The log with the external events replays deep-equal with no coordinator present.

### 3.69 Epic groundwork: a seed per group, and inbound events that take no draw

> **Status: not started (extend).** Plan item 10. `RngState` (mulberry32) is one stream in `GameState.rng`, created from
> `GameSetupConfig.seed`, threaded by every consumer; the Avatar swap draws from it (`randomSetAsideVillain`,
> `nextInt`).

**Correction to the plan's shape.** The plan asks for "group-scoped RNG streams" and to "make the Fading Figment swap
draw only from" the group's. Under option B that is already so: one `GameState` is one group and its `rng` is that
group's; there is no pod-wide stream for a swap to draw from by mistake, and a second stream inside the state would be
state nothing reads. What is missing is smaller: how N groups get N different streams from one pod seed, reproducibly,
and a guarantee that bookkeeping from the coordinator cannot shift a group's later draws.

**Plan.**

- `groupSeed(podSeed: number, groupId: GroupId): number` in `pod.ts`: a pure 32-bit mix of the seed and the id's
  characters (FNV-1a over the id, xor the seed, one mulberry32 step), exported for the coordinator.
  `GameSetupConfig.pod.podSeed?` present: setup uses `groupSeed(podSeed, groupId)` in place of `seed` and records both
  in the pod record. Absent (every game of this wave): `seed` as today, so no existing game's draws change.
- **Inbound events that resolve no card text take no draw:** `sharedStateChanged`, `sharedSchemeCompleted`, `podWon`,
  `podLost`. The handler asserts `rng.draws` is unchanged. `sharedVillainFlipped` and `podEffect` resolve abilities,
  which may shuffle or pick at random (Total Focus's find shuffles the encounter deck); they draw from the group's
  stream at their place in the group's log, which is what replay reproduces.
- The coordinator has no RNG: the reducer of §3.66 is arithmetic.

**Tests.** `groupSeed(1, "g1")`, `groupSeed(1, "g2")` and `groupSeed(2, "g1")` are three different numbers, fixed in the
test as literals. A one-group game set up with and without a `pod` record draws the same Avatar from the same `seed`
(the record alone moves nothing). Hand-built remote state: the same twenty commands with and without a
`sharedStateChanged` inserted after the fifth give the same `rng.value` and `rng.draws` at the end and the same Avatar
on the next swap. Two groups seeded from one pod seed with the same decks draw different opening hands.

### 3.70 Rulings and FAQ answers on behavior the engine already covers

> **Status: not started (exists (verify)).** Each line is a test in the module that scripts the card; a failure comes
> back as an extend.

- **Ruling March 19, 2026 – Ruling 2** (RRG "Target", p. 43: "A target that 'cannot take damage' is not a valid target
  for an ability or game function whose only effect on that target is to deal it damage"): "No. Basic powers are game
  functions, but the rule … applies equally to basic powers. Enchantress cannot be targeted by Whirlwind's basic attack
  while immune to damage." `resolve/target-validity.ts` and `basicAttack` already cite it. Test: with Future of Despair
  in play the Whirlwind ally's basic attack does not offer Enchantress, so his interrupt cannot be reached through her;
  against a minion it removes 1 threat from each scheme in play (the main scheme and Future of Despair: +2 ATK, 0 + 2 =
  2 damage) and a scheme with no threat adds nothing.
- **Ruling February 28, 2026 – Ruling 5 (2)**: Spell Blast's scheme option may be chosen while Enchantress is confused
  (§3.56).
- **MC55 p. 22 FAQ**: Future of Despair enters with 5 or 6 per player (§2.8); a Temptation's Forced Action is required
  with no benefit (§3.53); "If Spell Blast initiates an attack against you while your identity is in alter-ego form,
  resolve the steps of the attack as usual" (`enemyAttack` against an alter-ego: the player may defend with an ally, the
  identity takes the damage).
- **MC55 p. 23 FAQ**: the first player resolves a Fading Figment (§3.60); Stories and Lies' attack against an alter-ego
  resolves as usual.
- **Ruling June 25, 2026 – Ruling 5**: §3.63. **Ruling February 28, 2026 – Ruling 3**: §3.60.
- **Steady and stalwart on a villain that changes card.** Intense Focus gives the Avatar steady; Dark Scepter and The
  Trickster Tango give stalwart. A status card on the instance when the rule arrives or leaves is handled by the
  existing rules (RRG pp. 40, 41). Test: a steady Avatar with one stunned card attacks normally; with Dark Scepter then
  attached the card is removed.
- **Patrol** (Fenris Wolf; RRG p. 32) stops thwarting Mischief and Mayhem, "the main scheme", and nothing about Worlds
  Collide, which no player can thwart at all (§3.59).

### 3.71 Reusable as is (pass 2c; checked by name against the engine unions)

As §3.35 and §3.52: the identifier and its doc comment were read; the scripting agent's tests prove each.

- **Keywords, all engine-level already:** hinder, incite, patrol, permanent, stalwart, steady, quickstrike, guard,
  retaliate, toughness, victory, surge, and `AttackKeyword` overkill and piercing. **By mode or by condition:**
  `keywordGrants` with `while: inMode` and a `value` ("In expert mode, this scheme gains hinder 1 [per player]", Puppet
  Master 55061; "In expert mode, this card gains incite 1", Dark Arts 55049, as wave 5 §3.11; Ulik's toughness, the
  Crown's stalwart); `attackKeywords` for Titania (both cards); `grantKeywordUntil` for The Trickster Tango's boost.
- **"Treacheries cannot be canceled."** `RuleSpec cannotBeCanceled`, whose doc comment already names Dark Scepter 55036.
- **"After you resolve a treachery"** (Loki the Miscreant, Loki the Knave, Dark Scepter): `encounterCardResolved` with a
  type filter. **"After you resolve a boost card during [his] activation, if that card is a treachery"** (Loki the
  Rascal): `boostCardResolved`, then `chooseOne` between `dealAsEncounterCard` and `spendResources`.
- **Encounter deck discards read by type** (Loki the Wretch, Grendell, Malekith, Hraesvelgr, Laufey, Aura of Stasis,
  Draugr Buddy; Minotaur counts the discard pile): `discardEncounterCards` with a bind and a count of treacheries;
  `discardEncounterUntil` (Law of Attraction); `dealAsEncounterCard` for the treachery handed to a player and for Draugr
  Buddy dealing itself (with `setDefeatDestination`: prove that a defeated minion is dealt rather than discarded).
- **Enemy activations from card text:** `enemyAttack` and `enemyScheme` with a stat bonus, `enemyActivation` ("activates
  against you"), `RuleSpec attacksDealIndirectDamage` (Sindr), a minion that attacks a named player (Ulik),
  `modifyStatUntil` for "+1 SCH and +1 ATK for this activation".
- **Restrictions:** `cannotTakeDamage` (Future of Despair), `cannotAttack { basicOnly }` and `cannotPlay` with a trait
  (Seduced), `cannotReady` (Wrapped in Chains), `cannotThwart { thwarter, schemes }` and
  `cannotDefend { target, attacker }` (Puppet Master, Love Triangle), `excludedFromAllyLimit` (§3.57).
- **Costs:** `sameResourceType` with `resources: 2` (Wrapped in Chains, Dark Scepter), typed resources (Seduced, Love
  Triangle), `exhaustCards` on the host (Love Triangle), `exhaustSelf`.
- **Playing a card inside an ability:** `playFromHand { costReduction }` (Alluring Call) and `playFromHand { card }`
  after a `draw` with a bind (Trance of Greed: prove the "If you cannot, take 1 damage" branch for a card that cannot be
  paid for and for a resource card).
- **The Synergy environments' abilities:** an optional interrupt on a card nobody controls, offered to the player the
  event is about, with `spendCounters` as its cost: `modifyAttack` (+4 damage), `modifyThwart` (+4 threat),
  `preventDamage` (4, on an identity); and `resource` with `forAnyPlayer` generating two wild resources (Unified Front;
  RRG "Resource Ability", p. 37). Prove each on an environment, since their precedents are on player cards.
- **Values:** the highest printed cost among the cards a player controls (`max` over `printedCost`, Absorbing Man
  55056); printed energy resources among discarded cards (`totalPrintedResources`, Zzzax 55059); the threat a removal
  really removed (`eventResult`, Whirlwind 55065); "+X to that power for this use … (to a maximum of +3)"
  (`modifyBasicPower` with `min`, Absorbing Man 55063, whose exhaust is an effect, not a cost: with nothing to exhaust
  he gets +0 and still acts).
- **"Otherwise"** (the Trances' When Revealed, Dark Arts, Love Triangle): the existing or-else forms (RRG
  "'Otherwise'").
- **A star boost that reveals its own card** (55012–55014): as the earlier sets that print "Boost: Reveal this card."

### 3.72 "You cannot make basic attacks"

> **Status: not started (extend).** `RuleSpec cannotAttack { target, player?, attacker?, while? }` forbids attacks on a
> target, by any means; `attackKeywords` has `basicOnly` ("matches only a basic attack"), `cannotAttack` does not.
> Searched "cannot make basic", "basic attacks" in `abilities.ts`: only that. `cannotPlay { player, cards }` exists.

**Card.** Seduced 55015: "Attach to your identity. You cannot make basic attacks or play Attack events. Alter-Ego
Action: Spend [energy] [mental] resources → discard this card." (Checked.)

**Rules.** RRG "'Cannot'" (p. 11). "You" is the attached identity's player and the basic attack is the identity's:
allies still attack (RRG "You, Your", p. 49: an ally's basic attack is not "you" making one), and an attack-labeled
ability that is not an event (a hero's own action, an upgrade's) is still allowed.

**Plan.** `cannotAttack` gains `basicOnly?: true`, read exactly as `attackKeywords.basicOnly` reads it (`attack.basic`),
with `attacker` the host identity and `target` every enemy. The second half is `cannotPlay` with the Attack trait on
events.

**Tests.** A Seduced hero: `basicAttack` is not legal and `why-not` names Seduced; an ally's basic attack is; an Attack
event in hand is unplayable; a non-event attack ability resolves. In alter-ego form with an energy and a mental
resource: the action discards it.

### 3.73 The campaign definition (`AOS_CAMPAIGN_DEFINITION`, pass 1b)

> **Status: not started (compose).** A linear graph, `LossPolicy.retry: "byInstruction"`, `EliminationPolicy`, the
> windows `beforeStartingHands` and `afterMulligans`, hidden log fields and the `cardState` field type all exist and
> were written with this box in mind (`campaign.ts`). Four gaps stand between that and a definition: §3.74 (a
> `cardState` field nothing can write), §3.75 (a draw that must stay sealed, and the envelope inside a game), §3.76 (a
> DEFEAT block that draws) and §3.77 (the evidence cards' Setup abilities). §3.78 lists what is reused as is.

**Cards.** The log (MC50 p. 24) and the five Campaign Instructions boxes (§2.9). The definition is
`packages/cards/src/campaigns/aos.ts`; its in-game effects come from the `aos/campaign/*` modules (§8.4).

**Log fields.**

| Field                   | Label, as the sheet prints it                | Scope   | Type                                               | Notes                                                                           |
| ----------------------- | -------------------------------------------- | ------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `remainingHp`           | Remaining hit points                         | perSeat | `number`, min 0                                    | `whenModes: { expertCampaign: true }`; pp. 6, 24                                |
| `secrets1`…`secrets4`   | Remaining Secret Counters by Scenario, #1…#4 | shared  | `cardState` over 50181a, 50182a, 50183a            | counter `secret` and the face; four fields, one a column (§3.74); pp. 6, 11, 24 |
| `minionsAndSideSchemes` | Scenario 1: Minions and side schemes in play | shared  | `number`, min 0                                    | pp. 9, 24                                                                       |
| `rescuedCaptives`       | Scenario 2: Rescued captives                 | shared  | `number`, min 0, max 4                             | pp. 11, 24                                                                      |
| `adaptoidEnvironments`  | Scenario 3: Adaptoid environments            | shared  | `cardList` (drawn as the sheet's four check boxes) | pp. 13, 24                                                                      |
| `survivingThunderbolts` | Scenario 4: Surviving Thunderbolts           | shared  | `cardList`                                         | pp. 15, 24                                                                      |
| `evidence`              | Evidence gained                              | shared  | `cardList`                                         | the sheet's crossed-out rows are derived from it; pp. 6, 24                     |
| `aimEnvelope`           | A.I.M. envelope                              | shared  | `cardList`, **`hidden`**                           | three cards, one a kind; p. 5                                                   |
| `boardEnvironments`     | (working)                                    | shared  | `number`, `working`                                | Board Member environments in play as the game ended                             |
| `cleanBoardMembers`     | (working)                                    | shared  | `number`, `working`                                | those of them with no secret counter                                            |
| `notes`                 | Notes                                        | shared  | `text`                                             | p. 24                                                                           |

The identity is `CampaignSeat.identityCardId`, as in every box. The S.H.I.E.L.D. envelope is not a field: it is the nine
evidence cards less `aimEnvelope` less `evidence`, and a gain draws from that set with the campaign's seeded RNG at the
moment of the gain. A paper envelope shuffled once and a draw made later are the same distribution; the difference is
flagged in §4.2, not asked. No field holds the accusation: it is made, answered and finished inside scenario 5's game
(§3.29's `accusationMade` event).

**Loss, elimination.** `loss: { retry: "byInstruction", retryBaseline: "nodeStart", citation: "MC50 pp. 4, 19" }`; only
node 5 has a `defeat` list. `elimination: { id: "mc50.elimination", citation: "MC50 p. 6", whenModes: { expertCampaign:
true } }` with no `rejoinAtPrintedHitPoints` (Q14 = A), and `everyNodeVictory: [defeatedSeatRecordsZero(…)]` as MC45
has.

**Instructions.** Ids are `mc50.s<n>.<setup|victory|defeat>.<name>`; each carries the printed sentence and its page.
"board(N)" and "common victory" are helpers shared by the nodes.

| Instruction                    | Step                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s1 `identity`                  | `betweenGames`, no ops (the seat already holds it)                                                                                                                                                                                                                                                             |
| s1 `evidence`                  | `betweenGames`: three **sealed** `random` draws (§3.75), one from each kind's three cards (`cards` sources built from the content records' `evidence` kind), into `aimEnvelope`; `clearField evidence`                                                                                                         |
| board(two) (s1)                | composition `setAsideCards` 50181a–50183a and 50184a–c; `inGame`, `beforeStartingHands`: put the three environments into play, 2 secret counters on each, shuffle the three treacheries into the encounter deck                                                                                                |
| board(`secretsN`) (s2, s3, s4) | the same, with each member's recorded counters placed on its environment and the recorded face restored (§3.74)                                                                                                                                                                                                |
| s2 `alertLevel`                | `inGame`: threat on Alert Level 50090a equal to `campaignLog minionsAndSideSchemes` (§3.7 (a)); the environment's own threshold then applies (§3.16)                                                                                                                                                           |
| s3 `locks`                     | `inGame`: 3 per player `lock` counters on the top card of the Holding Cell deck, then remove `rescuedCaptives` per player                                                                                                                                                                                      |
| s5 `adaptoidEnvironments`      | composition `setAsideCards` of the `adaptoidEnvironments` field; `inGame`: put them into play                                                                                                                                                                                                                  |
| s5 `adaptoids`                 | composition `setAsideCards` 50113 with `copies` 4; `inGame`: shuffle them into the encounter deck                                                                                                                                                                                                              |
| s5 `thunderbolts`              | composition: for each row of §1.16 item 5, `if fieldContains(survivingThunderbolts, title)` → `composeEncounterSets` adds that minion's set to the encounter deck; Jolt alone is added as a card. The Elite minions are in the deck, not set aside: 50130a's Setup is not this scenario's                      |
| s5 `envelopes`                 | `inGame`, `beforeStartingHands`: `seedHiddenPiles` from `aimEnvelope` and `evidence` (§3.75)                                                                                                                                                                                                                   |
| s5 `secrets`                   | `inGame`: the counters and faces of `secrets4` on the environments 50167a's Setup put into play (§3.74)                                                                                                                                                                                                        |
| s2–s5 `evidenceSetup`          | `inGame`, **`afterMulligans`**: for each card in `evidence`, its Setup ability (§3.77)                                                                                                                                                                                                                         |
| s2–s5 `hp`, `heal` (expert)    | `hpSet`; then the new helper `healRecForSecret` (§3.78), both at the default window (Q13 = A)                                                                                                                                                                                                                  |
| s1 `count`                     | `record`: `minionsAndSideSchemes` = `count(cardsInPlay(minions and side schemes))`, player side schemes included (RRG p. 34)                                                                                                                                                                                   |
| s2 `captives`                  | `record`: `rescuedCaptives` = `count(cardsInPlay(50091))`                                                                                                                                                                                                                                                      |
| s3 `adaptoidEnvironments`      | `record`: `adaptoidEnvironments` = `cardsInPlay(50109–50112)`                                                                                                                                                                                                                                                  |
| s4 `thunderbolts`              | `record`: `survivingThunderbolts` = `cardsInPlay(minions with the Thunderbolt trait)`; the minion attached to Thunderbolt Backup is in play (MC50 p. 15, §3.21)                                                                                                                                                |
| common victory `secrets`       | `record`: `secretsN` = `cardStateOf(Board Member cards, either face)` (§3.74)                                                                                                                                                                                                                                  |
| common victory `gain`          | `record` the two working numbers (`cardsInPlay` of Board Member environments, and of those with `missingCounter: "secret"`); then `betweenGames`: `if valueAtLeast(cleanBoardMembers, 1)` → one `random` from the six cards not in `aimEnvelope`, less `evidence` (`excludingTitles`), `appendToList evidence` |
| common victory `hp` (expert)   | `hpRecord`                                                                                                                                                                                                                                                                                                     |
| s5 `defeat.expert`             | `whenModes: { expertCampaign: true }`: `endCampaign lost`                                                                                                                                                                                                                                                      |
| s5 `defeat.standard`           | a standard campaign only (the complement of the expert gate), `betweenGames` (§3.76): read N = `count(evidence)`; three sealed draws into `aimEnvelope`; `clearField evidence`; N gains as in "common victory `gain`". The retry then runs node 5's Setup as printed                                           |
| s5 `victory`                   | `betweenGames`: `endCampaign won`                                                                                                                                                                                                                                                                              |

N is the number of cards in `evidence` when scenario 5 began: each of scenarios 1 to 4 gains at most one, and evidence
gained inside scenario 5 is the game's own state, never written to the log.

**Tests (definition level, two seats).** Scenario 1 won with the Medical Officer at 0 and 3 minions and 1 side scheme in
play: `minionsAndSideSchemes` 4, `secrets1` holds the three numbers, `evidence` holds one card that is not in
`aimEnvelope`. Scenario 2's Setup: 4 threat on Alert Level (two players: below 8, still Low); with 8 recorded it empties
and flips to High. Scenario 2 won with 3 captives: scenario 3's first Holding Cell holds (5 − 3) × 2 = 4 lock counters.
Scenario 4 won with the Elite minion of Gravitational Pull and Jolt in play: scenario 5's encounter deck holds every
card of Gravitational Pull and Jolt, and no other card of the Thunderbolts scenario set. Every instruction's `citation`
names a page of §2.9.

### 3.74 A `cardState` log field: written by a record, read inside a game

> **Status: not started (extend).** `LogFieldType cardState { cardIds }` and `LogValue cardState { cards: Record<string,
{ counters, face? }> }` exist. Nothing can write one: `campaign/result.ts` throws "a record instruction cannot yet
> write" it, and `campaign/log.ts` and `campaign/ops.ts` throw the same for the between-games vocabulary. `ValueSpec
campaignLog` and `Predicate campaignLog` read numbers, lists and flags only.

**Cards.** 50181a/b, 50182a/b, 50183a/b.

**Rules.** MC50 pp. 9–15: "Record the number of secret counters on each Board Member card in the campaign log"; p. 11:
"Place secret counters on each Board Member environment equal to the number of secret counters recorded for that
environment in scenario #1. (This will cause the environment to flip to its attachment side if enough secrets are placed
on it.)"; p. 6: "once a board member flips to its attachment side, it remains an attachment for the rest of the
campaign". The parenthesis and the bold sentence agree whenever the threshold is the same in both scenarios. They part
when it is not (§4.1 Q11), and that is why the face is recorded with the number.

**Plan.**

1. `CampaignGameQuery { kind: "cardStateOf"; query: TargetQuery; counters: readonly string[]; withFace?: true }`: one
   entry for each card in play that matches, keyed by the card id of its front face, with each named counter (0 when it
   has none) and, with `withFace`, the face it is on as §1.5 names faces. `campaign/result.ts` writes it to a
   `cardState` field and refuses a card the field's `cardIds` does not list.
2. The between-games vocabulary still cannot write a `cardState` field, and this box does not need it to. The two other
   throws stay.
3. In a game: `ValueSpec campaignLog` takes `card` and `counter` (the recorded number; 0 for a card not recorded), and
   `Predicate campaignLog` takes `card` and `face`. board(`secretsN`) is then three ordinary effects for each member:
   place the recorded counters on the environment in one placement; the environment's own text flips it at its threshold
   (§3.26); and if the recorded face is the attachment and the card is still an environment, flip it (Q11 = A).
4. The counters are placed while the card is an environment, so the attachment's "Forced Response: After a secret
   counter is placed here" does not answer them, at any count.

**Tests (standard mode unless said).** Recorded 2, 0, 5 with the third on its attachment face: the next scenario opens
with two environments at 2 and 0 and Tactical Officer's Aid attached to the villain holding 5; no Forced Response
resolved; the villain has its stat bonus. Recorded 3 on the environment face, the next scenario in expert mode: it flips
at setup by its own text. Recorded 3 on the attachment face (flipped in an expert-mode scenario), the next in standard
mode: an attachment holding 3 (Q11 = A; under B an environment holding 3). Two members recorded as attachments and the
third at 3 on its environment face, the next scenario in expert mode: all three are attachments and the players lose
during setup. A record names a card outside `cardIds`: an `EngineInvariantError`.

### 3.75 The A.I.M. envelope: a sealed draw, and the envelopes inside scenario 5

> **Status: not started (extend),** on §3.29 (a) (task 19). `LogFieldDef.hidden` and `CampaignLog.hidden` exist, and no
> view model reads their values. Two leaks remain. `CampaignOp random` traces what it drew
> (`CampaignChoiceRecord.picked`, kept in `CampaignLog.history`), so dealing the envelope with it writes the mole into
> the history. And `logViewFor` (`campaign/runner.ts`) copies a hidden field any instruction of the game reads into the
> game's `log.shared`. No predicate says "in campaign mode": `spec.ts` has only `campaignLog` reads (grep, this
> session).

**Cards.** 50185–50193; Zemo's Manipulations 50167a/b; The Accusation 50168a.

**Rules.** MC50 p. 5: "put one card from each set into the A.I.M. envelope **without looking at them**"; p. 19: "Set the
A.I.M. and S.H.I.E.L.D. envelopes aside so that you can access them during the scenario"; "Next, the players take the
evidence cards from the A.I.M. envelope". The owner's decision on design Q4 (2026-09-25) stands: the value is stored,
kept out of every view, and shown as a sealed envelope with a card count.

**Plan.**

1. `CampaignOp random` takes `sealed?: true`. Its record holds how many cards were drawn and `sealed: true`, with
   `picked` empty. A later op of the same step list may still read the slot, but only to write a `hidden` field; any
   other use is an `EngineInvariantError`. `perAttempt` composes with it (§3.76).
2. `CampaignLogView` gains `hidden`, apart from `shared`. A hidden field an instruction reads goes there and nowhere
   else.
3. `EffectSpec seedHiddenPiles { piles: Record<string, { campaignLogField }>; revealed: { campaignLogField }; rest: {
set: EncounterSetId; to: string } }` fills §3.29's `hiddenPiles` and `revealedPileCards` from the log: `aim` from
   `aimEnvelope`, the revealed cards from `evidence`, and the other cards of the set, shuffled with the game's RNG, as
   `shield`. Logged as `hiddenPilesDealt` with sizes only, as the standalone deal is.
4. `Predicate inCampaign`: true when `GameState.campaign` is present. Zemo's Manipulations uses it three times: 1A deals
   the piles only outside a campaign and places the two starting counters only outside one, and 1B gains 1 card inside
   one and 2 outside. These are branches of pass 1a's `baron-zemo` scripts, not a second script.
5. The visibility rule of §3.29 covers the campaign's copies as well: no player view, preview, log line, step trace,
   history entry or `CampaignLogView.shared` holds a card id of `aimEnvelope` or of the `shield` pile, before the
   accusation reveals the first and a gain reveals a card of the second.
6. `evidenceRowsLeft(grid, revealed)`, the pure function `accuse` already needs, is exported: the Dossier calls it with
   the log's `evidence` between games, and the table with `revealedPileCards` during scenario 5.

**Tests.** After scenario 1's Setup: `hidden.aimEnvelope` holds one card of each kind; the history entry of that step
holds three sealed records and none of the three ids; serializing every view model of the log finds none of them.
Scenario 5's opening state with two evidence cards earned: `hiddenPiles.aim` has 3 cards, `shield` 4,
`revealedPileCards` 2, and 27 rows are down to those without either card. A sealed slot written to `evidence`: refused.
The same campaign seed twice: the same envelope. The Response of 1B gains 1 card in the campaign and 2 in a standalone
game.

### 3.76 A DEFEAT block that draws: scenario 5 lost in a standard campaign

> **Status: exists (verify), extend if the proof fails.** `LossPolicy.retry: "byInstruction"` runs a node's `defeat`
> list, and the runner's own comment says a loss restores the log to the node's start **less** what the lost game
> removed from the campaign and what the `defeat` instructions wrote (`campaign.ts`, `LossPolicy.retryBaseline`;
> `campaign/runner.ts`). `random.perAttempt` exists (wave 8, task 42), documented for a node's Setup. No box before this
> one draws inside a DEFEAT block.

**Rules.** MC50 p. 19, DEFEAT (§2.9). MC50 p. 4's "no penalty" is the general sentence and p. 19's list the specific
one.

**What must hold.**

1. The block's writes survive the restore: the retry's `aimEnvelope` and `evidence` are the newly dealt ones.
2. **A second loss deals again.** A loss restores the campaign's RNG to the node's start, so a plain draw in the block
   would deal after the second loss exactly what it dealt after the first, and the players have seen that envelope.
   Every draw of the block carries `perAttempt`. To prove: the attempt count the mix reads inside a DEFEAT block differs
   between the first and the second loss.
3. N is read before `evidence` is cleared, and the N gains never draw a card of the new `aimEnvelope`.
4. In an expert campaign the same loss ends the campaign: `status` is `"lost"`, and no retry is offered.
5. The lost game's own evidence gains are nowhere in the log.

**Tests.** A standard campaign that reaches scenario 5 with 3 evidence cards and loses it twice: after each loss
`aimEnvelope` holds one card of each kind and `evidence` 3 cards outside it; the two deals differ (seeds chosen so they
do; the mix can repeat a deal by chance); `secrets4`, `adaptoidEnvironments`, `survivingThunderbolts` and every seat's
deck are as they were when the node began. Replaying the log from its seed reproduces both deals. The same in an expert
campaign: one loss, `status` `"lost"`.

### 3.77 The evidence cards' Setup abilities: a paid search of the collection for "a different" card

> **Status: not started (extend).** `EffectSpec searchCollection { player, filter, bind }` and `CollectionSearchFilter`
> (a pick of `categories`, `aspects` and `traits`; wave 7 §3.81) exist; so do a deck search to hand, a cost in counters
> on another card and a cost in threat. `CollectionFilter.notInOwnDeck` exists only between games. Missing: "a
> different" card inside a game.

**Cards.** 50185–50193 (nine scans, checked; §1.16 item 2 has each card's aspect and card type). 50186: "Setup: Each
player may add 1 secret counter to a Board Member environment to search their collection for a different Justice ally
and shuffle it into their deck. Each player may add 1 threat to the main scheme to search their deck for a Justice ally
and add it to their hand. (Shuffle.)"

**Rules.** MC50 p. 6: evidence cards "provide the players with … a 'Setup' ability that is resolved by the campaign
setup instructions for each subsequent scenario"; pp. 11–19: "After resolving mulligans, resolve the 'Setup' ability of
each evidence card the players have earned"; p. 18 (conversion): in the scenario itself "Ignore the text on the lower
portion of the evidence card as this text only applies during setup". Ruling August 3, 2026 – Ruling 4 (3): "Linked
cards cannot be included in decks", asked about a campaign reward.

**Plan.**

- An evidence card is never in play, so its ability is resolved by the instruction `evidenceSetup`, not by a trigger.
  `aos/campaign/evidence.ts` builds one effect list from (aspect, card type) and exports it by card id; the instruction
  resolves the list of each card in `evidence`, in the order gained. The registry entries `50185.setup` to `50193.setup`
  point at the same lists so the coverage guard counts them; the scripting agent reports how the guard treats an ability
  no card in play ever has.
- Each list is two offers to each player in player order. First: pay 1 secret counter onto a Board Member environment of
  that player's choice → `searchCollection` for the aspect and type, shuffled into their deck. Second: pay 1 threat onto
  the main scheme → search their deck for the aspect and type, into their hand, shuffle. A search may find nothing; the
  cost stays paid (RRG "Search", p. 39).
- `CollectionSearchFilter` gains `notAmongOwnCards?: true`: no card whose title is among the searching player's cards in
  this game (deck, hand, discard pile, play area). That is "a different" under Q12 = A.
- Linked cards are left out of the search by the ruling above. The card's aspect need not be the deck's: the card names
  the aspect, and that is what the players paid for.
- The first offer needs a Board Member environment in play, and its counter can flip that environment (§3.26); a third
  flip here loses the game before the first turn.

**Tests.** Wiretap earned, two players, standard mode: each is offered both; player 1 pays both: a board member gains 1
secret counter, a Justice ally no card of theirs shares a title with is in their deck, the main scheme has 1 more
threat, a Justice ally from their deck is in their hand (seven cards). Player 2 declines both: nothing changes. A deck
with no Justice ally: the threat is placed and the search finds nothing. Three evidence cards: six offers a player. A
board member at 3 chosen for the cost: 4, it flips before the search. Standalone Baron Zemo: no offer is ever made.

### 3.78 Reusable as is (pass 1b; checked by name against `campaign.ts`, `spec.ts` and `expert-helpers.ts`)

| Need                                                                    | Vocabulary                                                                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Five scenarios in order; a DEFEAT list; elimination                     | `graph.kind: "linear"`, `LossPolicy`, `EliminationPolicy`, `everyNodeVictory`                          |
| "before players draw their starting hands"; "After resolving mulligans" | `CampaignWindow` `beforeStartingHands`, `afterMulligans` (`setup-steps.ts`)                            |
| Persistent damage                                                       | `hpRecord`, `hpSet`, `defeatedSeatRecordsZero` (`expert-helpers.ts`), `remainingHitPointsCappedAtBase` |
| Counting cards in play as the game ends                                 | `CampaignGameQuery` `cardsInPlay`, `count`; `TargetQuery.hasCounter` / `missingCounter`                |
| A draw from what is left of nine cards                                  | `random`, `CampaignChoiceSource` `cards` and `excludingTitles`, `appendToList`, `clearField`           |
| Branches on the log between games                                       | `if`, `fieldContains`, `valueAtLeast`, `CampaignValue` `count`                                         |
| Cards and sets added to a scenario                                      | `setAsideCards` (with `copies`), `composeEncounterSets`                                                |
| The end of the campaign                                                 | `endCampaign`                                                                                          |
| A number of the log inside a game                                       | `ValueSpec campaignLog`, `CardSelector campaignLog`                                                    |
| Threat on Alert Level; lock and secret counters                         | §3.7 (a), `addCounters`, `removeCounters` (wave 9 tasks 2 and 3)                                       |

**New in `expert-helpers.ts`, with no engine change:** `healRecForSecret(id, citation)`: each player may place 1 secret
counter on a Board Member environment of their choice to heal damage from their identity equal to its REC, the REC of
the face in play (the alter-ego at setup). A seat recorded at 0 is asked to rejoin or to sit the scenario out, as
`healForThreat` asks (owner decision 2026-10-08, made for MC45; §4.1 Q14).

**To verify, each with a definition test** (shapes named above were found by grep, not read in full): `excludingTitles`
reading a hidden field without tracing it; `setAsideCards` naming cards of another scenario's sets (50109–50113 are
M.O.D.O.K. cards, used here in Baron Zemo); `composeEncounterSets` adding none to ten sets by `if`; `cardsInPlay`
counting a minion attached to Thunderbolt Backup and a player side scheme; a `record` and a `betweenGames` step in one
Victory list resolving in printed order. **Not checked on any scan this session:** whether Adaptoid 50113 or an Adaptoid
environment 50109–50112 names M.O.D.O.K., the Holding Cell deck or Upgrading Adaptoids in a way that does nothing in the
Baron Zemo scenario (§3.18 specified them for scenario 3). The `aos/campaign/carryover` agent reads the five scans
first.

## 4. Open questions (for the user or FFG)

### 4.1 Rules questions for the owner

Fourteen questions (6 and 7 are pass 2's, 8 to 10 pass 2c's, 11 to 14 pass 1b's). **Answered by the owner on 2026-10-09:
1B 2A 3A 4A 5A 6B 7A 8A 9A 10B 11B 12A 13B 14A.** Five differ from the recommended default A (1, 6, 10, 11, 13); wherever a §3
section, a test list or a §8 row below still describes A for one of those five, the Decision column here wins. The owner
marked 4, 6, 7, 8, 12 and 14 as provisional (not independently checked against the card wording), so their tests name
the question and are easy to flip. Nothing built before the answers (engine tasks 1 to 10, the modules scripted so far)
rests on any of the five. Under 1B a Board Member's secret counters are discarded when it flips to an attachment, so
anything that counts secret counters on a flipped Board Member (the rulebook's setup, stage 3B) counts none; under 11B
the next standard scenario's Setup puts it back as an environment with its recorded counters. None is settled
by a ruling: no FFG ruling in the repo names these cases, except that one ruling half-answers question 6 (§4.2). The
long form of each is in §4.2.

| Q   | Question                                                                                                     | A (default)                                                                                                                     | B                                                                                         | Cites                                                                                              | Decision                               |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | A Board Member flips from environment to attachment: what happens to its secret counters?                    | They stay on it (the rulebook's setup and stage 3B count them)                                                                  | They are discarded (the flip changes the card's type)                                     | RRG "Flip" p. 20 against MC50 pp. 11 and 19, card 50169b                                           | **B** (owner, 2026-10-09)              |
| 2   | Citizen V is stunned or confused and "would activate" against a player engaged with a Thunderbolt            | The status card resolves first: it is discarded, no heal                                                                        | His Forced Interrupt first: no activation, he heals, the status card stays                | MC50 p. 22 FAQ; RRG "'Would'" p. 48, "Stun" p. 41, "Activation" p. 6                               | **A** (owner, 2026-10-09)              |
| 3   | M.O.D.O.K. has "+5 hit points" attached when his hit points are "reset to 10"                                | As printed: set to 10, then the attachment is discarded and he drops to 5                                                       | The reset ends at his printed value: 10 after the attachment leaves                       | RRG "Hit Points" p. 22; cards 50103a, 50114                                                        | **A** (owner, 2026-10-09)              |
| 4   | "This attack" in a Preparation when the attack has several targets (Spray Fire on Black Widow)               | The whole attack: all its damage is prevented, or all of it resolves against the one minion                                     | Only the part aimed at Black Widow                                                        | MC50 p. 9; ruling January 17, 2026 – Ruling 2; cards 50073, 50076                                  | **A** (owner, 2026-10-09; provisional) |
| 5   | A card makes an enemy attack an ally: do "after [enemy] attacks you" abilities answer?                       | Yes, against the ally's controller (the later RRG text and the ruling)                                                          | No (the rulebook's bullet)                                                                | RRG "Attack" p. 8; ruling December 17, 2025 – Ruling 3; MC50 p. 4                                  | **A** (owner, 2026-10-09)              |
| 6   | Bird of Prey and Bird's-Eye View: "You may discard the top card" when it is faceup with no icons             | Not offered (the FAQ's reason for Redwing: the player knows it does nothing)                                                    | Offered: the card is discarded for 0 additional                                           | RRG FAQ p. 65; ruling January 26, 2026 – Ruling 6 (1); cards 53003, 53004                          | **B** (owner, 2026-10-09; provisional) |
| 7   | Hunting the Spider-Bride: is a cost, or the identity's four-card cap, "a player card effect"?                | Yes: any discard a player card causes, cost or effect, the cap included, deals the 2 damage                                     | No: only an effect; a cost (Cindy Moon's action) and the cap are free                     | RRG "Cost" p. 13; cards 52001a/b, 52009, 52031                                                     | **A** (owner, 2026-10-09; provisional) |
| 8   | A new Avatar's hit points after the Shatter swap, with Intense Focus or Total Focus attached                 | Printed value plus the attachment's bonus: the bonus is in effect on the Avatar it is attached to                               | Exactly the printed value: the card says "its printed hit point value"                    | Shatter the Illusion step 2; 55034a/b; RRG "Hit Points" p. 22; ruling February 28, 2026 – Ruling 3 | **A** (owner, 2026-10-09; provisional) |
| 9   | Worlds Collide reaches its target in Single Group Mode: when is the game lost?                               | By the insert: at once in the villain phase; in a player phase, at that phase's end unless Loki is defeated first               | By the card: at once, whenever                                                            | MC55 p. 21 against card 55028b                                                                     | **A** (owner, 2026-10-09)              |
| 10  | Loki's flip attaches Intense Focus in standard mode: does its "When Revealed: In standard mode, …" resolve?  | Yes: it is the only moment a standard game could ever resolve that text                                                         | No: the card is attached, not revealed, and only a reveal resolves a When Revealed        | Cards 55027b, 55034a, 55033a; RRG "When Revealed Abilities" p. 48; MC55 p. 7                       | **B** (owner, 2026-10-09)              |
| 11  | A Board Member flipped at 3 secrets in an expert-mode scenario; the next scenario is played in standard mode | It stays an attachment for the rest of the campaign: the log records the face with the number                                   | The Setup bullet as printed: 3 counters on the environment, below 4, no flip              | MC50 p. 6 against p. 11; RRG "Modes of Play" p. 28                                                 | **B** (owner, 2026-10-09)              |
| 12  | An evidence card's Setup: "search their collection for a different [aspect] [type]". Different from what?    | From that player's own cards: no title in their deck, hand, discard pile or play area                                           | From the other players' picks: any card of the kind, but no two players take the same one | Cards 50185–50193; MC50 p. 6                                                                       | **A** (owner, 2026-10-09; provisional) |
| 13  | When do the two shaded "Expert Campaign Only" Setup bullets resolve (set hit points; heal REC for a secret)? | Before starting hands, with every bullet that prints no timing of its own                                                       | In printed order: after mulligans and after the evidence cards' Setup abilities           | MC50 p. 4 against pp. 11, 13, 15, 19                                                               | **B** (owner, 2026-10-09)              |
| 14  | Expert campaign: a player defeated in a scenario the team won, at the next Setup                             | Recorded at 0. The printed bullet is the way back: 1 secret counter, heal REC, start at REC hit points; or sit the scenario out | Page 6's sentence: the bullet brings a defeated player back at full hit points            | MC50 p. 6 against pp. 11, 13, 15, 19; owner decision 2026-10-08 (MC45)                             | **A** (owner, 2026-10-09; provisional) |

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
8. **The hit points of the Avatar a Shatter swaps in, with Intense Focus or Total Focus attached.** (§3.60.) Step 2 of
   the rules card: "Swap the Fading Figment in play with a random set-aside villain, Avatar of Loki side faceup, then
   set the hit point dial of that Avatar of Loki villain to its printed hit point value." Intense Focus: "The Avatar of
   Loki villain gets +2 [per player] hit points" (Total Focus: +3). By ruling February 28, 2026 – Ruling 3 the
   attachment is on the new Avatar the moment it arrives. RRG "Hit Points" (p. 22): "When an ability that says an
   identity or villain 'gets +X hit points' goes into effect, increase that character's hit point dial by X." The bonus
   is not in effect on a Fading Figment (no Avatar of Loki trait) and is again on the new Avatar; the card then says
   "printed". No ruling speaks to the number. One player: 17 or 15; four players in expert after the flip: 72 or 60.
   - **A (default):** printed plus the bonus (no damage on the new Avatar, its maximum being 15 per player plus the
     attachment's). Otherwise the attachment's hit points would count once in the whole game, for the Avatar it was
     first attached to, and expert mode's Intense Focus would stop mattering after the first illusion.
   - B: exactly the printed value: the dial reads 15 per player, the Avatar arriving as if already damaged by the bonus.
9. **When the game is lost once Worlds Collide reaches its target, with one group.** (§3.66.) Card 55028b: "If this
   stage is completed, the players lose the game." MC55 p. 21, under "Rules for both modes": groups in a villain phase
   "finish any abilities currently resolving, then stop play immediately; each group in the middle of a player phase may
   finish that phase as normal. If Loki, God of Lies is defeated before all player phases in all groups end, all players
   in all groups win the game!" Threat reaches Worlds Collide in a player phase only when an identity would be defeated
   then (retaliate, a cost, an encounter card revealed by a player card).
   - **A (default):** the insert: at once in the villain phase; in a player phase the players finish it and win if Loki
     is defeated in it. The page is headed for both modes and is the later, longer text.
   - B: the card: the loss is immediate in any phase; the insert's last player phase is read as Epic's way of letting
     groups finish, with nothing to finish at one table.
10. **Intense Focus's When Revealed in standard mode.** (§3.63, §3.66.) Intense Focus 55034a: "When Revealed: In
    standard mode, discard the top 2 [per player] cards of the encounter deck and the top 5 cards of each player deck."
    In standard mode the card is set aside at setup and enters play only by Loki, God of Lies 55027b: "Each group in
    standard mode attaches their set-aside Intense Focus to the Avatar of Loki villain in their game area." RRG "When
    Revealed Abilities" (p. 48) resolves them when a card is revealed; attaching is not revealing. The pack's own
    Enchantments say a flip does resolve one (MC55 p. 7), and ruling June 25, 2026 – Ruling 5 takes Total Focus's as
    resolving on its flip; neither names this case.

- **A (default):** it resolves when Loki's When Revealed attaches it. The clause "In standard mode" exists for this
  moment and no other: in expert mode the card is attached at setup, and its other face carries expert mode's version
  of the same sentence.
- B: it does not; in standard mode the flip only adds the attachment's stats.

11. **A Board Member's face when the mode changes between scenarios.** (§3.74.) MC50 p. 6: "If a board member ever has
    four secrets on it (three in expert mode), that board member permanently turns against the heroes" and "once a board
    member flips to its attachment side, it remains an attachment for the rest of the campaign". MC50 p. 11 carries that
    out only through a count: "Place secret counters on each Board Member environment equal to the number of secret
    counters recorded … (This will cause the environment to flip to its attachment side if enough secrets are placed on
    it.)" The players choose standard or expert mode for each scenario of a campaign (RRG "Modes of Play", p. 28). A
    member that flipped at 3 in an expert-mode scenario and is recorded at 3 would not flip again in a standard-mode
    scenario, where the threshold is 4.
    - **A (default):** it stays an attachment (p. 6's bold sentence is the rule; p. 11's parenthesis describes the usual
      case). The log records each member's face beside its number.
    - B: the bullet as printed: it returns as an environment holding 3, one secret from flipping again.
12. **"A different" card in an evidence card's Setup.** (§3.77.) All nine cards (scans): "Each player may add 1 secret
    counter to a Board Member environment to search their collection for a different [aspect] [ally, upgrade or support]
    and shuffle it into their deck." Nothing on the card or in the rulebook says what the card must differ from.
    - **A (default):** from the player's own cards: a card of a title their deck does not already hold. The second
      sentence of the same ability searches "their deck" for a card of the same kind, and the two read as a pair: one
      fetches a card you built in, the other brings one you did not.
    - B: from the other players' choices: each player who pays takes a card no other player took with this ability; a
      copy of a card already in their own deck is allowed.
13. **The timing of the two Expert Campaign Only Setup bullets.** (§3.73, §3.78.) MC50 p. 4: "**before players draw
    their starting hands**, follow that scenario's setup instructions in the order they are listed". On pp. 11, 13, 15
    and 19 the list's last unshaded bullet begins "**After resolving mulligans,**", and the two shaded expert bullets
    are printed under it. If the list's order is binding, they resolve after mulligans; if p. 4's timing is, they
    resolve before the hands are drawn and only the one bullet that says otherwise waits. What changes: whether a player
    sees their opening hand, and what the evidence cards did to the board members, before deciding to pay a secret
    counter for the heal.
    - **A (default):** before starting hands. Only one bullet prints its own timing; the shaded box is at the foot of
      the list on every page of this box and of MC45, wherever its bullets fall in time; and every earlier box sets hit
      points at that point.
    - B: in printed order, after mulligans and after the evidence cards' Setup abilities.
14. **A defeated player's return in an expert campaign.** (§3.73, §3.78.) MC50 p. 6: "the defeated player can rejoin
    their teammates for the next scenario by following that scenario's Setup instructions for healing their identity to
    its full hit points", and "The Setup instructions for each scenario offer each player the opportunity to restore
    their identity to their full hit point value at a cost specific to that scenario." No Setup list prints such an
    instruction. Each prints the same one: "Each player may place one secret counter on a Board Member environment to
    heal damage from their identity equal to their REC" (pp. 11, 13, 15, 19). Page 6 reads like the paragraph of an
    earlier box (MC45 p. 20 has it with a heal to full).
    - **A (default):** the printed bullet. A defeated player took no part in the Victory steps and is recorded at 0. At
      the next Setup they may place the secret counter and start with hit points equal to their REC, or decline and sit
      that scenario out, to be asked again at the next (the owner's decision of 2026-10-08 for the same sentence in
      MC45).
    - B: p. 6: a defeated player who places the secret counter returns at full hit points; an undefeated player who
      places it heals REC.

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
- (Pass 2c) A linked ally whose minion is defeated with no defeating player (an encounter card's damage) goes to a
  player the first player chooses, by MC55 p. 23's rule for an act no player is named for (§3.57).
- (Pass 2c) Hypnotic Gaze's flip reveals the Trance, though the card says only "flip this card": MC55 p. 7 says to
  "trigger its 'When Revealed' ability as normal" (§3.54). Total Focus's flip is revealed the same way, as ruling June
  25, 2026 – Ruling 5 presupposes.
- (Pass 2c) Trait conditions of a "choose one / do both" card are read once, before any option resolves, by ruling
  February 28, 2026 – Ruling 5 (1) (§3.56).
- (Pass 2c) An Avatar's replaced defeat is not a defeat: excess damage is lost and "after the villain is defeated"
  abilities do not resolve (§3.60). The same for an identity under Mischief and Mayhem (§3.62).
- (Pass 2c) The Avatar pool of a swap is the three set-aside cards; the outgoing card cannot be drawn by the swap that
  removes it (§3.60).
- (Pass 2c) A choice of "one of their Synergy environments" may name a full one, placing nothing (§3.61).
- (Pass 2c) The per group and per player counts are those that began the scenario (the Reminder card; RRG p. 32 for the
  per player icon), though MC55 p. 4 says "the number of groups in the respective pod" without "began". One group either
  way; the multiplayer phase's question (plan Q-B).
- (Pass 2c) Loki's flip and a Worlds Collide completion are applied when the resolution in progress has finished, not in
  the middle of it (MC55 pp. 20, 21), in Single Group Mode too (§3.66).
- (Pass 1b) The S.H.I.E.L.D. envelope is not stored as a shuffled pile: a gain draws at random from the cards that are
  in neither the A.I.M. envelope nor the players' hands. The distribution is the paper game's (§3.73).
- (Pass 1b) A retry of scenario 1 keeps the envelope it dealt the first time. Nothing of it was seen, so the players
  cannot tell, and the log is restored as for any free retry (§3.73).
- (Pass 1b) Scenario 1's "minions and side schemes in play" counts player side schemes (RRG "Player Side Scheme", p. 34)
  and every minion in play, engaged or not (§3.73).
- (Pass 1b) A card an evidence Setup ability brings from the collection is in that game only. It is shuffled into a deck
  after mulligans of one game, the ability is paid for again in the next, and nothing says "for the rest of the
  campaign" (§3.77).
- (Pass 1b) Earned evidence cards resolve in the order gained, and each card's two offers go to the players in player
  order (§3.77).
- (Pass 1b) Secret counters placed by a Setup bullet are placed on the environment, so a member that flips from them
  does not answer its own Forced Response (§3.74).
- (Pass 1b) "Surviving Thunderbolts": Jolt, if recorded, is shuffled in alone; her set is the Thunderbolts scenario set,
  which the sentence leaves out. The recorded Elite minions are in the encounter deck with their sets, not set aside
  (§3.73).
- (Pass 1b) On a standard-campaign loss of scenario 5, "each scenario in which you had at least one Board Member
  environment with no secret counters" is the number of evidence cards held when scenario 5 began (§3.73).
- (Pass 1b) "Their REC" is the REC printed on the face in play at setup, the alter-ego (§3.78).

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

### 5.2 Pass 2c (Trickster Takeover)

- **`card-data-pipeline`:** §8.1 items 18 to 27: the God of Lies scenario record, three text and value corrections read
  on scans, `definedCounterTypes`, the counter maximum, the linked keyword's card type, `neutralCards` and
  `referenceCards`.
- **`ability-scripting-engineer`:** §8.4 lines 64 to 72. **Every God of Lies script uses §3.66's `sharedEvent` and
  §3.67's `chooseGroup`, `inGroup` and `groupPlayerCount`**, never a direct change to a neutral card and never "the
  table" where the card says "group". Copy the card's own word where the pack separates two things: "would be defeated …
  instead" and defeated (§3.60, §3.62), "the Enchantment card in your play area" and "each Enchantment card in play",
  "place 1 charm counter" and "would be placed" (§3.55), "the Avatar of Loki villain" and "Loki, God of Lies", "the main
  scheme" and "Worlds Collide".
- **`encounter-ai-designer`:** nothing new for the villain's activations. The first player's choices this pack adds: who
  is dealt what in a Shatter, which Synergy environment takes The Mangog's counter, who takes a linked ally with no
  defeating player. The Avatars' boost flow is the ordinary one; Loki, God of Lies never activates (dashes).
- **`rules-qa-engineer`:** a ruling test each for February 28, 2026 – Rulings 3 and 5 (both answers), March 19, 2026 –
  Ruling 2, June 25, 2026 – Ruling 5; the RRG p. 70 erratum; the five FAQ answers of MC55 pp. 22–23; the three questions
  at their defaults, written so a B answer changes one number each.
- **`multiplayer-netcode-engineer`:** §3.64–§3.69 replace the shapes in `docs/epic-multiplayer-plan.md` §3 items 1 to 6
  and 10; the "corrections" paragraphs say what moved and why. The seat rule for `externalEvent`, the coordinator, group
  status and cross-area attacks stay in that plan.
- **`game-client-engineer`:** new things a player must see: charm counters and the hidden reverse of a Hypnotic Gaze (no
  Inspect of the Trance before it flips); Defiant and Enthralled on the identity; an outstanding Forced Action and why
  End turn is refused; the neutral area with Loki's hit points and Worlds Collide's threat; shatter counters on the
  Avatar; the four Synergy environments with their counters and maximum; the Shatter the Illusion card in Inspect; a
  "last player phase" banner under Q9's default. Guided mode: Forced Action, charm counters, shattering an illusion,
  synergy counters (`docs/wave-definition-of-done.md` §5).
- **`content-release-tracker`:** the RRG p. 70 erratum rewrites a page of the insert, not a card: file it against the
  scenario.

### 5.3 Pass 1b (the campaign)

- **`card-data-pipeline`:** §8.1 items 28 to 33: `AOS_CAMPAIGN`, the evidence icons and colors, the 27-row grid with its
  checksum test, the two counter names, the Thunderbolt minion to set map.
- **`ability-scripting-engineer`:** §8.4 lines 73 to 78. The evidence Setup abilities are effect lists an instruction
  resolves, not triggers. The three campaign clauses of Zemo's Manipulations are branches on `inCampaign` inside pass
  1a's scripts. Copy the cards' words: "Board Member **environment**" (the costs, the gain condition, the heal) against
  "Board Member **card**" (what Victory records).
- **`encounter-ai-designer`:** the automated player's answers to the new offers: the two offers of each evidence card,
  the expert heal and the rejoin, and in the campaign's scenario 5 when to gain (1 card a use, 2 secret counters each)
  against when to accuse.
- **`rules-qa-engineer`:** §8.4 lines 79 to 81. The four questions at their defaults, each written so a B answer changes
  one assertion. The hidden-evidence test reads every surface a client can reach, not one view.
- **`game-client-engineer`:** §8.5.
- **`multiplayer-netcode-engineer`:** the A.I.M. envelope is the first campaign value no client may be sent. In local
  play it sits in the save (design Q4); with an authoritative host it stays on the host until the accusation.
- **`content-release-tracker`:** MC50 p. 6's two sentences about healing "to full" disagree with every Setup list (Q14):
  file it as a rulebook inconsistency to watch for an erratum.

## 6. Later passes (placeholders)

Sections 6.1 to 6.6 are written and point to their sections.

### 6.1 Pass 1b: the MC50 campaign

**Written (2026-10-09).** Sources §0.3; the record, the evidence icons and the grid §1.16; the rules §2.9; the
definition and its four engine gaps §3.73–§3.78; questions 11 to 14 (§4.1); the other agents §5.3; the cards §7.16; the
build order §8.1 items 28–33, §8.2 tasks 51–56, §8.4 lines 73–81 and §8.5.

### 6.2 Pass 2a: Black Panther (`bp`)

**Written.** §3.36–§3.38, §3.43 (a), §3.51, §3.52; cards in §7.9; modules in §8.4 lines 32 to 38.

### 6.3 Pass 2a: Silk (`silk`)

**Written.** §3.39–§3.41, §3.51, §3.52; question 7; cards in §7.10; modules in §8.4 lines 39 to 45.

### 6.4 Pass 2b: Falcon (`falcon`)

**Written.** §3.42–§3.49, §3.51, §3.52; question 6; cards in §7.11; modules in §8.4 lines 46 to 53.

### 6.5 Pass 2b: Winter Soldier (`winter`)

**Written.** §3.50–§3.52; cards in §7.12; modules in §8.4 lines 54 to 63.

### 6.6 Pass 2c: Trickster Takeover (`tt`)

**Written.** §0.2, §1.15, §2.8, §3.53–§3.72; questions 8 to 10; cards in §7.13–§7.15; data in §8.1 items 18 to 27;
engine tasks 37 to 50; modules in §8.4 lines 64 to 72. Loki, God of Lies is specified for Single Group Mode; Epic
Multiplayer Mode is the multiplayer phase's (`docs/epic-multiplayer-plan.md`), with its groundwork in §3.64–§3.69.

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

### 7.13 Trickster Takeover (`tt`): Enchantress

Every row checked on a scan (§0.2).

| Id            | Title                    | Type        | Verdict                                                                                |
| ------------- | ------------------------ | ----------- | -------------------------------------------------------------------------------------- |
| 55001         | Enchantress (I)          | villain     | DSL ("after … attacks you"; the counter goes through §3.55)                            |
| 55002         | Enchantress (II)         | villain     | DSL (`inMode` standard, set-aside scheme into play, 3 per player more); §3.55          |
| 55003         | Enchantress (III)        | villain     | DSL (4 per player more); §3.55                                                         |
| 55004a        | Prime Real Estate 1A     | main scheme | §3.54 (random Hypnotic Gaze per identity, hidden reverse)                              |
| 55004b        | Prime Real Estate 1B     | main scheme | §3.55                                                                                  |
| 55005a        | Sovereign Sorceress 2A   | main scheme | DSL (stun each identity, or search deck and discard pile and reveal)                   |
| 55005b        | Sovereign Sorceress 2B   | main scheme | §3.55; completion loses (data)                                                         |
| 55006         | Future of Despair        | side scheme | DSL (`cannotTakeDamage`, stalwart grant; counter on each Enchantment); §3.70           |
| 55007a–55011a | Hypnotic Gaze            | attachment  | §3.54                                                                                  |
| 55007b        | Trance of Envy           | attachment  | §3.53, §3.54; DSL (`giveBoostCard`, ready)                                             |
| 55008b        | Trance of Greed          | attachment  | §3.53, §3.54; DSL (§3.71, a drawn card played)                                         |
| 55009b        | Trance of Pride          | attachment  | §3.53, §3.54; DSL                                                                      |
| 55010b        | Trance of Sloth          | attachment  | §3.53, §3.54; DSL (heal the villain)                                                   |
| 55011b        | Trance of Wrath          | attachment  | §3.53, §3.54; DSL (search the top 5 encounter cards and reveal one)                    |
| 55012         | Alluring Call            | attachment  | §3.53; DSL (§3.71, a card played 1 cheaper; boost reveals itself)                      |
| 55013         | Kiss of Temptation       | attachment  | §3.53; DSL                                                                             |
| 55014         | Love Concoction          | attachment  | §3.53; DSL                                                                             |
| 55015         | Seduced                  | attachment  | §3.72; DSL (`cannotPlay` Attack events)                                                |
| 55016         | Crown of the Enchantress | attachment  | §3.58; DSL (stalwart in expert mode; "schemes against you")                            |
| 55017         | Enthralled Lackey        | minion      | DSL (boost: `chooseOne`, counter or confuse); §3.55                                    |
| 55018         | Enthralled Brute         | minion      | DSL (+3 hit points by the engaged player's trait); §3.55                               |
| 55019         | Sindr                    | minion      | DSL (§3.71, indirect attacks; activates or takes a tough card by trait)                |
| 55020         | Ulik                     | minion      | DSL (toughness in expert mode; attacks the damaging player; the villain attacks at +1) |
| 55021         | Law of Attraction        | side scheme | DSL (`discardEncounterUntil` an Enthralled minion, reveal it)                          |
| 55022         | Spellbound               | side scheme | DSL, as a **When Defeated** (§1.15 item 1); §3.55                                      |
| 55023         | "Do My Bidding"          | treachery   | §3.56                                                                                  |
| 55024         | Magical Restraints       | treachery   | §3.56; §3.55                                                                           |
| 55025         | Spell Blast              | treachery   | §3.56; §3.70                                                                           |
| 55026         | Spell Shards             | treachery   | DSL (indirect damage; "if your identity took any" by `eventResult`); §3.55             |

### 7.14 Trickster Takeover (`tt`): God of Lies

Every row checked on a scan (§0.2). Every script here is written on §3.64–§3.67 (§8.4).

| Id            | Title                  | Type        | Verdict                                                                         |
| ------------- | ---------------------- | ----------- | ------------------------------------------------------------------------------- |
| 55027a        | Loki, God of Lies (1)  | villain     | §3.59, §3.66 (the flip is the reducer's)                                        |
| 55027b        | Loki, God of Lies (2)  | villain     | §3.66, §3.67; Q10                                                               |
| 55028a        | Worlds Collide A       | main scheme | §3.59 (Setup first)                                                             |
| 55028b        | Worlds Collide B       | main scheme | §3.59, §3.65, §3.66; Q9                                                         |
| 55029a        | Loki the Rascal        | villain     | §3.60; DSL (§3.71, a treachery boost card dealt or 1 resource)                  |
| 55030a        | Loki the Miscreant     | villain     | §3.60; DSL (§3.71, after a treachery)                                           |
| 55031a        | Loki the Knave         | villain     | §3.60; DSL (§3.71)                                                              |
| 55032a        | Loki the Wretch        | villain     | §3.60; DSL (§3.71, "for this activation")                                       |
| 55029b–55032b | Fading Figment         | villain     | §3.60, §3.61, §3.66, §3.67; Q8                                                  |
| 55033a        | Mischief and Mayhem 1A | main scheme | §3.59 (`addVillain` at random by trait; environments; Intense Focus by mode)    |
| 55033b        | Mischief and Mayhem 1B | main scheme | §3.62, §3.66                                                                    |
| 55034a        | Intense Focus          | attachment  | DSL (hit points per player, steady); Q8, Q10                                    |
| 55034b        | Total Focus            | attachment  | §3.63; Q8                                                                       |
| 55035         | Wrapped in Chains      | attachment  | DSL (§3.71, `cannotReady`, two resources of one type; 1 shatter counter)        |
| 55036         | Dark Scepter           | attachment  | DSL (§3.71, `cannotBeCanceled`); §3.63                                          |
| 55037         | Draugr Buddy           | minion      | DSL (§3.71, dealt to its defeater: prove)                                       |
| 55038         | Grendell               | minion      | DSL (§3.71, treacheries among 3 discarded)                                      |
| 55039         | Malekith               | minion      | DSL (§3.71)                                                                     |
| 55040         | Minotaur               | minion      | DSL (a count of treacheries in the discard pile)                                |
| 55041         | The Mangog             | minion      | §3.65, §3.67, §3.61                                                             |
| 55042         | Fenris Wolf            | minion      | §3.67, §3.61; patrol (§3.70)                                                    |
| 55043         | Hraesvelgr             | minion      | §3.67, §3.61; DSL                                                               |
| 55044         | Laufey                 | minion      | §3.67, §3.61; DSL ("stun the attacker")                                         |
| 55045         | Aura of Stasis         | side scheme | DSL (2 cards, 3 in expert mode)                                                 |
| 55046         | Door Between Worlds    | side scheme | §3.65, §3.67, §3.61                                                             |
| 55047         | Lofty Goals            | side scheme | DSL (2 shatter counters; boost by characters controlled)                        |
| 55048         | New Jotunheim          | side scheme | §3.67, §3.61                                                                    |
| 55049         | Dark Arts              | treachery   | DSL (§3.71, incite in expert mode; a minion from the discard pile, "otherwise") |
| 55050         | Dirty Trick            | treachery   | DSL (remove 1 shatter counter; 2 damage, 3 in expert mode)                      |
| 55051         | Stories and Lies       | treachery   | §3.60 (swap by trait, dial kept); DSL (`faceNamed`, scheme or attack)           |
| 55052         | Domineering Force      | environment | §3.61; DSL (§3.71, an interrupt nobody controls)                                |
| 55053         | Feigned Retreat        | environment | §3.61; DSL (§3.71)                                                              |
| 55054         | Mounting Resistance    | environment | §3.61; DSL (§3.71)                                                              |
| 55055         | Unified Front          | environment | §3.61; DSL (§3.71, a resource ability for any player)                           |

### 7.15 Trickster Takeover (`tt`): Trickster Magic and its four allies

Every row checked on a scan (§0.2).

| Id    | Title               | Type        | Verdict                                                               |
| ----- | ------------------- | ----------- | --------------------------------------------------------------------- |
| 55056 | Absorbing Man       | minion      | §3.57; DSL (§3.71, the highest printed cost you control)              |
| 55057 | Titania             | minion      | §3.57; DSL (`attackKeywords` overkill; steady)                        |
| 55058 | Whirlwind           | minion      | §3.57; DSL (1 indirect damage per side scheme)                        |
| 55059 | Zzzax               | minion      | §3.57; DSL (§3.71, energy resources among 4 discarded)                |
| 55060 | The Trickster Tango | side scheme | DSL (stalwart grant to the villain; boost: overkill for this attack)  |
| 55061 | Puppet Master       | side scheme | DSL (§3.71, hinder by mode; allies barred from it and from defending) |
| 55062 | Love Triangle       | attachment  | DSL (§3.71, surge "otherwise"; the ally barred from the villain)      |
| 55063 | Absorbing Man       | ally        | §3.57; DSL (§3.71, +X to a maximum of 3)                              |
| 55064 | Titania             | ally        | §3.57; DSL (`attackKeywords` overkill and piercing)                   |
| 55065 | Whirlwind           | ally        | §3.57; DSL (§3.71, threat removed as ATK); §3.70                      |
| 55066 | Zzzax               | ally        | §3.57; DSL (search the top 5 for a printed energy resource)           |

### 7.16 The campaign (pass 1b)

**No record of the box is a campaign-specific card** (§1.16 item 1), so no card is gated to campaign mode. What the
campaign adds is the text below, on cards pass 1a already lists (§7.5–§7.8). "Compose" is existing vocabulary (§3.78).

| Id                | Title                              | What the campaign reads or adds                                                               | Verdict                                 |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| 50185             | Medical Records                    | Setup: Protection ally (collection, then deck)                                                | §3.77                                   |
| 50186             | Wiretap                            | Setup: Justice ally                                                                           | §3.77                                   |
| 50187             | Security Scanner                   | Setup: Aggression ally                                                                        | §3.77                                   |
| 50188             | Money                              | Setup: Protection upgrade                                                                     | §3.77                                   |
| 50189             | Blackmail                          | Setup: Justice upgrade                                                                        | §3.77                                   |
| 50190             | Ideology                           | Setup: Aggression upgrade                                                                     | §3.77                                   |
| 50191             | Security Clearance                 | Setup: Protection support                                                                     | §3.77                                   |
| 50192             | Travel                             | Setup: Justice support                                                                        | §3.77                                   |
| 50193             | Authority                          | Setup: Aggression support                                                                     | §3.77                                   |
| 50185–50193       | (all nine)                         | Dealt once for the campaign; one hidden kind each; gained at a Victory                        | §3.75, §3.73                            |
| 50167a            | Zemo's Manipulations 1A            | "Prepare the evidence": from the log; "If not playing campaign mode, place 2 secret counters" | §3.75 (`inCampaign`, `seedHiddenPiles`) |
| 50167b            | Zemo's Manipulations 1B            | "(1 card instead in campaign mode)"                                                           | §3.75 (`inCampaign`)                    |
| 50181a/b–50183a/b | The three Board Members            | In play in scenarios 1 to 4; counters and face recorded and restored                          | §3.74; Q1, Q11                          |
| 50184a–c          | A.I.M. Interference                | Shuffled into the encounter deck of scenarios 1 to 4                                          | compose                                 |
| 50090a            | Alert Level                        | Threat from scenario 1's record                                                               | compose (§3.7 (a), §3.16)               |
| 50091             | Rescued Captive                    | Counted in play at scenario 2's Victory                                                       | compose                                 |
| 50105a–50108a     | Holding Cell                       | Lock counters from scenario 2's record                                                        | compose (§3.17)                         |
| 50109–50112       | The four Adaptoid environments     | Marked at scenario 3's Victory; in play in scenario 5                                         | compose; scans to read first (§3.78)    |
| 50113             | Adaptoid                           | Four copies in scenario 5's encounter deck                                                    | compose; scan to read first (§3.78)     |
| (derived)         | Thunderbolt minions and their sets | Recorded at scenario 4's Victory; in scenario 5's encounter deck                              | compose (§1.16 item 5)                  |
| 50133             | Jolt                               | Recorded like the others; shuffled in without her set                                         | compose                                 |

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
18. (Pass 2c) **The God of Lies scenario record** (§1.15): `villainCardId: 55029a`,
    `setAsideVillainCardIds: [55030a, 55031a, 55032a]`, `startingVillain: "bySetup"`, the new
    `neutralCards: { villainCardId: 55027a, mainSchemeCardId: 55028a }`, Worlds Collide out of `setAsideCardIds`; the
    two Setup abilities listed Worlds Collide (A) first. Blocks the `god-of-lies` module and engine task 46.
19. (Pass 2c) Spellbound 55022: "When Defeated" (scan), ability id `55022.when-defeated`. Wrapped in Chains 55035:
    `textReplace` "identiy" → "identity".
20. (Pass 2c) The four Fading Figments: `infiniteHp: true`, `hp: { base: 0, perPlayer: 0 }` (scan: ∞).
21. (Pass 2c) `definedCounterTypes`: `charm` (55007a–55011a, both faces), `shatter` (55029a–55032a, both faces),
    `synergy` (55052–55055). With item 3.
22. (Pass 2c) `counterLimit` on 55052–55055 (§1.15 item 5). Lands with engine task 43.
23. (Pass 2c) The linked keyword on 55063–55066 as a title and a card type (§1.15 item 6). Lands with engine task 40.
24. (Pass 2c) `Scenario.referenceCards` with the two rules cards and their images out of
    `docs/campaign-modes/mc55-reference-cards/` (§1.15 item 9).
25. (Pass 2c) The curation file's two `UNVERIFIED` Expert set notes replaced by RRG "Modes of Play" (p. 28), and its
    notes on 55029b–55032b ("its steps are NOT in the data") by the transcription in the handoff.
26. (Pass 2c) Crown of the Enchantress 55016's star in its SCH box with no SCH modifier; Future of Despair set aside for
    the Enchantress record if the builder wants it listed (§1.15).
27. (Pass 2c) The scenario builders confirmed to set aside an encounter set's permanent cards by keyword (Hypnotic Gaze
    × 5, Intense Focus, the four Synergy environments), and Trickster Magic's allies when the set is in the game.
28. (Pass 1b) **`packages/content/src/data/aos/campaign.ts`**, hand-authored: `AOS_CAMPAIGN` (§1.16 item 1), exported
    from the pack's index and registered in `CAMPAIGNS`. `campaignSetIds` stays empty. Blocks §8.4 line 77.
29. (Pass 1b) `evidenceIcon` and `evidenceColor` on 50185–50193 from §1.16 item 2's table (checked on the nine scans).
    This is the icon half of item 1.
30. (Pass 1b) `AOS_EVIDENCE_COMBINATIONS` from §1.16 item 3's 27 rows, with the test it describes (27 different triples,
    nine a member, the 5-1-3 pattern by card). This is the grid half of item 1 and unblocks engine task 20.
31. (Pass 1b) `definedCounterTypes`: `secret` on 50181a/b–50183a/b and `lock` on 50105a–50108a, in those spellings
    (§1.16 item 4). With item 3.
32. (Pass 1b) The Thunderbolt minion to encounter set map as a derived export with its test (§1.16 item 5).
33. (Pass 1b) A scan check that no `aos` record prints "Campaign" in its set name area (the nine evidence cards were
    checked this pass; 50181a–50184c were not). If one does, report it: `campaignSetIds` and §7.16's first sentence
    change.

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
**Pass 2c adds tasks 37 to 50**: one for each of the 6 **new** rows and the 8 **extend** rows of §3.53–§3.72. Tasks 44
to 49 are the Epic groundwork, in dependency order; each is one of the plan's "build now" items and lands with its own
tests in Single Group Mode (multiplier 1) and, where the row says "hand-built", a test on a state built in the test with
two groups or a remote coordinator. None of their identifiers (`forced` on an action, `outstandingForcedActions`,
`reverseHidden`, `otherFaceVisible`, `randomSetAside`, `countersBeingPlaced`, `eachPlayer` as a cost, `setAsideTrait`,
`counterLimit`, `GroupId`, `PodState`, `podOf`, `scaleIn`, `SharedPodState`, `applySharedEvent`, `sharedEvent`,
`sharedEventEmitted`, `chooseGroup`, `inGroup`, `groupPlayerCount`, `reachableFromPod`, `externalEvent`,
`PodInboundEvent`, `groupSeed`) exists in the engine or the DSL (grep, this session). They depend on none of tasks 1 to
36 except task 2 (§3.6's counter types, for 39 and 43).

**Pass 1b adds tasks 51 to 56**: the campaign foundation's four gaps (§3.74–§3.77), two of them split in two. None of
`cardStateOf`, `sealed`, `seedHiddenPiles`, `inCampaign`, `evidenceRowsLeft` or `notAmongOwnCards` exists in the engine
or the DSL (grep, this session). Tasks 51 to 53 and 55 touch only `campaign.ts` and `campaign/`, so they can run beside
the scenario tasks.

File paths are under `packages/engine/src/` unless they start with `dsl/` (`packages/cards/src/dsl/`) or `schema/`
(`packages/content/src/schema/`). Every task adds its own colocated test file with the row's exact-number tests.
**Decisions:** a §4.1 question the task builds on at default A until answered.

| #   | §                   | Change                                                                                                                                        | Files                                                                                                                                 | Decisions | Unblocks                                         |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------ |
| 1   | 3.1                 | Vulnerable in `giveStatus`: discard, not defeat; steady; ahead of simultaneous damage; log `vulnerableDiscarded`                              | `effects.ts`, `keywords.ts`, `resolve/effects-frame.ts`, `events.ts`                                                                  | none      | eight minions in six sets                        |
| 2   | 3.6 (a)             | `definedCounterType`; `counterType: "allPurpose"` lands as the destination's type; `counterType: "any"` on removal, values and queries        | `schema/cards/base.ts`, `spec.ts`, `select.ts`, `effects.ts`, `resolve/apply-effect.ts`, `choices.ts`                                 | none      | Maria Hill's kit and nemesis set; Adaptoid 50113 |
| 3   | 3.6 (b) (after 2)   | `moveCounters.amount`; arriving counters retyped; `countersPlaced` on the destination; a uses card emptied by a move is discarded             | `spec.ts`, `effects.ts`, `resolve/apply-effect.ts`, `resolve/state-checks.ts`, `dsl/effects.ts`                                       | none      | Maria Hill 50001a                                |
| 4   | 3.7 (a)             | `placeThreat` / `removeThreat` / `moveThreat` on a card that is not a scheme: tokens only, no scheme checks                                   | `resolve/apply-effect.ts`, `resolve/target-validity.ts`, `select.ts`, `dsl/effects.ts`                                                | none      | Nick Fury's kit; Alert Level                     |
| 5   | 3.7 (b) (after 4)   | `AbilityCost removeThreat { from, amount or choose }`, the paid amount bound                                                                  | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `dsl/abilities.ts`, `dsl/validate.ts`                                         | none      | 50035a, 50040, 50044, 50045                      |
| 6   | 3.11                | `chooseCards.maxTotal { of: "printedCost", atMost }`                                                                                          | `spec.ts`, `choices.ts`, `resolve/effects-frame.ts`, `dsl/effects.ts`                                                                 | none      | 50004, 50005                                     |
| 7   | 3.9 (after 4)       | `enemyScheme.divert { amount, to, if }` read at the place-threat step; the replaced attack deals no boost card                                | `spec.ts`, `resolve/apply-effect.ts`, `resolve/enemy-activation.ts`, `dsl/effects.ts`                                                 | none      | Stealth 50035b                                   |
| 8   | 3.12                | `lookAt` over dealt cards and the deck top; the `rearrange` choice; views for the acting player only                                          | `spec.ts`, `choices.ts`, `visibility.ts`, `resolve/apply-effect.ts`, `events.ts`                                                      | none      | Intelligence 50051                               |
| 9   | 3.2                 | The `preparation` trigger kind; `resolveSpecials.which: "preparation"` on a card in the discard pile; the count on the attack                 | `abilities.ts`, `spec.ts`, `resolve/effects-frame.ts`, `resolve/enemy-activation.ts`, `dsl/abilities.ts`                              | none      | the Black Widow set                              |
| 10  | 3.3 (after 9)       | `RuleSpec grantsLabeledAbility`; granted abilities joined to the printed ones, the granting card as the named card                            | `abilities.ts`, `rules.ts`, `resolve/effects-frame.ts`, `dsl/abilities.ts`                                                            | none      | 50070, 50074                                     |
| 11  | 3.4 (after 9)       | `modifyAttack.preventAll` with `bind` for a player attack; `Predicate attackResolvedLabeled`; `retargetAttack` onto a minion proved           | `spec.ts`, `select.ts`, `resolve/apply-effect.ts`, `resolve/attack-ability.ts`, `dsl/effects.ts`, `dsl/values.ts`                     | Q4 = A    | 50064–50066, 50068, 50073, 50076                 |
| 12  | 3.20                | `replaceLeaveDestination { to: { tuckedUnder } }` from an interrupt to `cardLeavesPlay`                                                       | `spec.ts`, `resolve/cards.ts`, `resolve/defeat.ts`, `resolve/apply-effect.ts`                                                         | none      | A.I.M. Abduction                                 |
| 13  | 3.17                | `ScenarioSeparateDeck.topCardInPlay`: the top card in play, the next entering play, a card put under an empty deck entering play              | `state.ts`, `resolve/separate-decks.ts`, `resolve/setup-cards.ts`, `resolve/other-face.ts`, `schema/sets.ts`                          | none      | the M.O.D.O.K. set                               |
| 14  | 3.21                | A minion held by an environment (`attach … as: "heldMinion"`): in play, engaged with nobody, attackable by all, detached by `engage`          | `attachment-hosts.ts`, `resolve/attach.ts`, `resolve/apply-effect.ts`, `select.ts`, `legal.ts`                                        | none      | the Thunderbolts set                             |
| 15  | 3.24                | `EffectSpec rotateEngagement`                                                                                                                 | `spec.ts`, `resolve/apply-effect.ts`, `events.ts`, `dsl/effects.ts`                                                                   | none      | 50135, 50136, 50164                              |
| 16  | 3.33                | `TriggerEvent statusBeingGiven` and `on.wouldGainStatus`, opened only when an ability listens                                                 | `effects.ts`, `trigger-events.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                                                          | none      | Solid Sound Constructs 50144                     |
| 17  | 3.27                | `divide` over counters (remove); `superlative` by counters                                                                                    | `spec.ts`, `choices.ts`, `resolve/effects-frame.ts`, `select.ts`                                                                      | none      | the Baron Zemo set; the Executive Board set      |
| 18  | 3.26 (after 17)     | A flip that changes the card type, attaches to the villain and keeps its counters                                                             | `resolve/other-face.ts`, `resolve/attach.ts`, `spec.ts`, `dsl/effects.ts`                                                             | Q1 = B    | 50181a/b–50183a/b                                |
| 19  | 3.29 (a)            | `GameState.hiddenPiles` and `revealedPileCards`; `dealHiddenPiles`; `gainFromHiddenPile`; never in a view                                     | `state.ts`, `spec.ts`, `visibility.ts`, `resolve/apply-effect.ts`, `events.ts`                                                        | none      | 50167a/b                                         |
| 20  | 3.29 (b) (after 19) | `EffectSpec accuse` over the scenario's grid; `accused`, `mole`, `wrongGuesses`, `accusedWrong`; needs data item 1                            | `spec.ts`, `choices.ts`, `resolve/apply-effect.ts`, `events.ts`, `dsl/effects.ts`                                                     | none      | 50168a/b, 50169b                                 |
| 21  | 3.30                | A `CollectionSearchFilter` for identity cards; `treatHostAsMinion` on an identity card with no controller                                     | `spec.ts`, `resolve/collection.ts`, `treat-as.ts`, `abilities.ts`                                                                     | none      | Reluctant Foe 50171                              |
| 22  | 3.31                | `RuleSpec additionalPowerCost` over other characters' attack, thwart and defense                                                              | `abilities.ts`, `actions.ts`, `legal.ts`, `defense-claim.ts`, `resolve/basic-power-by.ts`                                             | none      | Divided Loyalties 50173                          |
| 23  | 3.40 (a)            | `TriggerEvent cardBeingTucked` with `byPlayerCard`, opened only when an ability listens; `EffectSpec replaceTuckHost`                         | `trigger-events.ts`, `spec.ts`, `resolve/apply-effect.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                                  | none      | Silk Sense Overload 52028                        |
| 24  | 3.40 (b) (after 23) | `activeIn: "tucked"`; `TriggerEvent tuckedCardDiscarded` with the host and `byPlayerCard`                                                     | `abilities.ts`, `trigger-events.ts`, `effects.ts`, `resolve/triggers.ts`, `dsl/validate.ts`                                           | Q7 = A    | Hunting the Spider-Bride 52031                   |
| 25  | 3.42                | `RuleSpec topOfDeckFaceup.deck: "encounter"`; `Predicate topOfDeckFaceup` on it; views and the `encounterTopShown` log                        | `abilities.ts`, `select.ts`, `visibility.ts`, `deck-top.ts`, `events.ts`, `dsl/abilities.ts`, `dsl/values.ts`                         | Q6 = B    | Falcon's kit                                     |
| 26  | 3.43 (a)            | `AbilityCost.discardFromEncounterDeck { amount or choose, slot }`                                                                             | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `effects.ts`, `dsl/abilities.ts`                                              | none      | 51015, 53002, 53010                              |
| 27  | 3.43 (b), (c)       | `cardDiscardedFromDeck` for the encounter deck; `abilityResolved` carries the resolved ability's slots                                        | `trigger-events.ts`, `resolve/deck-discard.ts`, `resolve/triggers.ts`, `resolve/ability.ts`, `dsl/abilities.ts`                       | none      | Serpent Solutions 53031, Talon Line 53012        |
| 28  | 3.44                | `TriggerEvent boostCardGiven`; `lookAt` and `swapCards` over a facedown boost card and the deck top                                           | `trigger-events.ts`, `resolve/enemy-activation.ts`, `resolve/swap-cards.ts`, `visibility.ts`, `dsl/abilities.ts`                      | none      | Up, Up, and Away 53005                           |
| 29  | 3.45                | `TriggerEvent encounterCardBeingDealt`, opened only when an ability listens; a replaced deal leaves the card on the deck                      | `trigger-events.ts`, `effects.ts`, `resolve/reveal.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                                     | none      | Aerial Recon 53009                               |
| 30  | 3.46 (a)            | `AbilityLimit.per: "paidCard"`                                                                                                                | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`                                                                                | none      | Falcon's Flock 53006                             |
| 31  | 3.46 (b)            | Slot `paid.cards` on a play's announcement: the cards that paid for it                                                                        | `stack.ts`, `select.ts`, `resolve/play-card.ts`, `dsl/values.ts`                                                                      | none      | Spectrum 53018                                   |
| 32  | 3.46 (c)            | `RuleSpec spendableFromTucked`: a tucked resource card as a payment source for every player                                                   | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `resources.ts`, `dsl/abilities.ts`                                            | none      | Resource Reserve 53021                           |
| 33  | 3.47                | `RuleSpec defendsWithoutExhausting`                                                                                                           | `abilities.ts`, `rules.ts`, `defense-claim.ts`, `defend-preview.ts`, `resolve/enemy-activation.ts`                                    | none      | Draw Their Fire 53011                            |
| 34  | 3.48                | `ValueSpec distinctTraits { of }`                                                                                                             | `spec.ts`, `select.ts`, `dsl/values.ts`                                                                                               | none      | Strength in Diversity 53019                      |
| 35  | 3.49                | `TriggerEvent cardBeingAttached`; `EffectSpec replaceAttachHost`; `CardInstance.villainAlias` read by `theVillain`                            | `trigger-events.ts`, `state.ts`, `attachment-hosts.ts`, `resolve/attach.ts`, `select.ts`, `dsl/effects.ts`                            | none      | the Techno set                                   |
| 36  | 3.50                | `RuleSpec attackableAsMinion`: a target of attacks that holds damage, never defeated                                                          | `abilities.ts`, `select.ts`, `legal.ts`, `resolve/attack-ability.ts`, `resolve/target-validity.ts`                                    | none      | the Whiteout set                                 |
| 37  | 3.53                | `action.forced`; `outstandingForcedActions`; `endTurn` refused; the phase end puts late ones to their controllers                             | `abilities.ts`, `actions.ts`, `legal.ts`, `why-not.ts`, `flow.ts`, `events.ts`, `dsl/abilities.ts`                                    | none      | the Temptations, the five Trances                |
| 38  | 3.54                | `attach { card: { randomSetAside }, hideReverse }`; `CardInstance.reverseHidden`; `otherFaceVisible`                                          | `spec.ts`, `state.ts`, `visibility.ts`, `resolve/attach.ts`, `preview.ts`, `dsl/effects.ts`                                           | none      | Prime Real Estate 1A, Hypnotic Gaze              |
| 39  | 3.55 (after 2)      | `TriggerEvent countersBeingPlaced`, opened only when heard; a replacement per counter                                                         | `trigger-events.ts`, `effects.ts`, `resolve/triggers.ts`, `dsl/abilities.ts`                                                          | none      | Prime Real Estate 1B, Sovereign Sorceress 2B     |
| 40  | 3.57                | Linked cards set aside for a named encounter card, by title and card type                                                                     | `schema/keywords.ts`, `setup.ts`, `keywords.ts`                                                                                       | none      | Trickster Magic, `tt/aspect-basic`               |
| 41  | 3.58                | `AbilityCost.eachPlayer`                                                                                                                      | `abilities.ts`, `payable.ts`, `actions.ts`, `legal.ts`, `why-not.ts`, `dsl/abilities.ts`                                              | none      | Crown of the Enchantress                         |
| 42  | 3.60                | `swapVillain { with: { setAsideTrait }, face, dial }`; the pool by starting face                                                              | `spec.ts`, `resolve/villain-swap.ts`, `dsl/effects.ts`                                                                                | Q8 = A    | the Avatars, Stories and Lies                    |
| 43  | 3.61 (after 2)      | `RuleSpec counterLimit`; `addCounters` and `moveCounters` place up to it; `countersNotPlaced`                                                 | `schema/cards/encounter-cards.ts`, `abilities.ts`, `effects.ts`, `events.ts`, `dsl/abilities.ts`                                      | none      | the Synergy environments                         |
| 44  | 3.64                | `pod.ts`: `GroupId`, `PodState`, `podOf`; `GameState.pod?`; `GameSetupConfig.pod?`                                                            | `pod.ts`, `ids.ts`, `state.ts`, `setup.ts`, `index.ts`                                                                                | none      | tasks 45 to 49                                   |
| 45  | 3.65 (after 44)     | `scale` takes a group count; `scaleIn`; `hpPerGroup` in `minionPrintedHp`; hand-built two-group numbers                                       | `query.ts` and every `scale` caller                                                                                                   | none      | The Mangog, Door Between Worlds                  |
| 46  | 3.66 (after 44)     | `SharedPodState`, `applySharedEvent`; `EffectSpec sharedEvent`; `sharedEventEmitted`; `applyInbound` at the quiet point; three trigger events | `pod.ts`, `spec.ts`, `trigger-events.ts`, `effects.ts`, `flow.ts`, `events.ts`, `query.ts`, `dsl/effects.ts`                          | Q9 = A    | Loki, God of Lies; Worlds Collide; the Shatter   |
| 47  | 3.67 (after 44)     | `chooseGroup`, `inGroup`, `groupPlayerCount`; `podEffectRequested`; `RuleSpec reachableFromPod` (no effect at one group)                      | `spec.ts`, `abilities.ts`, `resolve/apply-effect.ts`, `select.ts`, `events.ts`, `dsl/effects.ts`, `dsl/values.ts`, `dsl/validate.ts`  | none      | every "group in your pod" card                   |
| 48  | 3.68 (after 46, 47) | `Command externalEvent`; `PodInboundEvent`; sequence, `no_remote_coordinator`, `pod_halted`; `isAuthorityCommand`; hand-built remote tests    | `commands.ts`, `engine.ts`, `errors.ts`, `pod.ts`, `legal.ts`, `events.ts`                                                            | none      | the multiplayer phase only                       |
| 49  | 3.69 (after 48)     | `groupSeed`; `GameSetupConfig.pod.podSeed`; no draw for bookkeeping inbound events                                                            | `pod.ts`, `setup.ts`, `engine.ts`                                                                                                     | none      | the multiplayer phase only                       |
| 50  | 3.72                | `cannotAttack.basicOnly`                                                                                                                      | `abilities.ts`, `rules.ts`, `actions.ts`, `legal.ts`, `dsl/abilities.ts`                                                              | none      | Seduced                                          |
| 51  | 3.74 (a)            | `CampaignGameQuery cardStateOf`; a `record` writes a `cardState` field, checked against its `cardIds`                                         | `campaign.ts`, `campaign/result.ts`, `campaign/log.ts`                                                                                | Q1 = B    | the definition (§8.4 line 77)                    |
| 52  | 3.74 (b) (after 51) | `ValueSpec campaignLog { card, counter }`; `Predicate campaignLog { card, face }`                                                             | `spec.ts`, `select.ts`, `dsl/values.ts`, `dsl/validate.ts`                                                                            | Q11 = B   | the Board Members restored at Setup              |
| 53  | 3.75 (a)            | `random.sealed`: a draw no trace, history entry or view holds; only a hidden field may take it                                                | `campaign.ts`, `campaign/ops.ts`, `campaign/runner.ts`                                                                                | none      | the A.I.M. envelope                              |
| 54  | 3.75 (b) (after 19) | `CampaignLogView.hidden`; `EffectSpec seedHiddenPiles`; `Predicate inCampaign`; `evidenceRowsLeft` exported; hidden values in no player view  | `campaign.ts`, `campaign/runner.ts`, `spec.ts`, `state.ts`, `visibility.ts`, `resolve/apply-effect.ts`, `select.ts`, `dsl/effects.ts` | none      | scenario 5 in the campaign; Zemo's Manipulations |
| 55  | 3.76 (after 53)     | A DEFEAT block's writes and `perAttempt` draws across two losses: proved, and extended only if the proof fails                                | `campaign/runner.ts`, `campaign/ops.ts`                                                                                               | none      | scenario 5 lost in a standard campaign           |
| 56  | 3.77                | `CollectionSearchFilter.notAmongOwnCards`; linked cards left out of a collection search                                                       | `spec.ts`, `resolve/apply-effect.ts`, `dsl/effects.ts`                                                                                | Q12 = A   | the nine evidence cards                          |

### 8.3 The "exists (verify)" and "exists (compose)" rows

No engine task. The scripting line that first needs each row proves it in a test, and a failure comes back here as
an extend.

| §    | Proved by (module, §8.4)                                | The test that proves it                                                                                                 |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 3.5  | `batroc`, `modok`, `baron-zemo`                         | §3.5 tests 1, 3, 4, 6; Q3's numbers under the default                                                                   |
| 3.8  | `nick-fury/identity`                                    | Break Cover then Assault's interrupt in one attack                                                                      |
| 3.10 | `maria-hill/identity`                                   | the six deck cases of §3.10                                                                                             |
| 3.13 | `batroc`, `modok`                                       | Leaping Kick's overkill past another player's ally; 3B's redirect                                                       |
| 3.14 | `batroc`                                                | the two-player walk through all three stages                                                                            |
| 3.15 | `batroc`                                                | a captive cannot be chosen for a discard, and is defeated by damage                                                     |
| 3.16 | `batroc`                                                | Low to High at 8, the loss at 8, the consequential "except"                                                             |
| 3.18 | `modok`                                                 | the third completion loses in standard mode                                                                             |
| 3.19 | `modok`                                                 | the defeating player takes the held ally                                                                                |
| 3.22 | `thunderbolts`                                          | one player and four players                                                                                             |
| 3.23 | `thunderbolts`                                          | 0 hit points with one in the victory display; the heal with no boost card; Q2's default                                 |
| 3.25 | `batroc`, `modok`, the Thunderbolt sets                 | each card's numbers in §3.25                                                                                            |
| 3.28 | `executive-board`                                       | 2 spent, 2 counters not placed                                                                                          |
| 3.32 | `maria-hill/obligation-nemesis`                         | a 1 / 1 / 1 facedown minion and its defeat                                                                              |
| 3.33 | `black-widow`, `aim-science`                            | incite on a card being revealed; three acceleration icons                                                               |
| 3.34 | `power-of-the-atom`, `supersonic`                       | THW −1 for a Gamma hero; nobody may defend MACH-IV                                                                      |
| 3.36 | `bp/shuri/identity`, `bp/shuri/support-upgrades-allies` | "on 1" with two upgrades; a Special that discards its card; a Special on another player's ally                          |
| 3.37 | `bp/shuri/identity`                                     | the three plays of §3.37                                                                                                |
| 3.38 | `bp/aspect-basic`                                       | the redeemed minion and Redemption's victory display                                                                    |
| 3.39 | `silk/silk/identity`                                    | the cap with a fifth card; a count by set; nothing tucked for a Victory minion                                          |
| 3.41 | `silk/silk/support-upgrades-allies`                     | the tucked card revealed and resolved; not offered on a flip                                                            |
| 3.51 | the module of each card named                           | one test per line of §3.51                                                                                              |
| 3.52 | the module of each card named                           | Invisibility Gear and Ready for a Fight; Bambino on an identity; Flight Squadron's limit                                |
| 3.56 | `tt/enchantress`                                        | the three plays of §3.56                                                                                                |
| 3.59 | `tt/god-of-lies` (a)                                    | the opening state and the four "cannot reach" cases of §3.59                                                            |
| 3.62 | `tt/god-of-lies` (a)                                    | a completion at 8 per player; a hero and an alter-ego "defeated"                                                        |
| 3.63 | `tt/god-of-lies` (a)                                    | Dark Scepter in the deck, in the discard pile, in play                                                                  |
| 3.70 | the module of each card named                           | one test per line of §3.70                                                                                              |
| 3.71 | the module of each card named                           | Draugr Buddy dealt to its defeater; Trance of Greed's "If you cannot"; each Synergy environment used by a second player |

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

**Pass 2c: Trickster Takeover** (`tt/`). The scaffold's four modules exist and are empty.

64. `tt/trickster-magic` (55056–55062): waits on 40.
65. `tt/aspect-basic` (the four allies, 55063–55066): waits on 40.
66. `tt/enchantress` (a): the villain, both main schemes, Future of Despair, the Hypnotic Gazes and Trances
    (55001–55011b). Waits on 37, 38 and 39.
67. `tt/enchantress` (b), after 66 in the same file: 55012–55026. Waits on 37, 39, 41 and 50.
68. `tt/god-of-lies` (a): the scenario's frame (55027a/b, 55028a/b, 55029a/b–55032a/b, 55033a/b, 55034a/b, 55052–55055)
    and the Shatter helper. Waits on 42 to 47 and on §8.1 item 18. **Written only with `sharedEvent`, `chooseGroup`,
    `inGroup`, `groupPlayerCount` and `reaches: neutral`**: no script changes a neutral card directly, reads
    `state.players.length` for "their group", or assumes one table. The module's review checks this by grep: the only
    places the word "Loki, God of Lies" or "Worlds Collide" reaches engine state are the two `sharedEvent` calls and the
    neutral cards' own abilities. With that, Epic Multiplayer Mode needs no change to this file.
69. `tt/god-of-lies` (b), after 68 in the same file: the encounter cards (55035–55051). Waits on 43, 45 and 47; The
    Mangog and Door Between Worlds carry `reachableFromPod`.
70. An Enchantress game, standard and expert, with Trickster Magic: a Gaze flipped by the fifth counter, a Forced Action
    refusing End turn, Future of Despair at 5 and 6 per player, a linked ally taken, a win at the last stage and a loss
    at 2B.
71. A God of Lies game in Single Group Mode, one player and three, standard and expert: the opening state of §3.59; an
    Avatar shattered twice (Loki flipped after the second, Intense Focus attached or flipped by mode); Stories and Lies;
    a win when Loki reaches 0; a loss by two completions in the villain phase; the last-player-phase win of Q9's
    default; replay deep-equal throughout. It also asserts the pod record (§3.64) and that the log holds no
    `externalEvent`.
72. The pass 2c ruling tests of §5.2 that no module above owns.

**Pass 1b: the campaign.** Lines 73 to 76 are effect builders in `aos/campaign/`; they hold no `CampaignDefinition`.

73. `aos/campaign/evidence` (50185–50193): the nine Setup effect lists by card id and their registry entries (§3.77).
    Waits on 56 and on 18 (the Board Member's flip).
74. `aos/campaign/executive-board`: `prepareBoard` (two counters, or a `secretsN` field with its faces), the three
    treacheries shuffled in, and the queries the Victory records use (§3.74). Waits on 51 and 52.
75. `aos/campaign/carryover`: Alert Level's threat, the Holding Cell's lock counters, the Adaptoid environments and
    Adaptoids, the surviving Thunderbolts' sets (§3.73). Reads the five scans §3.78 names first. Waits on the `batroc`,
    `modok` and `thunderbolts` modules of pass 1a.
76. `campaigns/expert-helpers.ts`: `healRecForSecret` (§3.78). One function and its test; another agent's file, so its
    own commit.
77. `packages/cards/src/campaigns/aos.ts`: `AOS_CAMPAIGN_DEFINITION` (§3.73), registered in `campaigns/index.ts`, with
    `aos.test.ts` for the definition-level tests of §3.73–§3.76. Waits on 53 to 55, on §8.1 items 28 and 30 to 32, on
    lines 73 to 76 and on all five scenario modules.
78. The campaign branches of pass 1a's `baron-zemo` module (50167a, 50167b; §3.75), in that module, after its own line.
    Waits on 54.
79. `packages/cards/src/campaigns/aos.qa.test.ts` (`rules-qa-engineer`), a standard campaign played end to end by
    commands, two players: five wins; evidence gained after at least two scenarios and its Setup offers taken and
    declined; a Board Member flipped in a scenario that was won and still an attachment two scenarios later; the
    accusation made from the grid; `status` `"won"`. Replay of every game deep-equal.
80. The same file, **a lost and retried scenario proving the log survives**: scenario 2 lost with a Board Member flipped
    during the lost game, then retried: the log equals the node's start (that member is an environment again, the
    envelope and decks unchanged), then won. Scenario 5 lost twice in a standard campaign (§3.76's test). This box
    removes nothing from the campaign, so the definition of done's third proof (a permanent removal that sticks across a
    retry) has no subject here: the flipped member that survives a later scenario's retry stands in for it, and the test
    says so.
81. The same file, **hidden evidence never visible**: at every command of line 79's campaign, until the accusation, no
    card id of `aimEnvelope` appears in any player's view of the game, any `preview`, any event or log line, any step
    trace or history entry, or any view model of the log; the same for the cards still in the S.H.I.E.L.D. pile. Then
    the expert campaign: persistent damage through four scenarios, a player defeated in a won scenario who rejoins at
    REC hit points and one who sits out, and scenario 5 lost: `status` `"lost"`.

### 8.5 The campaign, the client and Guided mode

Pass 1b's needs, for `game-client-engineer`. The checklist is `docs/wave-definition-of-done.md` §6;
`docs/campaign-client-per-box.md` §3 already says this box needs a design pass (Dossier, Rewind, Briefing). Pass 3 adds
the rest of the wave's client work.

1. **The Saga shelf.** `aos` on the shelf, a run signed, issue #1 briefed. `art/campaigns/aos/` holds `rulebook/` (eight
   page scans: 008, 010, 012, 014, 016, 017, 020, 021, the rulebook's full-page comic pages) and an empty `artboards/`.
   There is no `cover.*`; ask the owner for one, as `art/campaigns/aoa/cover.jpg`.
2. **The story file**, `packages/client/src/campaign/stories/aos.ts` with its `STORIES` entry: the five scenario
   introductions (the italic text of MC50 pp. 9, 11, 13, 15 and 18) and the conclusion ("Turn the page to read the
   conclusion", p. 19; pp. 20–21 were not read this pass).
3. **The comic reader's artboards** in `art/campaigns/aos/artboards/`, cut from the eight `rulebook/` pages: one before
   each scenario (8, 10, 12, 14, 16–17) and the conclusion (20–21). Render the design canvas to tiles before the brief,
   as for every box.
4. **The evidence notebook** (new; the design pass). The log's grid as the sheet draws it: three columns of nine rows,
   one a board member, each row three icons. A row holding an earned evidence card is crossed out; each column shows how
   many rows are left. Icons and colors from §1.16; two cards are blue, so every icon carries its title and nothing is
   told by color alone. Open from the Dossier between games (`evidenceRowsLeft` over the log's `evidence`) and from the
   table during a game: in every campaign scenario, and in a standalone Baron Zemo game over `revealedPileCards`. A view
   model in plain TypeScript; no row is ever marked as the answer.
5. **The envelopes.** The existing sealed envelope with a card count (design Q4) for the A.I.M. envelope, and a second
   for the S.H.I.E.L.D. envelope with its count (6 less the cards earned). Nothing else of a hidden card is drawn,
   anywhere, before the engine reveals it.
6. **Gaining evidence.** At a Victory: which board member was clean, the card turned faceup, the rows it crosses out. In
   scenario 5: the same reveal on the table for each card the Response gains.
7. **The accusation prompt** (The Accusation 2A). Three pickers, means, motive and opportunity, each offering only cards
   not yet earned; the board member the three name is shown as "the accused" before the player confirms; one
   confirmation. Then the reveal, in the engine's order: the three A.I.M. cards, the mole, how many of the four guesses
   were wrong, the secret counters placed, any member that flips.
8. **The Executive Board in the Dossier.** The sheet's table of secret counters by scenario, with a mark on a member
   that has turned, and the threshold of the mode about to be played.
9. **The Briefing.** What this scenario's Setup will do from the log, in the sheet's words (threat on Alert Level, lock
   counters, Adaptoid environments, surviving Thunderbolts). The offers made during setup are ordinary prompts: the
   expert heal, rejoin or sit out, and after mulligans the two offers of each evidence card.
10. **Defeat.** Scenarios 1 to 4 keep the "no penalty" rewind. Scenario 5 does not: in a standard campaign the screen
    says the evidence is prepared anew and how many cards are dealt back; in an expert campaign it is the end of the
    campaign. The rewind row's wording for this box is not the generic one (`campaign-client-per-box.md` §3).
11. **Guided mode** (`docs/wave-definition-of-done.md` §5): glossary entries for secret counter, evidence, means, motive
    and opportunity, the mole and the accused; a tip the first time a board member reaches one secret from flipping; a
    tricky-wording hint for "Board Member environment" against "Board Member card"; a Try-it for reading the grid.
12. **Seen in the browser**, by clicking: the notebook between games and in a game, an evidence gain, an accusation
    right and wrong, a scenario 5 loss in each campaign. The Playwright suite before the last push.
