# Wave 9 data survey (cycle 9 in our ids, Agents of S.H.I.E.L.D.)

Survey only, 2026-10-09, branch `claude/project-thread-fu5eqf`. No repo code or data was changed. Packs: `aos` (MC50
box), `bp`, `silk`, `falcon`, `winter`, and the scenario pack `tt` (Trickster Takeover). Companion docs:
`phase7-wave9-handoff.md`, `phase7-wave9-sources.md`. Model: `phase7-wave8-data-survey.md`.

Commands used: `survey.ts --pack aos --pack tt --pack bp --pack silk --pack falcon --pack winter --json <scratch>`;
Python reads of `raw/marvelcdb/*.json`; a probe script (`survey9/probe.ts`) that runs `toPlainText` and
`parseCardText` over every face of the six caches; an offline regen of the four emitted packs in a scratch copy of
`packages/content` (`scratchpad/survey9/regen/`, `assets` symlinked); and a scratch curation plus scratch normalizer
patches (scratch copy only) to find the second layer of errors in `aos` and `tt`. Scratch files live under
`/private/tmp/claude-501/-Users-quincarter-Documents-Dev-marvel-champions-game/fc1afa9e-1ba5-463a-a3d0-e741e914cdad/
scratchpad/survey9/`.

**Convention for printed-card claims (Wave 7 lesson).** A claim is marked **checked** only if I opened the scan, the
printed decklist card or the PDF in this session. Everything else is **unchecked**: it comes from MarvelCDB raw text,
the rulebook markdown, or the RRG markdown. Checked this session: scans `50067b` and `50168b`; the four printed
starter decklist cards for the hero packs (JPEGs from Hall of Heroes, section 6); and the Trickster Takeover insert
text (`mc55_rulebook-web.pdf`, extracted with a small script, so icons are missing from it; read as text, not as page
images). **Not checked:** MC50 rulebook PDF pages. This machine has no PDF renderer (`pdftoppm` is missing), so the
Maria Hill and Nick Fury decklists below come from the markdown only.

One process note: I ran a single read-only `git check-ignore` before noticing the "do not run git" rule. It printed
nothing and changed nothing. No other git command was run except the final `git status --porcelain` you asked for.

## 0. Corrections to the brief

1. **`evidence_*` types are not unhandled.** `normalize/encounter-cards.ts` already has a `case "evidence_means" |
"evidence_motive" | "evidence_opportunity"` that builds `EvidenceCard` (spec: `phase7-wave2.md` §6.4). The survey
   reports no "unhandled type" line for `aos`, and all nine records normalize. What is missing is data, not a type
   (section 4.3).
2. **`player_side_scheme` is also handled.** `bp` (51016, 51017, 51026) and `silk` (52005) emit as
   `type: "player_side_scheme"` and normalize cleanly (section 3).
3. **`Vulnerable`, `Form`, `Incite`, `Villainous`, `Patrol`, `Hinder`, `Linked`, `Team-Up` are all keywords the parser
   already recognizes** (probe, section 5). `Mission Response` is already in the parser's `TRIGGER` list (Wave 8).
4. `aos` has **195 top-level records, 221 faces** (26 records carry a nested b face), not 226. `tt` has 66 records, 81
   faces. Rulebook p. 2: "273 cards, consisting of 95 player cards, 8 villain cards, 161 encounter cards, and 9
   evidence cards"; raw `quantity` sums to 273. By script: player-faction copies 83, plus 12 copies of
   obligations and nemesis cards (faction `encounter` in raw) = 95; encounter copies 173 minus those 12 = 161;
   villain records 8 (Black Widow 3, Batroc, M.O.D.O.K., Citizen V, Baron Zemo 2); evidence 9. All four figures match
   (the counts, not the printed cards: unchecked against the PDF).
5. Hall of Heroes gives the box release date as **March 7, 2025** (page fetched this session and the
   `hallofheroes-llms.txt` line). Use that, not a guess, in the `aos` curation.

## 1. Where each pack stands

| Pack     | Raw cache (`raw/marvelcdb/`) | Emitted (`src/data/<pack>/`) | Cards | Encounter sets (raw `card_set_code`)                       | Scen. | Starter decks | Curation file (`scripts/marvelcdb/curation/`) | Registry (ingest and survey) | Pool today    |
| -------- | ---------------------------- | ---------------------------- | ----- | ---------------------------------------------------------- | ----- | ------------- | --------------------------------------------- | ---------------------------- | ------------- |
| `aos`    | yes, 195 records (221 faces) | no                           | -     | 20 (section 4.1)                                           | -     | -             | none                                          | not registered               | none          |
| `bp`     | 42 records (43 faces)        | yes                          | 42    | `black_panther_shuri_nemesis`, `extreme_risk`              | 0     | 0             | `bp.ts` (52 lines)                            | registered in both           | `DATA_ONLY_*` |
| `silk`   | 38 records (39)              | yes                          | 38    | `silk_nemesis`, `growing_strong`                           | 0     | 0             | `silk.ts` (30)                                | registered in both           | `DATA_ONLY_*` |
| `falcon` | 42 records (43)              | yes                          | 42    | `falcon_nemesis`, `techno`                                 | 0     | 0             | `falcon.ts` (31)                              | registered in both           | `DATA_ONLY_*` |
| `winter` | 37 records (38)              | yes                          | 37    | `winter_soldier_nemesis`, `whiteout`                       | 0     | 0             | `winter.ts` (30)                              | registered in both           | `DATA_ONLY_*` |
| `tt`     | yes, 66 records (81 faces)   | no                           | -     | 3: `enchantress_villain`, `god_of_lies`, `trickster_magic` | -     | -             | none                                          | not registered               | none          |

Notes:

- Emitted counts equal raw record counts for the four packs (42, 38, 42, 37). Nothing is merged away.
- All four `Cycle` records read `{ id: "cycle9", name: "Cycle 9", order: 9 }`. Rename the name only to "Agents of
  S.H.I.E.L.D."; the id stays. `data-only.test.ts` asserts `cycleOf(code) === "cycle9"` for the four (the "cycle 9"
  line in the cycle grouping test). The same rename covers `aos` and `tt`.
- Release dates in the curations: `bp` and `silk` 2025-05-02, `falcon` and `winter` 2025-06-20, each citing its Hall
  of Heroes page. `aos` 2025-03-07 (Hall of Heroes). `tt` 2025-08-15 (Hall of Heroes). All fetched this session.
- Every emitted `scenarios.ts` and `starterDecks.ts` for the four is an empty array.
- Raw `fetchedAt` is 2026-09-13 for all six caches.
- `src/data/index.ts` today: `DATA_ONLY_CARDS` = `BP`, `WINTER`, `FALCON`, `SILK`, `WONDER_MAN`; the `WAVE8_*` block
  (lines ~604 to 680) is the model for the new block. `PLAYABLE_CARDS` appends `WAVE8_CARDS.slice(CORE_CARDS.length)`;
  `CAMPAIGNS` ends with `AOA_CAMPAIGN`.
- Quick Quip (`silk` 52034) is already scripted ahead of its pack (`packages/cards/src/wave5/silk/quick-quip.ts`).
  Keep it in mind when Silk's kit is scripted.

## 2. Offline regen of the four emitted packs (scratch only)

`ingest-marvelcdb.ts --pack <p> --offline` in the scratch copy, then `diff` of `cards.ts` against the committed file.
`packs.ts`, `provenance.ts`, `encounterSets.ts`, `index.ts` came out identical for all four.

| Pack     | Result vs committed                                                                                |
| -------- | -------------------------------------------------------------------------------------------------- |
| `bp`     | image extensions only (37 `.jpg` to `.png` lines)                                                  |
| `silk`   | image extensions (32) plus one card: 52028 Silk Sense Overload (obligation abilities)              |
| `falcon` | image extensions (35) plus five cards: 53011, 53014, 53018, 53019, 53020, and the obligation 53029 |
| `winter` | image extensions (31) plus one card: 54020 S.H.I.E.L.D. Sidearm                                    |

- **Image extensions.** Same as Wave 8: the regen picks `.png` where the committed files carry `.jpg`. Do not accept
  those hunks; keep the committed extension behavior.
- **Parser drift (the regen is the newer parser, and the better data):**
  - 52028 Silk Sense Overload: committed `[52028.obligation]`, regen `[silk-sense-overload-constant,
silk-sense-overload-forced-interrupt]` (the obligation text has a Forced Interrupt).
  - 53029 Harlem's Protector: committed `[53029.obligation]`, regen `[harlems-protector-constant,
harlems-protector-action]`, and the regen **adds `schemeIcons: ["hazard"]`** (raw `scheme_hazard: 1`). The
    committed file has no hazard icon on it. That is a real data fix; verify the icon on the scan at emit
    (unchecked).
  - 53011 Draw Their Fire and 53019 Strength in Diversity: regen adds `costPerPlayer: true` (raw `cost_per_hero`).
    The committed files lack it. A stat fix, unchecked against the scans.
  - 53014 Adam Warlock and 53018 Spectrum: committed has five abilities each (a response plus four `-constant`
    splits of the bulleted "if that card's printed resource has" body); regen keeps the one response.
  - 53020 Flight Squadron: regen adds `playRestrictions.maxWithTrait { trait: TEAM, per: "player", max: 1 }` ("Max 1
    TEAM card per player") and drops one `-constant`.
  - 54020 S.H.I.E.L.D. Sidearm ("Limit 1 per character"): regen adds `playRestrictions.maxPerHost: 1` and drops the
    `-constant`.
  - A grep of `packages/cards/src`, `engine/src` and `client/src` for these ability ids and codes found only the Quick
    Quip script and unrelated matches; nothing breaks today (the pack kits are not scripted).
- Do the regen once, in the step that renames the cycle, and review these six card diffs by hand.

## 3. Hero packs in detail

All four normalize with zero survey issues (`survey.ts`: "4 normalize cleanly"). No new card type or schema field is
needed. Raw types counted by script:

| Pack     | Hero | Ally | Event | Resource | Support | Upgrade | Player side scheme | Obligation | Minion | Side scheme | Treachery | Attachment |
| -------- | ---- | ---- | ----- | -------- | ------- | ------- | ------------------ | ---------- | ------ | ----------- | --------- | ---------- |
| `bp`     | 1    | 6    | 5     | 4        | 5       | 9       | 3                  | 1          | 3      | 2           | 2         | 1          |
| `silk`   | 1    | 6    | 8     | 3        | 3       | 8       | 1                  | 1          | 2      | 2           | 3         | 0          |
| `falcon` | 1    | 8    | 4     | 4        | 6       | 9       | 0                  | 1          | 3      | 2           | 2         | 2          |
| `winter` | 1    | 5    | 8     | 3        | 1       | 10      | 0                  | 1          | 3      | 2           | 1         | 2          |

- **Player side schemes.** `bp` 51016 Going Undercover (Justice, 4 fixed), 51017 Show of Empathy (Justice, 6 fixed),
  51026 Build Support (basic, 3 per hero, reprint of `40027`); `silk` 52005 Get the Scoop (hero, 4 fixed). All four
  emit `startingThreat` with `base`/`perPlayer` correctly and `victory 0`. 51016 and 51017 emit `unique: true` (raw
  `is_unique`); not checked on a scan.
- **Linked card:** `bp` 51036 Redemption, `Linked (Show of Empathy)`, dash cost curated. Already emitted.
- **Team-Up cards** (script grep of `Team-Up (` over the six caches, five cards, one in `aos`):

| Card                              | Pack     | Pair                                           | Art folder `art/teamups/` |
| --------------------------------- | -------- | ---------------------------------------------- | ------------------------- |
| 51025 Heart of the Panther        | `bp`     | Black Panther/T'Challa and Black Panther/Shuri | none for this pair        |
| 52024 Investigative Journalism    | `silk`   | Cindy Moon and Peter Parker                    | not present               |
| 54022 Super-Soldiers              | `winter` | Captain America and Winter Soldier             | not present               |
| 54023 Winter, Widow, Soldier, Spy | `winter` | Black Widow and Winter Soldier                 | not present               |
| 50024 Super Spies                 | `aos`    | Maria Hill and Nick Fury                       | not present               |

The folder listing of `art/teamups/` has 13 folders (`angel-psylocke` through `quicksilver-scarlet-witch`, none for
these five pairs). The slug rule is the two names, lowercased and sorted (`art/README.md`). The Black Panther pair
names a different hero (T'Challa, Core's) from Shuri, so it needs its own slug decision. Which pairs have a
playable partner is a spec question (`docs/team-ups.md`).

- Each pack has one extra encounter set besides the nemesis set: `extreme_risk`, `growing_strong`, `techno`,
  `whiteout`. Whether they print as modular sets is **unchecked** (no hero pack insert in the repo).
- 23 raw reprints (`duplicate_of_code`) across the four packs (`bp` 5, `silk` 6, `falcon` 7, `winter` 5); the ones
  without a scan are in the scan table, section 9.
- **Errata:** I read RRG 1.8's Agents of S.H.I.E.L.D. errata section as pointed to by the handoff (md line ~5124) only
  for the `aos` cards; **no errata check for the four hero packs was done in this survey** (unchecked; the
  `sources` doc owns it).

## 4. `aos` in detail

### 4.1 Raw records by encounter set and type

195 top-level records, codes 50001a to 50193, pack name "Agents of S.H.I.E.L.D.", `fetchedAt` 2026-09-13. By type
(script): hero 2, ally 11, event 9, resource 5, support 14, upgrade 13, obligation 4, minion 26, side scheme 22,
environment 14, treachery 29, villain 8, main scheme 9, attachment 20, evidence 9 (`evidence_means` 3,
`evidence_motive` 3, `evidence_opportunity` 3). Sum of `quantity` is 273.

| Set (`card_set_code`)          | Name                         | Recs | Copies | Codes            | Types                                                                                   |
| ------------------------------ | ---------------------------- | ---- | ------ | ---------------- | --------------------------------------------------------------------------------------- |
| `maria_hill`                   | Maria Hill                   | 12   | 17     | 50001a to 50029  | 4 event, 2 support, 2 upgrade, 1 hero, 1 ally, 1 resource, 1 obligation                 |
| null (aspect, basic)           | -                            | 29   | 50     | 50012 to 50058   | 8 ally, 10 support, 5 upgrade, 4 resource, 2 event                                      |
| `maria_hill_nemesis`           | Maria Hill Nemesis           | 4    | 5      | 50030 to 50033   | minion, side scheme, environment (Controlled Innocents), treachery x2                   |
| `nick_fury`                    | Nick Fury                    | 14   | 18     | 50034a to 50059  | 6 upgrade, 3 event, 2 support, 1 hero, 1 ally, 1 obligation                             |
| `nick_fury_nemesis`            | Nick Fury Nemesis            | 4    | 5      | 50060 to 50063   | 2 minion, side scheme, treachery                                                        |
| `black_widow_villain`          | Black Widow                  | 16   | 23     | 50064 to 50079   | 3 villain, 1 main scheme, 4 attachment, 2 minion, 2 side scheme, 4 treachery            |
| `a.i.m._abduction`             | A.I.M. Abduction             | 3    | 5      | 50080 to 50082   | minion, side scheme, treachery                                                          |
| `a.i.m._science`               | A.I.M. Science               | 3    | 5      | 50083 to 50085   | 2 minion, side scheme                                                                   |
| `batroc`                       | Batroc                       | 12   | 21     | 50086a to 50097  | villain, 3 main scheme, environment (Alert Level), ally, attachment, 2 minion, ...      |
| `batrocs_brigade`              | Batroc's Brigade             | 5    | 5      | 50098 to 50102   | 3 minion, side scheme, treachery                                                        |
| `m.o.d.o.k.`                   | M.O.D.O.K                    | 22   | 27     | 50103a to 50124  | villain, main scheme, 8 environment (4 Holding Cell, 4 Upgrade), 6 attachment, ...      |
| `scientist_supreme`            | Scientist Supreme            | 4    | 5      | 50125 to 50128   | 2 minion, side scheme, treachery                                                        |
| `thunderbolts`                 | Thunderbolts                 | 10   | 14     | 50129a to 50138  | villain, main scheme, environment, attachment, minion, obligation, 2 side scheme, ...   |
| `gravitational_pull`           | Gravitational Pull           | 4    | 6      | 50139 to 50142   | minion, side scheme, 2 treachery                                                        |
| `hard_sound`                   | Hard Sound                   | 5    | 6      | 50143 to 50147   | minion, 2 attachment, side scheme, treachery                                            |
| `pale_little_spider`           | Pale Little Spider           | 4    | 6      | 50148 to 50151   | minion, attachment, side scheme, treachery                                              |
| `power_of_the_atom`            | Power of the Atom            | 4    | 6      | 50152 to 50155   | minion, attachment, side scheme, treachery                                              |
| `supersonic`                   | Supersonic                   | 5    | 6      | 50156 to 50160   | minion, 2 attachment, side scheme, treachery                                            |
| `the_leaper`                   | The Leaper                   | 4    | 6      | 50161 to 50164   | minion, side scheme, 2 treachery                                                        |
| `baron_zemo`                   | Baron Zemo                   | 13   | 17     | 50165a to 50177  | 2 villain, 3 main scheme, 2 attachment, minion, 2 side scheme, 3 treachery              |
| `s.h.i.e.l.d.`                 | S.H.I.E.L.D.                 | 3    | 5      | 50178 to 50180   | minion, obligation (Arrest Warrant), side scheme                                        |
| `s.h.i.e.l.d._executive_board` | S.H.I.E.L.D. Executive Board | 6    | 6      | 50181a to 50184c | 3 environment (Board Members), 3 treachery (A.I.M. Interference energy/mental/physical) |
| `executive_board_evidence`     | Executive Board Evidence     | 9    | 9      | 50185 to 50193   | 3 means, 3 motive, 3 opportunity                                                        |

Counts by script; the multi-type rows are abbreviated. **Ten reprints** (`duplicate_of_code`): 50016 (23016),
50021 (27047), 50025 to 50027 (01088 to 01090), 50047 (08011), 50048 (08012), 50049 (27043), 50053 (06031), 50057
(27055). 50054 Nick Fury, Sr. is reprinted by `winter` 54021 (`duplicate_of_code: 50054`).

**Encounter-set ids contain dots.** Five raw set codes are `a.i.m._abduction`, `a.i.m._science`, `m.o.d.o.k.`,
`s.h.i.e.l.d.` and `s.h.i.e.l.d._executive_board`. No set code in the other 57 caches has a dot (the only non-word
code is `mojo`'s `sci-fi`). `normalizePack` emits them as ids unchanged (scratch run: 20 sets). Whether ids with
dots are safe in the catalog, URLs and client keys is **unchecked**; see the schema list (S11).

Obligations (4 records): 50029 Press Conference (`maria_hill`), 50059 Discovered (`nick_fury`), 50134 Innocent
Bystanders x3 (`thunderbolts`), 50179 Arrest Warrant (`s.h.i.e.l.d.`). The scratch run applied the Wave 6 rule:
50029 and 50059 come out `encounterSetIds: []`, 50134 and 50179 keep their set. No fix needed.

### 4.2 What the normalizer does today, type by type

Scratch run with a 14-correction curation (below): **196 cards**, by type hero_identity 2, ally 15, event 9, resource 5,
support 14, upgrade 13, obligation 4, minion 26, side_scheme 22, environment 14, treachery 29, villain 6,
main_scheme 5, attachment 23, evidence 9. Reading it:

| Raw `type_code`                                   | Handled?                                                                                                                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hero` (+ linked `alter_ego`)                     | yes: 2 `hero_identity` (Maria Hill 50001a/b, hand 5/6; Nick Fury 50034a/b, hand 5/6); nemesis set links resolve                                                                                      |
| `ally`, `event`, `resource`, `support`, `upgrade` | yes, with the cost corrections below                                                                                                                                                                 |
| `obligation`                                      | yes (rule above)                                                                                                                                                                                     |
| `minion`, `side_scheme`, `treachery`              | yes; see the A.I.M. Scientist and Velociraptor-style raw issues below                                                                                                                                |
| `environment`                                     | yes: 14 cards. The b faces are separate cards linked by `otherFaceId` (50105a to `50105b` ally, 50181a to `50181b` attachment). No emission error                                                    |
| `attachment`                                      | yes with host fixes below (9 records need attention)                                                                                                                                                 |
| `main_scheme`                                     | yes; 9 records become 5 cards (Black Widow 1 stage; Batroc 3; M.O.D.O.K. 1; Citizen V 1; Baron Zemo 3)                                                                                               |
| `villain`                                         | yes; 8 records become 6 cards (below)                                                                                                                                                                |
| `evidence_means` / `_motive` / `_opportunity`     | **yes**: 9 `EvidenceCard`s (`evidence: means/motive/opportunity`, `encounterSetIds: [executive_board_evidence]`, one `setup` ability). `evidenceIcon` is unset because MarvelCDB has no field for it |
| `player_side_scheme`                              | not in `aos` (section 3)                                                                                                                                                                             |

**Survey (bare curation) reports 20 issues, by cause:**

| Lines | Codes                                   | What it needs                                                                                                                                                                         |
| ----- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | 50168b (starting, target, acceleration) | main scheme stage 2B prints dashes: `dashedThreatFields` (scan **checked**: dash badge, no numbers)                                                                                   |
| 6     | 50035a, 50091, 50105b to 50108b         | "without a cost": `specialCost: "dash"` (Assault/Stealth upgrade, Rescued Captive, four Inhuman allies)                                                                               |
| 4     | 50068, 50069, 50070, 50171              | "attachment without an attach rule": see 4.5                                                                                                                                          |
| 4     | same four                               | "record never turned into a card": consequence of the line above                                                                                                                      |
| 1     | 50083 A.I.M. Scientist                  | `scheme_acceleration: 1` on a minion: `ignoreFields` (raw says one acceleration icon; text prints none)                                                                               |
| 2     | 50119, 50153                            | attachment ATK -1: 50153 is a printed -1 (text), 50119 is "-X" (text: "X is equal to the printed cost of the card tucked here"), so it needs `cardNotes` (X), not `Correction.attack` |

With the scratch corrections for all of these (cost dashes, `ignoreFields`, `attack: -1`, the three
"Attack to" text fixes, `impliedAttachHost: "ownWhenRevealed"` for 50171, `dashedThreatFields` for 50168b),
`normalizePack` finishes with no errors. That scratch curation is the starting point for `curation/aos.ts`.

**Villains in the scratch output:**

| Card                          | Raw shape                                                   | Emitted                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Black Widow 50064 to 50066    | three single-card villains I, II, III, no b face            | one `VillainCard`, side A, stages 1 to 3. Fine                                                                          |
| Batroc 50086a/b               | one card, faces `A` and `B` (different HP 8 and 12)         | one card, side A, two stages labeled A and B (the MojoMania MaGog shape; `versionPairs`)                                |
| M.O.D.O.K. 50103a/b           | same                                                        | same                                                                                                                    |
| Citizen V 50129a/b            | same (per hero HP 12 / 16)                                  | same                                                                                                                    |
| Baron Zemo 50165a/b, 50166a/b | two cards, stage labels `A1`/`A2` and `B1`/`B2` (mode+face) | two cards, each with sides A and B, one stage (the Collector/Hela shape: the letter is the mode, the digit is the face) |

So the standard-mode and expert-mode villain of each A/B scenario is one **stage** pair (A then B), not two cards.
Rulebook: "Flip Batroc (A) to Batroc (B) for expert mode" (md pp. 11, 13, 15). That is a scenario-level question for
the spec (expert starts at stage B; the nested stages are not a flip during play), the same decision as MaGog in
Wave 6. The Zemo villains are the exception: in play A1 flips to A2 ("Unmasked") via Fighting Zemo 3A.

**Main schemes in the scratch output** (numbers are raw; only 50067b and 50168b checked):

| Card                                                                  | Stage records                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Widow's Web 50067                                                 | start 2 per hero, target 10 per hero, acceleration "X" (`printedX: ["acceleration"]`, raw `-1`). **Checked** on scan 50067b: "10 per hero" top-left, "+X per hero" badge, "2 per hero" bottom right, text "X is Black Widow's stage number." |
| Infiltrate A.I.M. Island Embassy 50087, 50088, 50089                  | 3 stages: start 6 / 3 / 12, target 12 / 10 / 18, acceleration 1 each (all per hero, **unchecked**)                                                                                                                                           |
| Upgrading Adaptoids 50104                                             | start 1, target 7, acceleration 1                                                                                                                                                                                                            |
| Apprehending Rogue Agents 50130                                       | start 1, target 11, acceleration 1                                                                                                                                                                                                           |
| Zemo's Manipulations 50167, The Accusation 50168, Fighting Zemo 50169 | 3 stages: 2 / 12 / acc 2; 2B all dashes (**checked**); 3B start 0 fixed, target 12, acc 2 (raw 3B: `base_threat_fixed: true`, **unchecked**)                                                                                                 |

Whether the per-hero marking is right on the unchecked ones is the usual raw-flag assumption (`*_fixed` false means
per hero). `Contents` and `Setup` text sits on the a record of each stage (the b record carries the numbers), as in
Wave 7.

### 4.3 Evidence cards and the campaign log

Nine `EvidenceCard`s emit with name, text and a `setup` ability. They are never in a deck. What is not in raw, and so
not in the data:

- **Which icon each evidence card shows** (rulebook p. 5: "cross out each combination of means, motive, and
  opportunity in the campaign log that includes the icon on the evidence card gained"). The raw text has the
  Setup effect only. `EvidenceCard.evidenceIcon` is optional and unset.
- **The combination table on the log** (page 24 of the rulebook / `mc50_agents_of_shield_campaign_log.pdf`): which
  means, motive and opportunity combination implicates which board member (Chief Medical Officer, Chief Surveillance
  Officer, Chief Tactical Officer). The markdown conversion of page 24 kept only the headings "Means / Motive /
  Opp." with no icons. **Needs the log page read as an image** (I cannot render PDFs here). Owner input needed if
  the scan route is not available.
- The three card backs (means, motive, opportunity) are the only way the rulebook separates them physically;
  `evidence-back-a/b/c.jpg` are listed on the Hall of Heroes page.
- "Search your collection" appears in the evidence Setup text and in Reluctant Foe 50171. Our engine has no player
  collection concept at play time; see S10.
- Typo in raw: 50193 Authority prints "Aggresion support" twice (unchecked on the scan; the aspect name is
  "Aggression"). Needs a `textReplace` correction after a scan read.

### 4.4 Scenarios (rulebook markdown, unchecked on the PDF)

Rulebook headings and Contents lines from the md (pp. 9 to 19 and the main schemes' `a` records):

| #   | Scenario (our id)        | Villain deck (standard / expert) | Main scheme deck                                                          | Own and required sets                                                              | Modular                                                                                                                                                                    |
| --- | ------------------------ | -------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Black Widow              | Black Widow I, II / II, III      | The Widow's Web (50067)                                                   | `black_widow_villain`, Standard                                                    | `a.i.m._abduction`, `a.i.m._science` (both removable)                                                                                                                      |
| 2   | Batroc                   | Batroc A / B                     | Infiltrate A.I.M. Island Embassy, Locate Missing Person, Extract Captives | `batroc`, Standard                                                                 | `a.i.m._science`, `batrocs_brigade` (both removable)                                                                                                                       |
| 3   | M.O.D.O.K.               | M.O.D.O.K. A / B                 | Upgrading Adaptoids                                                       | `m.o.d.o.k.`, Standard                                                             | `scientist_supreme` (removable)                                                                                                                                            |
| 4   | Thunderbolts (Citizen V) | Citizen V A / B                  | Apprehending Rogue Agents                                                 | `thunderbolts`, Standard                                                           | 1 per hero, plus one more, from the six Elite-Thunderbolt sets (`gravitational_pull`, `hard_sound`, `pale_little_spider`, `power_of_the_atom`, `supersonic`, `the_leaper`) |
| 5   | Baron Zemo               | Baron Zemo A1 / B1               | Zemo's Manipulations, The Accusation, Fighting Zemo                       | `baron_zemo`, `s.h.i.e.l.d._executive_board`, `executive_board_evidence`, Standard | `scientist_supreme`, `s.h.i.e.l.d.` (both removable)                                                                                                                       |

Scenario shapes the curation (`ScenarioCuration`) must express, and whether a field exists today:

- Scenario 4's modular choice is a **pool with a count of `perPlayer + 1`** and an Elite-Thunderbolt filter. The
  existing `modularSetPool { setCodes, restricted }` and `setAsideModularSetCount { base, perPlayer }` shapes fit the
  count (`{ base: 1, perPlayer: 1 }`) and the pool of six. The Setup step ("set each Elite Thunderbolt aside and
  shuffle the rest of the sets in", "reveal Justice, Like Lightning") is scripting.
- Scenarios 1 to 3 and 5 are ordinary single-villain scenarios. Scenario 5 needs the Board Member environments and
  the evidence "prepare" step at setup; those are scripting plus campaign data.
- Standalone Baron Zemo ignores each evidence card's lower text ("only applies during setup"); a data flag is not
  needed (the engine ignores `setup` on evidence outside campaign mode).
- `expertVillains` swaps one villain card code: Zemo A1 to B1 fits. For Batroc, M.O.D.O.K. and Citizen V, expert
  means starting the A/B stage pair at B, which is **not** an `expertVillains` swap; the `villainStages`
  `{ standard, expert }` pair (`[1,1]` / `[2,2]`) is the likelier fit. Decision for the spec (same family as Wave 8
  open question 5).
- Black Widow expert: "Remove Black Widow (I) and add Black Widow (III)" = `villainStages` standard `[1,2]`, expert
  `[2,3]`, which exists (the `mut_gen` shape).

### 4.5 Attachments, raw typos and other text problems (card codes)

| Code(s)                                 | Raw state                                                                                                                           | Action                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 50068, 50069, 50070                     | "**Attack to** Black Widow." (typo for "Attach to")                                                                                 | `textReplace` correction; verify on the three scans (unchecked)                                       |
| 50171 Reluctant Foe                     | no attach sentence; text says "When Revealed: ... put it into play engaged with you. Attach this card to it."                       | `impliedAttachHost: "ownWhenRevealed"` (ruling February 20, 2026 (4)). The rest is a new mechanic, S9 |
| 50087a Infiltrate A.I.M. Island Embassy | Contents says "**Batrocs's** Brigade"                                                                                               | `textReplace` ("Batroc's"); unchecked                                                                 |
| 50193                                   | "Aggresion" (twice)                                                                                                                 | `textReplace`; unchecked                                                                              |
| 50083 A.I.M. Scientist                  | raw `scheme_acceleration: 1` on a minion; text prints no icon                                                                       | `ignoreFields`; check the scan before ignoring (unchecked)                                            |
| 50184a/b/c A.I.M. Interference          | three records in one set, names differ only by the resource icon in the title (`[energy]`, `[mental]`, `[physical]`), no `imagesrc` | emit as three cards (no merge); scans exist                                                           |
| 50131a/b                                | b face is "Thunderbolt Backup" (environment, flip)                                                                                  | fine as a flip pair; the "attached minion is in play" rule is engine                                  |
| 50090a/b                                | Alert Level, "Low" and "High" sides (b has trait `High.`)                                                                           | fine as a flip pair; scripting                                                                        |
| Raw `a` main scheme records             | no image (`imagesrc` null)                                                                                                          | covered by local scans through `withLocalArt`                                                         |

A script over every face of the six caches against `/usr/share/dict/words` plus all card names and traits in the 63
caches found only these true typos: "Aggresion" (50193), "Batrocs's" (50087a), "identiy" (`tt` 55035) and the three
"Attack to" lines. No `Preparation` fix is needed in text, but the parser does not know it (section 5).

### 4.6 Campaign cards and the campaign

`aos` has **no campaign-faction player cards** and no campaign encounter sets: the rulebook "Campaign Instructions"
are per scenario in the book, and every card in raw plays in standalone mode too (the A.I.M. Interference cards, the
Board Members and the evidence cards are used outside campaign mode). The hand-authored `src/data/aos/campaign.ts`
needs, from the rulebook md (pp. 4 to 6, 9 to 19, 24; **unchecked on the PDF**):

- `boxCode: "MC50"`, five scenario ids in order, win all five in order to finish; a lost scenario resets with no penalty
  (standard campaign); in an **expert campaign** a lost scenario 5 ("Defeat: Expert Campaign Only") loses the campaign.
- Log fields: per-player identity and remaining hit points (expert); scenario 1 "minions and side schemes in play";
  scenario 2 "rescued captives"; scenario 3 the four Adaptoid environments ("Flying", "Psionic", "Sarah Garza", "Strong"
  Upgrade) marked in play; scenario 4 "Surviving Thunderbolts" (names); remaining secret counters per board member by
  scenario (1 to 4); the evidence combinations table.
- Campaign setup per scenario (place threat on Alert Level, lock counters on the top Holding Cell, put marked Adaptoids
  into play and shuffle surviving Thunderbolts' sets, secret counters carried per board member, "resolve the Setup of
  each earned evidence card after mulligans", expert healing by secret counter).
- `campaignSetIds` is empty or the box's own sets; there is no `prohibited` text (grep of the md found none).
- `logSheetReference: "docs/campaign-modes/log-sheets/mc50_agents_of_shield_campaign_log.pdf"` exists.

The envelope mechanics (A.I.M. envelope hidden, S.H.I.E.L.D. envelope, randomly choosing one card of each kind) are
campaign state, not card data.

### 4.7 Double-sided and multi-face cards

The 26 records with a nested b face:

- **Identity pairs (2):** 50001a/b, 50034a/b.
- **Villain pairs (5):** 50086, 50103, 50129 (version stages A/B), 50165, 50166 (mode+face A1/A2, B1/B2).
- **Main scheme stages (9):** each a/b.
- **Flip environments (8):** Alert Level 50090a/b, Holding Cell x4 (50105a to 50108a, b faces are Inhuman allies, each
  with a different title: Flying Inhuman 50105b and three more), Justice, Like Lightning 50131a/b, Board Members
  50181a to 50183a (b faces are attachments with trait `Board Member`).
- **Upgrade pair:** 50035a/b Assault / Stealth (`Suit form`, `Permanent`; the keyword parses as `form: suit`).
- The Holding Cell deck is four double-sided cards with allies on the back: a data pair per card, a deck is scripting.

No dangling link: every `linked_to_code` resolves, every b face has a record. The `a` faces of villains, main schemes
and environments carry no `imagesrc` (58 of 221 faces), which local scans cover.

### 4.8 Heroes

- **Maria Hill (50001a/b).** Hero 9 HP (rulebook p. 2 callout: "HAND SIZE 5 / HIT POINTS 9", unchecked), hand 5,
  THW 2 / ATK 1 / DEF 2 (md callout digits; unchecked), traits S.H.I.E.L.D. and Spy. "Each ally you control gains the
  S.H.I.E.L.D. trait. Reassignment — Action: move 1 all-purpose counter ... (Limit once per round.)" Signature 50002 to
  50011 (10 records, 15 copies). Aspect: Leadership. Obligation 50029, nemesis `maria_hill_nemesis` (50030 to 50033).
- **Nick Fury (50034a/b).** Hero 10 HP, hand 5, ATK 2, THW 2, DEF 2; traits S.H.I.E.L.D., Soldier, Spy. Aspect:
  **Justice** (rulebook heading "NICK FURY / JUSTICE"). Signature 50035a/b Assault / Stealth (a suit-form upgrade
  with Setup-style behavior), 50036 to 50046. Obligation 50059, nemesis `nick_fury_nemesis` (50060 to 50063).
- All-purpose counters (rulebook p. 4) and the `Form` keyword (p. 3) are new engine concepts; `form` already exists in
  `keywords.ts`, counters of an "all-purpose" type do not exist in the schema (scripting and engine).
- Maria's aspect cards include three single copies in other aspects (50018 The Bellerophon, Aggression; 50019 The
  Douglass, Justice; 50020 The Pericles, Protection): off-aspect allowances for her deck, same shape as
  `offAspectAllowanceCodes` in `StarterDeckCuration`.

## 5. `tt` in detail

### 5.1 Raw records by encounter set and type

66 records, 81 faces; `quantity` sum 77. By type: villain 8, main scheme 4, side scheme 9, attachment 14, minion 16,
treachery 7, environment 4, ally 4. Faction: encounter 62, basic 4 (the four linked allies).

| Set (`card_set_code`) | Recs | Codes           | Contents                                                                                                                                                                                                                      |
| --------------------- | ---- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enchantress_villain` | 26   | 55001 to 55026  | Enchantress I to III (3 villains), main schemes 1A/1B and 2A/2B, 1 side scheme, 5 Hypnotic Gaze a/b attachments, 5 attachments, 4 minions, 2 side schemes, 4 treacheries                                                      |
| `god_of_lies`         | 29   | 55027a to 55055 | Loki, God of Lies 55027a/b; Worlds Collide 55028a/b; four Avatars 55029a/b to 55032a/b; Mischief and Mayhem 55033a/b; Intense Focus 55034a/b; 2 attachments; 8 minions; 4 side schemes; 3 treacheries; 4 Synergy environments |
| `trickster_magic`     | 11   | 55056 to 55066  | 4 Enthralled minions (Absorbing Man, Titania, Whirlwind, Zzzax), 2 side schemes, Love Triangle, 4 linked allies                                                                                                               |

The pack has **no hero cards, no player-side cards, no obligation, no nemesis set**.

The Hall of Heroes page lists two unnumbered cards that are **not in MarvelCDB raw**: **Shatter the Illusion** (a rules
card, `shattertheillusion.jpg`) and the **Epic Multiplayer reminder** (`epicmultiplayerreminder.jpg`). The insert
says the Fading Figment's When Revealed tells players to "shatter the illusion" "following the steps found on the
set-aside Shatter the Illusion rules card" (insert p. 19). Its text is not in the repo. The same situation as Wave 8's
Mission Rules card (S12). It also has the `_2` / `_3` extra copies on the page (55021_2, 55022_2, 55024_2, 55037_2,
55047_2, 55049_2, 55051_2/_3), which are just multiple copies of one card.

### 5.2 What the normalizer does today

Survey (bare): 32 issues. After the scratch curation and scratch patches (digit stage labels, mixed-set mode labels),
these remain:

| Lines        | Codes                            | Problem                                                                                                                                                                                        |
| ------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2            | 55027a, 55027b                   | villain stage labels `"1"` and `"2"` are not roman numerals (S1)                                                                                                                               |
| 2            | set `god_of_lies` side A/B names | the set mixes God of Lies (digits) with four Avatars (mode+face `A1`..`D2`): the set-wide shape tests fail (S1)                                                                                |
| 4 (after S1) | 55029a to 55032a                 | "villain face names differ": the b face is "Fading Figment" under the Avatars' own names (S2)                                                                                                  |
| 3            | 55028a/b Worlds Collide          | stage labels `A` / `B` (not `1A` / `1B`): "not an NA/NB pair"; b prints no starting threat and no acceleration (S3)                                                                            |
| 7            | 55007a to 55011a, 55034a         | attachments with no attach sentence: Hypnotic Gaze is dealt to each identity by Prime Real Estate's Setup; Intense Focus is attached to the Avatar villain by Mischief and Mayhem's Setup (S6) |
| 2            | 55035, 55036                     | "unrecognized attach rule": "Attach to your identiy." (typo) and "Attach to the Avatar of Loki villain." (S7)                                                                                  |
| 1            | 55041 The Mangog                 | `health_per_group` is not supported (S4)                                                                                                                                                       |
| 14           | the same records                 | "never turned into a card" (consequence of the attach lines)                                                                                                                                   |

**Silent wrongness (no error line):** `base_threat_per_group` on 55046 Door Between Worlds (7 per group) and
`threat_per_group` on 55028b Worlds Collide (target 2 per group) are read by nothing in `normalize/` (the field names
only appear in `raw-types.ts`), so **55046 would emit as "7 per hero"**. Only `tt` uses any per-group field in the 63
caches. The text token `[per_group]` is recognized by `text.ts`, but the schema has no per-group scaling value (grep of
`src/schema` finds none). Epic multiplayer's "pod" and "group" concepts are not in the schema either (S4, S5).

**Villain records in the scratch output (after the patches):** Enchantress I to III as one three-stage card (set
`enchantress_villain`, fine; not run through the patched shape). `god_of_lies`: God of Lies 55027a/b (20 HP per hero,
no ATK or SCH, "If Loki, God of Lies has 10 [per hero] or fewer remaining hit points, flip this card"); Loki the
Rascal 55029a (A1, ATK 1 / SCH 1, star SCH), Loki the Miscreant 55030a (B1, ATK 2 / SCH 1), Loki the Knave 55031a (C1,
ATK 1 / SCH 2), Loki the Wretch 55032a (D1, ATK 1 / SCH 1, star), all 15 HP per hero; each b face is Fading Figment
(trait Illusion, 99 HP, no ATK or SCH), whose When Revealed says "Shatter the illusion". Rascal's b stage label is
`A2`, and so on. The Avatars share the mode+face shape that the Collector and Hela use, so each Avatar should be one
two-sided `VillainCard` (A = the Avatar, B = Fading Figment).

**Shape of the scenario (insert text, read this session; icons missing from the extraction):**

- **Enchantress** (insert pp. 6 to 7): three stages with main schemes Prime Real Estate (1A/1B, target 6 per hero, +1
  acceleration, start 1) and Sovereign Sorceress (2A/2B, target 9, +1, start 2). Villain deck Enchantress I and II
  (standard), II and III (expert) (from the 55004a Contents text). One modular set, Trickster Magic. Hypnotic Gaze
  (Enchantment, Permanent, a/b: the b face "Trance" with a unique ability) is dealt face down to each identity; the
  "Forced Action" ability type (insert p. 7) is new: a player must perform it during the player phase and the phase
  cannot end until all possible forced actions are performed. Charm counters, and the "Enthralled" trait.
- **God of Lies** (pp. 8 to 21): **Single Group Mode** (1 to 4 players, one group) and **Epic Multiplayer Mode**
  (any number of groups of 1 to 4 players, grouped into pods, simultaneous play, a time limit of 180 minutes by
  default, an "event organizer"). In both modes Loki, God of Lies and the Worlds Collide main scheme sit in a
  neutral game area outside any player's area; they can only be affected by abilities that name them. Avatars,
  Mischief and Mayhem, and one encounter deck are per group.
- Per-group icon `[per_group]` (insert p. 4). Four Synergy environments (Permanent, "Max 1 [per_hero] synergy
  counters here").
- **Whether we build Epic Multiplayer at all is an owner decision.** Hall of Heroes says "Single Table and Epic
  Multiplayer". The project is a 1 to 4 player co-op engine; Single Group Mode needs the neutral game area and
  per-hero scaling only, Epic needs separate game areas, pods, group icons and a networked event organizer role
  (`multiplayer-netcode-engineer`).

### 5.3 Other tt data points

- **Linked allies** 55063 to 55066, `Linked (<minion title> minion)`, trait Defiant, faction basic, `Victory 0`, "does
  not count against your ally limit"; parse as `linked` with `cardTitle`. The title form is "Absorbing Man minion",
  not a bare card title (`Linked (Show of Empathy)` was the only precedent). Whether `cardTitle: "Absorbing Man
minion"` resolves to a card (the minion 55056) is **unchecked**; likely needs a parser rule that strips " minion".
- **Per-hero HP on villains,** the Avatars, and Loki all scale per hero. In Epic mode the `[per_group]` icon on Loki's HP
  counts total players across all groups (insert p. 11), per hero in Single Group.
- The two cards 55041 The Mangog and 55046 Door Between Worlds say "Any player in your pod can attack/thwart ... as
  if it were in their game area" and "When Defeated: Each group in your pod places 3 shatter counters on their
  Avatar of Loki". In Single Group Mode "your pod" is just your group.
- `Hinder`, `Incite`, `Patrol`, `Steady`, `Quickstrike`, `Retaliate`, `Villainous` and `Victory` keywords all parse.
- Swap rules (insert p. 19) and the rulings of February 28, 2026 (3), March 19, 2026 (2) and June 25, 2026 (5) are
  `sources` doc material; not re-read here.

## 6. Precon decklists

### 6.1 Maria Hill and Nick Fury (MC50 rulebook p. 7)

Read from `docs/campaign-modes/markdown/mc50_agents_of_shield.md` (**unchecked on the PDF**; no renderer here).
Copy counts compared by script with raw `quantity` and names:

| Deck                   | Hero set                                                                                                                                                                                                                         | Aspect                                                                                                                                                                                                        | Basic                                                                                                     | Sum    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| Maria Hill, Leadership | 15 (Nick Fury 50002, All-Points Bulletin x2, On the Double x2, Reinforcements x3, The Hard Call, Special Funding x2, Support Staff, The Iliad, Life Model Decoy, S.H.I.E.L.D. Director)                                          | 15 = Leadership 12 (Victoria Hand, Slingshot, Organizational Support x3, Agents of S.H.I.E.L.D. x3, Command Team x3, The Circe) + Aggression The Bellerophon + Justice The Douglass + Protection The Pericles | 10 (Dum Dum Dugan, Grant Ward, Melinda May, Super Spies, Energy, Genius, Strength, Front Organization x3) | **40** |
| Nick Fury, Justice     | **16** (Assault/Stealth 50035, Maria Hill 50036, Concentrated Fire x2, Covert Surveillance x3, Spray Fire x2, Fury's Flying Car, Safe House #221, EM Shield, Eyepatch Camera, Fury's Watch, Intelligence Analysis, Secret Agent) | 17 (Agent Coulson, Quake, Global Logistics x3, Informant x3, Intelligence x3, Prism Dust x3, Under Surveillance x3)                                                                                           | 8 (Nick Fury, Sr., Super Spies, Jemma Simmons, Leo Fitz, Sky-Destroyer, Practiced Plan x3)                | **41** |

- Every named card exists in raw with at least the printed copy count (script match, no misses). Maria Hill's
  `Super Spies` has `quantity: 2` in raw and the list uses 1 in each deck (one copy per deck, Team-Up, Max 1).
- **Checked 2026-10-09 by the main session:** page 7 was rendered with PyMuPDF (`python3 -c "import pymupdf"` works on
  this machine; `pdftoppm` is not installed) and read. Both printed lists match the table above card for card and
  count for count. Nick Fury's printed hero list does include Assault / Stealth, so 41 is what the page prints: his
  suit form upgrade starts in play and sits outside the 40-card deck. No owner input is needed for item 2 of
  section 10.
- **Nick Fury's list sums to 41, not 40.** Either Assault/Stealth (a Setup card that starts in play) is not counted in
  the 40, or one count in the markdown is wrong (md conversion has struck-through headings and dropped text elsewhere
  on the same page). The scan route is closed here; **needs the printed page 7 image, or the Hall of Heroes
  "Starter Decks" PDF**, `mc50_rulebook-1.pdf` (URL on the Hall of Heroes page).
- Codes: Maria 50002 to 50011, 50012 to 50020, 50021 to 50028; Nick 50035a, 50036 to 50046, 50047 to 50053, 50054 to 50058. 50021 Dum Dum Dugan and 50047 to 50049, 50053 and 50057 are reprints (no own scan; the earlier printing's
  image is used).
- `StarterDeckCuration` fields to fill: `identityCode` 50001a / 50034a, `aspect` leadership / justice,
  `offAspectAllowanceCodes` for Maria's three single-aspect supports, `obligationCode` 50029 / 50059,
  `nemesisCodes` 50030 to 50033 / 50060 to 50063.

### 6.2 The four hero packs (printed decklist cards, **checked**)

Hall of Heroes posts one image per pack, labeled "Starter Deck" (`wp-content/uploads/2026/01/<name>.jpg`: `black-panther`,
`silk`, `falcon`, `winter-soldier`). I downloaded the four into the scratchpad (`survey9/decklists/`) and read each
card in this session. The printed lists are **derivable only from these cards**: each pack's raw copies far exceed 40
(for example `bp` hero 15 + justice 25 + basic ...), so raw cannot tell which copies are in the precon. The lists
below are the numbers the card prints (collector numbers) with copies, and **each sums to 40 by script** against raw
quantities.

| Pack     | Hero cards (15)                                                                                                                                                                                                                        | Aspect (count)                                                                                                                                                                                                         | Basic                                                                                                                        | Obligation, nemesis                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `bp`     | 2 T'Challa; 3 Clawed Strike x2; 4 On the Prowl x2; 5 Wakanda Forever!; 6 Vibranium x2; 7 The Elephant's Trunk; 8 Queen Ramonda; 9 Aja-Adanna; 10 Kimoyo Beads; 11 Panther Claws; 12 Spider Bites; 13 Vibranium Suit                    | Justice (16): 14 Manifold; 15 Infiltration x3; 16 Going Undercover; 17 Show of Empathy; 18 The Raft; 19 Invisibility Gear x3; 20 Sonic Rifle x3; 21 Sting Operation x3                                                 | 22 Aneka, 23 Ayo, 24 Okoye, 25 Heart of the Panther, 26 Build Support, 27 Energy, 28 Genius, 29 Strength, 30 Dora Milaje (9) | 31 T'Challa's Shadow; 32 Klaw, 33 Manipulated M.U.S.I.C., 34 M.U.S.I.C., 35 The Scream x2                |
| `silk`   | 2 Smooth as Silk x2; 3 Swinging Silk Kick x3; 4 Wallcrawl x2; 5 Get the Scoop; 6 Albert Moon; 7 J. Jonah Jameson; 8 Eidetic Memory; 9 Organic Webbing; 10 Outwit; 11 Spider Claws; 12 Spider Reflexes                                  | Protection (18): 13 Scarlet Spider; 14 Spider-Byte; 15 Not Today x3; 16 "Stop Hitting Yourself" x3; 17 Dr. Sinclair; 18 Energy Shield x3; 19 Ready for a Fight x3; 20 Stun Gun x3                                      | 21 Madame Web, 22 Spider-Man, 23 Across the Spider-Verse, 24 Investigative Journalism, 25 Energy, 26 Genius, 27 Strength (7) | 28 Silk Sense Overload; 29 Morlun, 30 The Great Hunt, 31 Hunting the Spider-Bride x3                     |
| `falcon` | 2 Redwing; 3 Bird of Prey x2; 4 Bird's-Eye View x2; 5 Up, Up, and Away x2; 6 Falcon's Flock; 7 Soup Kitchen; 8 Aerial Evacuation; 9 Aerial Recon; 10 Battlefield Awareness; 11 Draw Their Fire; 12 Talon Line; 13 Vibranium Microweave | Leadership (19): 14 Adam Warlock; 15 Aero; 16 Cloud 9; 17 Hugin & Munin; 18 Spectrum; 19 Strength in Diversity x3; 20 Flight Squadron x3; 21 Resource Reserve x3; 22 The Triskelion; 23 Captain America; 24 Wingman x3 | 25 Energy, 26 Genius, 27 Strength, 28 The Power of Flight x3 (6)                                                             | 29 Harlem's Protector; 30 Viper, 31 Serpent Solutions, 32 Serpent Soldier x2, 33 Adder-tisement          |
| `winter` | 2 Cybernetic Arm; 3 Black Widow; 4 Arm Block x2; 5 Metal Punch x3; 6 Electrical Discharge x2; 7 Safe House #30; 8 Silent Infiltration x2; 9 Winter Armor; 10 Winter Mask; 11 Winter Rifle                                              | Aggression (19): 12 Captain America; 13 Deathlok; 14 Firepower x3; 15 One by One x3; 16 Spoiling for a Fight x3; 17 Aggressive Stance x3; 18 Bambino; 19 Man on the Wall; 20 S.H.I.E.L.D. Sidearm x3                   | 21 Nick Fury, Sr., 22 Super-Soldiers, 23 Winter, Widow, Soldier, Spy, 24 Energy, 25 Genius, 26 Strength (6)                  | 27 Red Room Programming; 28 Crossbones, 29 Hydra Hit Squad, 30 High-Tech Armament, 31 Hydra Mercenary x2 |

Sums (hero + aspect + basic): `bp` 15 + 16 + 9 = 40; `silk` 15 + 18 + 7 = 40; `falcon` 15 + 19 + 6 = 40; `winter`
15 + 19 + 6 = 40. (My own addition of the printed counts, done by hand and re-added; confirm with a script at emit.)
`winter` 54021 Nick Fury, Sr. is the same card as `aos` 50054 (a cross-pack reprint): the deck points at 54021 and
needs its image from 50054.

**So: the four hero pack decks do not need the owner**, since the cards are readable at the URLs above. The owner
only needs to say whether an agent may transcribe them (as in Wave 8 step 8), and to supply the Maria Hill and Nick
Fury page 7 image if the PDF cannot be rendered by the next agent.

## 7. Schema and parser gaps

"Parser" means `parse-text.ts` or a normalizer step; "curation" means an existing curation field is enough.

| #   | Gap                                                                                                                                                                                                   | Cards                                                                                                                                                                                 | Fix kind                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | A villain set that mixes a two-sided God of Lies (digit stages `"1"`/`"2"`) with four mode+face Avatars (`A1`/`A2` .. `D1`/`D2`); `stageOrder` returns 0 for digits and the set-wide shape tests fail | 55027a/b, 55029a/b to 55032a/b                                                                                                                                                        | normalizer: accept digit stage labels, and decide the shape per record group rather than per set                                                                                    |
| S2  | A villain's two faces with different names (Loki the Rascal / Fading Figment); the mode+face branch errors "villain face names differ"                                                                | 55029 to 55032                                                                                                                                                                        | normalizer: drop or relax the name check; the schema already has a per-side `name`                                                                                                  |
| S3  | A single main scheme with stage labels `A`/`B` (not `1A`/`1B`) whose B side prints no starting threat and no acceleration, and "2 per group" target                                                   | 55028a/b                                                                                                                                                                              | normalizer (stage label rule) plus curation `dashedThreatFields` for starting and acceleration; target is S4                                                                        |
| S4  | **Per-group scaling** (`health_per_group`, `base_threat_per_group`, `threat_per_group`): not in the schema; `normalize/` ignores it, so 55046 emits wrongly as per hero                               | 55028b target, 55041 HP, 55046 starting threat                                                                                                                                        | schema (`ScalingValue` gains a per-group term, plus text and engine) and normalizer; in Single Group Mode it equals 1 group                                                         |
| S5  | Group, pod and neutral game area concepts (Epic Multiplayer)                                                                                                                                          | scenario `god_of_lies`                                                                                                                                                                | spec (`game-rules-architect`) and an owner decision whether Epic is in scope; `Scenario.separateGameAreas` is the Kang shape, not this                                              |
| S6  | Attachments with no attach text, placed by a main scheme's Setup (Hypnotic Gaze to each identity, Intense Focus to the Avatar villain)                                                                | 55007a to 55011a, 55034a                                                                                                                                                              | curation `impliedAttachHost`: `{ kind: "yourIdentity" }` fits Gaze; Intense Focus needs a villain-by-trait host (S7)                                                                |
| S7  | Attach host "the [Trait] villain" (`qualified` has `enemy` / `minion` but no `villain` category); and the typo "identiy"                                                                              | 55036 Dark Scepter, 55034a Intense Focus, 55035                                                                                                                                       | `AttachmentHostCategory` gains `villain` plus parser; `textReplace` for 55035                                                                                                       |
| S8  | `Preparation:` is an ability header the parser does not recognize; 12 faces parse silently as `constant` (it was `Mission Response` in Wave 8)                                                        | 12 Black Widow set cards (50068 to 50071, 50074, 50076 to 50079, 50149, 50150 among them) and the villain 50064 to 50066 text; player cards 50046, 50047, 50058 also mention the word | parser (`TRIGGER`, `kindOf`) plus a new `AbilityKind` and glossary entry, after a short `game-rules-architect` ruling (insert md p. 9: used only by Black Widow's Forced Interrupt) |
| S9  | A hero identity card used as a minion: Reluctant Foe "Treat attached hero as an Elite minion with SCH equal to its printed THW ... Replace its printed text box" (FAQ md p. 22)                       | 50171                                                                                                                                                                                 | engine and spec (an out-of-game identity becomes a card in play); data side is `impliedAttachHost: "ownWhenRevealed"` only                                                          |
| S10 | "Search your collection": a card pulls a card from outside the deck or game                                                                                                                           | 50171, 50185 to 50193                                                                                                                                                                 | spec question (what is "your collection" in a digital game)                                                                                                                         |
| S11 | Dotted encounter-set ids (`a.i.m._abduction`, `m.o.d.o.k.`, `s.h.i.e.l.d.` and two more)                                                                                                              | 5 sets, about 55 cards                                                                                                                                                                | decision: emit raw codes, or add a curation set-id slug override; check the catalog and client                                                                                      |
| S12 | Rules reference cards not in MarvelCDB: Shatter the Illusion, Epic Multiplayer reminder (and the Wave 8 Mission Rules precedent)                                                                      | none in raw                                                                                                                                                                           | decision: data card, UI-only, or engine text; text needs the card image                                                                                                             |
| S13 | `Forced Action` as an attachment trigger with a "phase cannot end" rule                                                                                                                               | 55007b to 55011b                                                                                                                                                                      | parser already has `forced-action`; the rule is engine                                                                                                                              |
| S14 | Per-hero evidence icons and the log combination table                                                                                                                                                 | 50185 to 50193; campaign                                                                                                                                                              | data entry from the log page and cards (section 4.3); `EvidenceCard.evidenceIcon` exists                                                                                            |
| S15 | New engine concepts, not schema: all-purpose counter types (`aos`), `Form` change (`aos`), secret and lock and shatter and synergy and charm counters, Holding Cell deck, mission counters            | `aos`, `tt`                                                                                                                                                                           | engine (counter types are likely strings on cards already; check at spec)                                                                                                           |
| S16 | Four raw typos ("Attack to", "Batrocs's", "Aggresion", "identiy") and one stat flag (`scheme_acceleration` on 50083)                                                                                  | 50068 to 50070, 50087a, 50193, 55035, 50083                                                                                                                                           | curation `textReplace` and `ignoreFields` (read each scan first)                                                                                                                    |
| S17 | `Linked (Absorbing Man minion)`: the title includes the word "minion"                                                                                                                                 | 55063 to 55066                                                                                                                                                                        | parser rule or curation; unchecked what the probe stores in `cardTitle`                                                                                                             |

**Not gaps (confirmed by probe or scratch run):** `evidence_*` types; `player_side_scheme`; mode+face villains (Zemo);
version-pair villains (Batroc, M.O.D.O.K., Citizen V); `Vulnerable`, `Form`, `Incite`, `Villainous`, `Patrol`,
`Hinder`, `Linked`, `Team-Up`, `Toughness`, `Setup`, `Permanent`, `Retaliate`; `Mission Response`; per-hero starting
threat and the `X` acceleration (`printedX`); hero-kit obligation set emptying; cost-less allies and upgrades
(`specialCost: "dash"`); flip environments; 26 b faces linked cleanly; duplicate-of reprints.

## 8. Keywords and text the parser does not recognize

Probe over every face of the six caches (465 faces): two `unclassified` lines (55035, 55036, the attach rules above),
no crashes, no unknown icon tokens. Keyword instances seen (cards in brackets are examples):

`alliance` (1), `form` (50035a/b), `guard` (9), `hinder` (7, parsed with value `0` for the `[per_hero]` form,
50074, 50075, 50085, 50122: the value is carried separately, matches Wave 8's handling), `incite` (50184a to c),
`linked` (6), `patrol` (4), `permanent` (21), `quickstrike` (7), `requirement` (3), `restricted` (4), `retaliate`
(5), `setup` (50181a to 50183a), `steady` (5), `surge` (8), `team-up` (5), `toughness` (7), `uses` (19), `victory`
(-1 on 50091, 50125, 50126; 0 on 10; 1 on 16), `villainous` (13), `vulnerable` (8).

**`Victory -1`** appears on three cards (50091 Rescued Captive, 50125 Scientist Supreme, 50126 Monica Rappaccini; the
probe shows `victory -1`). A negative victory value is unusual; confirm the schema's `victory` accepts it and read
the scan (unchecked).

**Header-like patterns the parser does not know** (script over all faces):

| Pattern                                                      | Cards (examples)                                                                                                                                     | Note                                                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Preparation:`                                               | 18 raw records mention it (script): the Black Widow set (50064 to 50066, 50068 to 50074, 50076 to 50079, 50150) and player cards 50046, 50047, 50058 | S8 above. Parses as `constant`, so a "Preparation ability" cannot be told apart in the data |
| `Replace its printed text box with:`                         | 50171                                                                                                                                                | free text inside a constant                                                                 |
| `If that card's printed resource has:` / `Choose:` / `Then:` | `falcon` 53014, 53018, `winter` 54027, `tt` 55051                                                                                                    | bulleted result bodies; the regen already keeps them as one ability                         |
| quoted-gain clauses (`gains "Preparation: ..."`)             | 50070, 50074                                                                                                                                         | the parser keeps the clause inside a constant on purpose (Flight Squadron precedent)        |
| "Mission-like" scenario terms                                | none                                                                                                                                                 | `aos` has no mission area                                                                   |

The Wave 8 parser fix for `Mission Response` is already in `parse-text.ts` (`TRIGGER`), so no action there.

## 9. Card art

All art is outside the versioned data (gitignored `assets/card-art/`); nothing was fetched or stored. Scan coverage by
script over every face of the six caches (`<code>.png` in `assets/card-art/bundles/cards/`):

| Pack     | Records | Faces | Faces with no `.png` scan | Which                                           | Faces with no raw `imagesrc` |
| -------- | ------- | ----- | ------------------------- | ----------------------------------------------- | ---------------------------- |
| `aos`    | 195     | 221   | **7**                     | 50016, 50021, 50047, 50048, 50049, 50053, 50057 | 58 (covered by local scans)  |
| `tt`     | 66      | 81    | **0**                     | -                                               | 30 (covered by local scans)  |
| `bp`     | 42      | 43    | **4**                     | 51020, 51027, 51028, 51029                      | 4 (these four)               |
| `silk`   | 38      | 39    | **5**                     | 52022, 52023, 52025, 52026, 52027               | 5 (these five)               |
| `falcon` | 42      | 43    | **6**                     | 53014, 53016, 53022, 53025, 53026, 53027        | 6 (these six)                |
| `winter` | 37      | 38    | **5**                     | 54015, 54021, 54024, 54025, 54026               | 5 (these five)               |
| total    | 420     | 467   | **27 faces**              | all 27 are reprints (`duplicate_of_code`)       | -                            |

- **Every one of the 27 is a `duplicate_of_code` reprint**, and each original has a scan (script check). Those 27
  codes reuse the earlier printing's image through the reprint path, as in Waves 7 and 8, so **no card needs a
  fetch**: 0 genuinely missing. The reprint originals: 23016, 27047, 08011, 08012, 27043, 06031, 27055; 20015, 01088
  to 01090; 27049, 27018; 17011, 29014, 01073; 28014, 50054.
- `assets/card-art/hall-of-heroes-manifest.tsv` already lists 51 `aos` and 30 `tt` fetched scans.
- `tt` 55021, 55022, 55024, 55037, 55047, 55049 and 55051 have extra copies on the Hall of Heroes page (`_2`, `_3`):
  duplicates of the same card, no new card.
- Two `tt` reference images (Shatter the Illusion, Epic Multiplayer reminder) have no code and no scan locally. See
  S12.
- Hero pack scans are present for every non-reprint card, including all `a`/`b` faces (50001a/b, 50034a/b).

**Hero art (`art/heroes/<id>-<slug>/hero.<ext>`):**

| Hero                  | Folder                                   | State                       |
| --------------------- | ---------------------------------------- | --------------------------- |
| Black Panther (Shuri) | `art/heroes/51001a-black-panther-shuri/` | `hero.jpg` present          |
| Silk                  | `art/heroes/52001a-silk/`                | `hero.jpg` present          |
| Falcon                | `art/heroes/53001a-falcon/`              | `hero.jpg` present          |
| Winter Soldier        | `art/heroes/54001a-winter-soldier/`      | `hero.png` present          |
| Maria Hill            | `art/heroes/_pending/50001a-maria-hill/` | **empty** (`.gitkeep` only) |
| Nick Fury             | `art/heroes/_pending/50034a-nick-fury/`  | **empty** (`.gitkeep` only) |

I did not open any hero image (not checked). The two pending folders must be filled by the owner and moved up on import.
The convention for Wave 8's two new files was `hero.png` (not yet converted); the others use `.webp` / `.jpg`.

**Scenario art (`art/scenarios/<scenarioId>/villain.*`):** none for `black-widow`, `batroc`, `modok`, `citizen-v` /
`thunderbolts`, `baron-zemo`, `enchantress` or the God of Lies scenario. **`art/scenarios/loki/villain.webp` already
exists but belongs to The Mad Titan's Shadow's Loki scenario**, so the Trickster Takeover scenario id must not be
`loki` (suggest `god-of-lies`). `art/scenarios/_pending/` is empty. Teamup art: none for the five pairs (section 3).

**Campaign art (`art/campaigns/aos/`):** `artboards/` is empty; `rulebook/` has eight lettered comic pages
(`page_008`, `010`, `012`, `014`, `016`, `017`, `020`, `021`) and `SOURCE.md`; no `cover.*`, no `pages/` folder. The md
calls pages 1, 8, 20 and 21 "full-page graphic". The md and the folder disagree on which pages are comics (the md
marks p. 8, 20, 21; the folder also has 10, 12, 14, 16, 17), which I did not resolve (unchecked: I opened none).
Compare `art/campaigns/aoa/` (`cover.jpg`, `pages/`, `artboards/`, `rulebook/`).

## 10. What must be asked of the owner

1. **Epic Multiplayer for Trickster Takeover:** build Single Group Mode only, or also pods and groups (S5, a large
   job)? Recommended default: Single Group Mode only, with epic noted in the roadmap.
2. **Nick Fury's starter deck:** the md sums to 41. Supply the printed page 7 of `mc50_rulebook-web.pdf` as an image,
   or confirm whether Assault/Stealth is outside the 40. (Also lets me mark Maria's list checked.)
3. **Evidence icons and the log combination table:** the log page as an image, or the nine icons and the 27
   combinations (or however many the table prints), because MarvelCDB does not carry them.
4. **Maria Hill and Nick Fury hero art** into the two `_pending` folders; scenario villain art for the seven
   scenarios; a cover for `art/campaigns/aos/`.
5. **Hero pack decklists:** OK for an agent to transcribe the four Hall of Heroes cards (already read; the lists are
   in section 6.2), or do you want your own copies as files?
6. **Reference cards:** the Shatter the Illusion card text and the Epic reminder: a photo of each, or leave them
   out and put the steps in the scenario script from the insert text.
7. **Dotted encounter-set ids (S11):** keep raw codes or slug them (recommended: slug as `aim_abduction` and so on,
   one curation field, if the catalog and URLs misbehave).
8. **Rules question for the spec, with a recommended default:** "search your collection" (S10), recommended default: a
   player may search any card in their saved card pool, same as a deck builder.
9. Which Hero pack Team-Up pairs get art folders now (five pairs).

## 11. Proposed emit order and tests that change

Steps touching different files can run in parallel, at most three agents.

1. **Normalizer prep (small):** S1, S2, S3 (stage labels and villain shapes); S4 minimum for `tt` (a per-group value in
   the schema and the three `*_per_group` reads, even if the engine treats it as 1 group); S7 (`villain` host
   category); S8 (`Preparation` header, after a `game-rules-architect` ruling). Extend `normalize.test.ts` and
   `parse-text.test.ts`.
2. **Regenerate and rename the four packs:** change the four curations' `cycle` name to "Agents of S.H.I.E.L.D."; do
   the section 2 regen with the committed image extensions; review the six card diffs by hand; run
   `data-only.test.ts`.
3. **`curation/aos.ts` pass 1:** cycle `{ id: "cycle9", name: "Agents of S.H.I.E.L.D.", order: 9 }`, pack name,
   release date `2025-03-07` (Hall of Heroes), `outDir src/data/aos`, `exportPrefix "AOS"`,
   `handAuthoredModules: ["campaign"]`; the 14 scratch corrections (six dash costs, 50083 `ignoreFields`, 50153 and 50119,
   three "Attack to" fixes, 50171 host, 50168b dashes) plus the typo `textReplace`s; register in `ingest-marvelcdb.ts`
   and `survey.ts`. Done when `survey.ts --pack aos` is clean.
4. **`aos` scenarios (five), starter decks (Maria Hill, Nick Fury, after question 2), hand-authored `campaign.ts`,**
   then emit.
5. **`curation/tt.ts`:** cycle `cycle9`, pack name "Trickster Takeover", release date `2025-08-15`, `exportPrefix
"TT"`; attachment hosts, 55035 typo, 55036 host, the God of Lies shape (S1 to S3); two scenarios (Enchantress with
   villain stages `[1,2]` / `[2,3]`; God of Lies) with `Scenario.id` `enchantress` and `god-of-lies`; register; emit.
6. **Hero pack precons** for `bp`, `silk`, `falcon`, `winter` from the printed lists in section 6.2 (one pack per agent,
   or two), each `verified: true`, with each obligation (31, 28, 29, 27) and nemesis codes.
7. **`WAVE9_*` block in `packages/content/src/data/index.ts`** (before `PLAYABLE_CARDS`, after `WAVE8_*`): `export *`
   for `aos`, `bp`, `silk`, `falcon`, `winter`, `tt`; `WAVE9_CARDS` (Core plus the six), `WAVE9_ENCOUNTER_SETS`,
   `WAVE9_SCENARIOS`, `WAVE9_STARTER_DECKS`; append `WAVE9_CARDS.slice(CORE_CARDS.length)` to `PLAYABLE_CARDS`;
   `AOS_CAMPAIGN` into `CAMPAIGNS`; remove the four packs (and their imports and encounter sets) from
   `DATA_ONLY_CARDS` and `DATA_ONLY_ENCOUNTER_SETS`, leaving `wonder_man`.
8. **Tests that change:**
   - `data-only.test.ts`: `PACKS` goes from 5 to 1 (only `wonder_man`); the test "five packs, no duplicate ids" becomes
     "one pack"; drop the `cycle9` assertion in the cycle grouping test (and its comment, in the same commit); add
     `WAVE9_CARDS` to the "no data-only id collides" list; the two obligation tests (`bp` 51031, `falcon` 53029 Uses
     and Victory 0) move to `wave9.test.ts` (and 53029 now also has a hazard icon, section 2); remove the `BP_*`,
     `WINTER_*`, `FALCON_*`, `SILK_*` imports.
   - `campaigns.test.ts`: add `WAVE9_ENCOUNTER_SETS` and `WAVE9_SCENARIOS`; the `CAMPAIGNS` id list gains `"aos"`
     (after `"aoa"`).
   - `schema/star-icon.test.ts` (the 330-card count) gains `WAVE9_CARDS` and a new `+N from aos and tt` figure;
     `minion-hp-per-player.test.ts` gains `WAVE9_CARDS`.
   - `pool-version.test.ts` and `catalog.test.ts` / `catalog-codes.ts` counts, and `schema/glossary.test.ts` (a
     `cycle9` glossary box and a `WAVE_9_IDS` test, as Wave 8's `cycle8`), plus the client's `pool.ts` (outside
     content; the client step).
   - New `wave9.test.ts` (model: `wave8.test.ts`): card integrity (`validateCard` on every card), counts by type,
     encounter sets, scenarios, starter decks (six), `AOS_CAMPAIGN`, errata, per-group values, evidence cards.
   - `docs/team-ups.md`: five pairs (section 3).
9. **Scripting hand-off notes** in each curation's `scriptingNotes`, per hero and per scenario (Reassignment and
   all-purpose counters; suit forms and threat on the suit upgrade; Preparation; Holding Cell deck; Thunderbolt Backup;
   board members, secret counters, the accusation; Hypnotic Gaze, charm counters and Trance; Avatars, shatter counters,
   swaps).
10. **Art step (owner-supplied):** section 9 items.

## 12. Open questions

1. Epic Multiplayer scope (owner question 1).
2. Is each Batroc, M.O.D.O.K. and Citizen V "A to B" a stage change in the data, with expert simply starting at B (the
   `villainStages` pair), or two separate cards as in Mansion Attack?
3. Does the God of Lies villain flip (55027a to 55027b) model as two sides of one stage, or two stages?
   (The raw labels say stages 1 and 2; the card says "flip this card".)
4. Per-group scaling in single table play: is `[per_group]` simply "1"? (Insert p. 4, "multiplies by the number of
   groups in the respective pod".)
5. Does the card pool need the Shatter the Illusion card as data (S12)?
6. Is "Victory -1" legitimate (50091, 50125, 50126), or a raw data error to read from the scans?
7. Where do the errata (if any) for `aos` and the four packs live? The handoff points to RRG md lines
   ~4698 and ~5124; I did not extract them (the `sources` doc owns it).
