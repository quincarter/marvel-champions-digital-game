# Wave 8 data survey (cycle 8 in our ids, Age of Apocalypse)

Survey only, 2026-10-07, branch `feature/wave-8`. No code or data was changed. Packs: `aoa` (MC45 box), `iceman`,
`jubilee`, `ncrawler`, `magneto`. Companion docs: `phase7-wave8-handoff.md`, `phase7-wave8-sources.md`. Model:
`phase7-wave7-data-survey.md`. Commands used: `survey.ts --pack <code>` (JSON to the scratchpad only), Python reads of
`raw/marvelcdb/*.json`, a probe script calling `parseCardText` on three card texts, and an offline regen of the four
emitted packs in a scratch copy of `packages/content` (`scratchpad/survey/regen/`, `assets` symlinked). Nothing was
written into the repo.

**Convention for printed-card claims (Wave 7 lesson).** A claim is marked **checked** only if I read the scan or the
printed page in this session. Everything else about a printed card is **unchecked**: it comes from MarvelCDB raw text,
the
rulebook markdown, or the RRG markdown. Checked this session: scans `45084a`, `45101b`, `45102a`, `45102b`, `45103b`,
`45104a`, `45129`, `45166a`, `45171a`, `45179a`, `48037`; rulebook PDF pages 22 and 24; RRG PDF page 69 (printed 69);
and the eight comic pages exist in `art/campaigns/aoa/rulebook/` (page 9 opened; the markdown calls pages 7, 9, 10, 13,
15, 17, 18 and 21 "full-page graphic").

## 1. Where each pack stands

| Pack       | Raw cache (`raw/marvelcdb/`)               | Emitted in `src/data/<pack>/` | Cards       | Encounter sets                       | Scenarios | Starter decks | Curation file            | Registry (`ingest-marvelcdb.ts` / `survey.ts`) | Pool today    |
| ---------- | ------------------------------------------ | ----------------------------- | ----------- | ------------------------------------ | --------- | ------------- | ------------------------ | ---------------------------------------------- | ------------- |
| `aoa`      | yes, 195 records (226 with nested b faces) | no                            | - (raw 195) | -                                    | -         | -             | none (`curation/aoa.ts`) | not registered; bare survey gives 20 lines     | none          |
| `iceman`   | 32 records (33 with the nested b face)     | yes                           | 32          | `iceman_nemesis`, `sauron`           | 0         | 0             | `iceman.ts` (55 lines)   | registered in both                             | `DATA_ONLY_*` |
| `jubilee`  | 40 records (41)                            | yes                           | 40          | `jubilee_nemesis`, `arcade`          | 0         | 0             | `jubilee.ts` (34)        | registered in both                             | `DATA_ONLY_*` |
| `ncrawler` | 38 records (39)                            | yes                           | 38          | `nightcrawler_nemesis`, `crazy_gang` | 0         | 0             | `ncrawler.ts` (30)       | registered in both                             | `DATA_ONLY_*` |
| `magneto`  | 42 records (43)                            | yes                           | 42          | `magneto_nemesis`, `hellfire`        | 0         | 0             | `magneto.ts` (31)        | registered in both                             | `DATA_ONLY_*` |

Notes:

- Emitted counts equal raw record counts for all four packs (counted by script from `cards.ts`: 32, 40, 38, 42). No
  record is merged away (Jubilee's `a`/`b`/`c` versions are separate cards, section 5).
- All four `Cycle` records read `{ id: "cycle8", name: "Cycle 8", order: 8 }` in `packs.ts` and the curations. Rename
  the
  name only to "Age of Apocalypse"; the id stays (`data-only.test.ts` line 108 to 109 asserts `cycleOf(code)` is
  `"cycle8"` for the four).
- `data-only.test.ts` has `PACKS` of 9 (the four, plus `bp`, `winter`, `falcon`, `silk`, `wonder_man`). When wave 8
  moves
  the four out, the list becomes 5, and the cycle 8 assertion (lines 108 to 109) is removed in the same commit, as waves
  6
  and 7 did. `index.ts` has a `WAVE7_*` block (lines 531 to 593); a `WAVE8_*` block does not exist yet.
- Release dates in the curations: 2024-05-17 (Iceman), 2024-07-19 (Jubilee), 2024-09-20 (Nightcrawler), 2024-11-15
  (Magneto), each citing its Hall of Heroes page. The sources doc gives the box as March 29, 2024 (Hall of Heroes; not
  re-checked here).
- Every emitted `scenarios.ts` and `starterDecks.ts` is an empty array.
- The handoff and this survey agree on the raw counts. The sources doc section 5 table does not: it lists 226+, 33, 41,
  39
  and 43, which are record counts including the nested b faces (`aoa` 226, others one more than the top-level count).
  See "Corrections to the sources doc" at the end of section 3.

## 2. Offline regen of the four emitted packs (scratch only)

`ingest-marvelcdb.ts --pack <p> --offline` run in the scratch copy; `diff -r` against the committed `src/data/<pack>/`
(the repo tree stayed clean; `git status` printed nothing).

| Pack       | Result vs committed                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `magneto`  | one card differs: Magneto's Armor 49004 (ability ids)                                                  |
| `iceman`   | image extensions (62 hunks) plus one card: The Eye of Sauron 46032 (ability ids)                       |
| `jubilee`  | image extensions (58 hunks) plus one card: Husk 47012 (ability ids)                                    |
| `ncrawler` | image extensions (64 hunks) plus one card: Kurt's Cutlasses 48004 (ability ids and `restrictedWeight`) |

- **Image extensions.** The regen picks `.png` from the local scans where the committed files carry `.jpg` (the
  handoff's
  "image extensions" drift). Do not accept those hunks; regenerate with the committed extension behavior or revert them.
- **Parser drift.** The regen is the newer parser. The committed files split a bulleted "for each resource icon" body
  into
  several `-constant` abilities; the regen keeps it in the one triggered ability:
  - 46032 Eye of Sauron: committed `[when-revealed, the-eye-of-sauron-constant .. -constant-4]`, regen
    `[when-revealed]`.
  - 47012 Husk: committed `[husk-interrupt, husk-constant, -2, -3]`, regen `[husk-interrupt]`.
  - 49004 Magneto's Armor: committed `[response, constant, -2, -3]`, regen `[response]`.
  - 48004 Kurt's Cutlasses ("Counts as 2 restricted cards."): committed `[constant, constant-2]`, regen
    `[constant]` plus `restrictedWeight: 2` (the Wave 7 `PlayerCard.restrictedWeight` field, docs/phase7-wave7.md
    §3.82).
    The regen is the better data.
  - A grep of `packages/cards/src`, `engine` and `client` found no reference to the changed ability ids (matches were
    other cards), so nothing breaks today.

Do the regen once, in the step that renames the cycle, and review these four diffs by hand.

## 3. Errata: seven cards where printed and current text differ

RRG 1.8 page 69 (printed page 69; PDF index 68). **The markdown conversion scrambles this page's columns**: it files
Rogue (#1B), Energy Transfer (#7), Mystique's Manipulations (#26) and Bonebreaker (#31) under "AGE OF APOCALYPSE
EXPANSION" (md lines 5058 to 5072), but on the printed page those are under the **Rogue Hero Pack** heading. I checked
the page image (checked). The real cycle 8 entries on that page:

| Card                   | Pack       | RRG entry (printed p. 69)                                                                         | Raw MarvelCDB state                                                                                                           | Direction for `Errata`                                                                                                            |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 45017 Suit Up          | `aoa`      | "can be attached to that ally" becomes "can be attached to an ally"                               | `text == real_text`, no `errata`: reads **"that ally"** (the printed wording)                                                 | `currentReplace` (raw is the print)                                                                                               |
| 45171a Mission Team    | `aoa`      | first bullet: add "this phase" ("...next ally played to the mission this phase by 2")             | `errata` "Added “this phase”. (RRG 1.6)"; raw text is the **current** wording                                                 | `printedReplace` (raw is current)                                                                                                 |
| 48012 Rogue            | `ncrawler` | "printed THW and ATK" becomes "base THW and ATK"                                                  | no `errata`; raw reads **"printed THW and ATK"** (the print)                                                                  | `currentReplace`                                                                                                                  |
| 48037 Tweedledope      | `ncrawler` | "Removed the star icon from this card's boost field"                                              | no `errata`; `boost_star: false`, no Boost text, so raw is current; **scan 48037.jpg prints the star** bottom right (checked) | the star is the has-Boost marker (`context.ts` line 163 to 169); record the print difference in the `Errata` note, no text change |
| 49010 Magnetic Missile | `magneto`  | cost arrow becomes "Then": "Discard a minion with Wrapped in Metal attached. Then, deal 5 damage" | no `errata`; raw reads "attached → deal 5 damage" (the print)                                                                 | `currentReplace`                                                                                                                  |
| 49023 Deft Focus       | `magneto`  | "Classification should be Basic instead of Protection"                                            | `faction_code: basic` (current); `duplicate_of_code: 16024`                                                                   | classification change; no precedent found (gap 12)                                                                                |
| 49028 Exodus           | `magneto`  | add "for that attack": "discard cards ... equal to his total ATK for that attack"                 | no `errata`; raw reads "equal to his total ATK" (the print)                                                                   | `currentReplace`                                                                                                                  |

All five emitted-pack cards (48012, 48037, 49010, 49023, 49028) have `text.printed == text.current` today (the four
curations all say `errata: []`), which breaks the printed-versus-current rule. 45017 and 45171a go in the `aoa`
curation.
One wording question on Suit Up: the raw print ends "(Shuffle.)" and the RRG "should read" ends "Add them to your hand."
without it; whether the shuffle reminder was dropped or just not quoted is **unchecked** (scan `45017.png` exists).

Also on page 69, outside this cycle: Inhibitor Collar (#92) and Front Line Specialist (#36) (wave 7), Pool-ized (#41)
(wave 7), and Magnetic Missile and Exodus above. The page does not list anything for Iceman or Jubilee.

FAQ, RRG 1.8 page 64 (md lines 4682 to 4694, "AGE OF APOCALYPSE EXPANSION", heading position confirmed by the section
order): four Q and A on Magik 45030a (when the next card turns faceup; playing the top card through "play a card from
your
hand" effects; "after you play [card] from your hand" triggers; putting into play is not playing). Script match of every
card title in the five caches against the RRG markdown found no other hit on a cycle 8 card, except:

- **Powerful Punch (#14) FAQ** (md lines 4602 to 4608, Shadowcat's flip timing) belongs to the Shadowcat pack's card
  (`mut_gen` 32014). Nightcrawler's 48017 Powerful Punch is its reprint (`duplicate_of_code: 32014`), so the FAQ applies
  to
  it too.
- White Queen (#56) FAQ is the Mutant Genesis minion (32056), not the basic ally 49021.
- Fabian Cortez (#159) FAQ is a Mutant Genesis card, not the Hellfire-adjacent minion 49030.

Post-RRG-1.7 rulings, same script against `marvel-champions-rulings-post-rrg-1-7.md`:

| Heading               | Card                       | Point                                                                                                                                                                                                                             |
| --------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| April 30, 2026 (4)    | AoA campaign               | (1) Digging Deep (a `next_evol` card) discarded in a mission attempt: use its Response, it does not count, no replacement; (2) Prelate versions stay available for the Apocalypse scenario when their Overseer is struck.         |
| February 20, 2026 (4) | Cruel Experiment 45124     | an attachment with no "attach to" text attaches when its When Revealed triggers. The `Correction.impliedAttachHost: "ownWhenRevealed"` shape already cites this ruling.                                                           |
| June 2, 2026 (1)      | Jubilee / Wolverine +2 ATK | targets the chosen enemy, stacks per instance, same for Cameo and ally versions. Which card text it reads is **unchecked** (candidates: 47001 identity, 47002 Wolverine, 47022 Unlikely Duo).                                     |
| July 9, 2026 (1)      | Powerful Punch             | redirecting an attack does not retroactively satisfy Spider-Sense; applies to 48017 as a reprint.                                                                                                                                 |
| January 17, 2026 (5)  | Face the Past 49022        | in The Wrecking Crew only the active villain's encounter deck exists; a found nemesis goes to that deck's discard. Magneto's basic event 49022 is the card. Unchecked that it is the same card (no `duplicate_of_code` on 49022). |

No ruling conflicts with the RRG that I found. The sources doc misses the Cruel Experiment ruling, the Digging Deep half
of the April 30 ruling, Face the Past and Powerful Punch.

### Corrections to the sources doc (`phase7-wave8-sources.md`)

1. Section 3.2 errata table lists Rogue #1B, Energy Transfer #7, Mystique's Manipulations #26 and Bonebreaker #31 as Age
   of Apocalypse errata. They are Rogue Hero Pack errata (wave 6). It omits the real seven (table above) and states
   "Suit Up
   (#17)" and "Mission Team (#171A)" nowhere.
2. Section 5 pack counts are record-including-linked counts (226 / 33 / 41 / 39 / 43); top-level counts are 195 / 32 /
   40 /
   38 / 42.
3. Section 5 gives Iceman's identity as "Rapid Teleportation Interrupt (attach Frostbite during basic attack/defense)".
   Raw text: **"Freeze!" Interrupt: when Iceman makes a basic attack or defense against an enemy, attach a set-aside
   copy of
   Frostbite to that enemy.** "Rapid Teleportation" is Nightcrawler's. Section 5's Jubilee, Nightcrawler, Magneto,
   Bishop and
   Magik identity summaries agree with raw (Magik's "each phase ... reducing cost by 1" is "once per phase").
4. Section 2 says the markdown has pages 9 to 10, 13 and others as rules text; they are comic pages.

## 4. `aoa` in detail

### 4.1 Raw records by encounter set and card type

195 top-level records, codes 45001a to 45186c, pack name "Age of Apocalypse", wave 8 (`pack_wave`), `fetchedAt`
2026-09-13. 31 of the 195 carry a nested `linked_card` (the b face), so 226 faces in all. By type (counted by script):
hero 2, ally 14, upgrade 12, event 15, resource 6, support 4, obligation 5, minion 34, side scheme 28, treachery 23,
villain 18, main scheme 12, attachment 18, environment 4. By faction: hero 21, leadership 9, aggression 7, basic 10,
campaign 6, encounter 142. Sum of `quantity` over top-level records is 279.

Cross-check with the rulebook p. 2 ("271 cards, consisting of 91 player cards, 15 villain cards, and 165 encounter
cards"), by script:

- Player: 82 copies on the non-campaign player-side records plus 9 copies on the six `campaign` faction records =
  **91**.
  Matches.
- Villain: 18 raw villain records are **15 physical cards** (Unus 3, Dark Beast 3, Horsemen 4, Apocalypse 2, En Sabah
  Nur 3;
  each En Sabah Nur card is three records). Matches.
- Encounter: 188 copies minus 18 villain records minus 6 duplicate main scheme records (below) = **164, one short of
  165**. The missing physical card is almost certainly the double-sided **Mission Rules** card (rulebook p. 5 and 6),
  which
  MarvelCDB does not carry as a record (grep of names found none). That is an inference from the count, not a check.

Set table (`card_set_code`; "recs" are top-level records, "copies" the sum of `quantity`):

| Set (`card_set_code`) | Name                | Recs | Copies | Codes            | Types                                                                        |
| --------------------- | ------------------- | ---- | ------ | ---------------- | ---------------------------------------------------------------------------- |
| `bishop`              | Bishop              | 11   | 17     | 45001a to 45025  | 3 upgrade, 3 event, 2 ally, 1 hero, 1 resource, 1 obligation                 |
| `bishop_nemesis`      | Bishop Nemesis      | 4    | 5      | 45026 to 45029   | 2 minion, 1 side scheme, 1 treachery                                         |
| `magik`               | Magik               | 12   | 17     | 45030a to 45053  | 5 event, 3 upgrade, 1 hero, 1 ally, 1 support, 1 obligation                  |
| `magik_nemesis`       | Magik Nemesis       | 5    | 5      | 45054 to 45058   | 3 minion, 1 side scheme, 1 treachery                                         |
| null (aspect, basic)  | -                   | 26   | 50     | 45011 to 45052   | 7 ally, 7 event, 5 upgrade, 5 resource, 2 support                            |
| `unus`                | Unus                | 11   | 15     | 45059 to 45068   | 3 villain, 3 attachment, 2 main scheme, 1 minion, 1 treachery, 1 side scheme |
| `infinites`           | Infinites           | 3    | 8      | 45069 to 45071   | 1 minion, 1 treachery, 1 side scheme                                         |
| `dystopian_nightmare` | Dystopian Nightmare | 3    | 6      | 45072 to 45074   | 1 obligation, 1 treachery, 1 side scheme                                     |
| `standard_iii`        | Standard III        | 6    | 8      | 45075a to 45080  | 4 treachery, 1 environment, 1 obligation                                     |
| `four_horsemen`       | Four Horsemen       | 17   | 21     | 45081a to 45096  | 5 treachery, 4 villain, 4 side scheme, 2 main scheme, 2 attachment           |
| `hounds`              | Hounds              | 4    | 7      | 45097 to 45100   | 2 minion, 1 attachment, 1 side scheme                                        |
| `apocalypse`          | Apocalypse          | 12   | 16     | 45101a to 45111  | 4 attachment, 3 side scheme, 2 villain, 2 main scheme, 1 treachery           |
| `dark_riders`         | Dark Riders         | 6    | 6      | 45112 to 45117   | 5 minion, 1 side scheme                                                      |
| `dark_beast`          | Dark Beast          | 10   | 14     | 45118 to 45126   | 3 villain, 3 attachment, 2 main scheme, 1 treachery, 1 side scheme           |
| `savage_land`         | Savage Land         | 6    | 8      | 45127 to 45132   | 3 minion, 1 environment, 1 treachery, 1 side scheme                          |
| `genosha`             | Genosha             | 6    | 8      | 45133 to 45138   | 3 minion, 1 environment, 1 attachment, 1 side scheme                         |
| `blue_moon`           | Blue Moon           | 8    | 8      | 45139 to 45146   | 5 minion, 1 environment, 1 attachment, 1 side scheme                         |
| `en_sabah_nur`        | En Sabah Nur        | 17   | 21     | 45147 to 45186c  | 6 villain, 4 main scheme, 3 treachery, 3 side scheme, 1 attachment           |
| `celestial_tech`      | Celestial Tech      | 3    | 4      | 45156 to 45158   | 2 attachment, 1 treachery                                                    |
| `clan_akkaba`         | Clan Akkaba         | 5    | 7      | 45159 to 45163   | 3 minion, 1 treachery, 1 side scheme                                         |
| `age_of_apocalypse`   | Age of Apocalypse   | 2    | 4      | 45164 to 45165   | 1 minion, 1 treachery                                                        |
| `aoa_mission`         | Mission             | 5    | 5      | 45166a to 45170a | 5 side scheme                                                                |
| `aoa_basic_campaign`  | Campaign            | 6    | 9      | 45171a to 45176  | 4 ally, 1 support, 1 upgrade (faction `campaign`)                            |
| `aoa_campaign`        | Campaign            | 2    | 5      | 45177 to 45178   | 1 side scheme, 1 obligation (faction `encounter`)                            |
| `overseer`            | Overseer            | 5    | 5      | 45179a to 45183a | 5 minion (the b faces are set `prelates`, section 4.7)                       |

Totals: 25 groups (24 named sets and the null group) summing to 195 records. Nine records among the null group carry
`duplicate_of_code`: 45013 (04016), 45018 (01070), 45019 (01072), 45022 to 45024 (01088 to 01090), 45046 (18012), 45047
(01055), 45052 (15019).

Obligations (5 records): 45025 Fear the Future (`bishop`), 45053 Darkchilde (`magik`), 45072 Hunted x2
(`dystopian_nightmare`), 45080 Drawing Near (`standard_iii`), 45178 Panicked Refugees x4 (`aoa_campaign`). Hero-kit
obligations 45025 and 45053 should come out `encounterSetIds: []` by the wave 6 rule; 45072, 45080 and 45178 should keep
their set. Confirm at emit.

Main scheme records come as pairs: an unsuffixed record (carries the threat numbers; `double_sided: true`) and an
`a` record (carries the Contents and Setup text, with the nested b face): 45062 and 45062a, 45085 and 45085a, 45103 and
45103a, 45121 and 45121a, 45147 and 45147a, 45148 and 45148a. 6 pairs, 12 records, 6 stages (the normalizer merges them
as in Wave 7).

### 4.2 Heroes and card ranges

- **Bishop (45001a/b, Lucas Bishop).** Hero 12 HP, hand size 5, THW 2 / ATK 2 / DEF 1, traits Temporal and X-Men;
  alter-ego 12 HP, hand size 6, traits Mutant and Temporal; matches the rulebook p. 2 callout (rulebook, not scan).
  Signature 45002 to 45010 (9 records, 15 copies: Malcolm, Randall, Bishop's Rifle, Bishop's Uniform, Super-Charged x2,
  Concussive Blast x2, Command Authority x2, Energy Conversion x2, Stored Energy x3). Obligation 45025, nemesis set
  `bishop_nemesis` 45026 to 45029 (Trevor Fitzroy, Portal Through Time, Bantam, Temporal Trickery x2).
- **Magik (45030a/b, Illyana Rasputina).** Hero 10 HP, hand 5, THW 1 / ATK 2 / DEF 2, Mystic and X-Men; alter-ego 10 HP,
  hand 6. Signature 45031 to 45040 (10 records, 15 copies). Obligation 45053 Darkchilde, nemesis `magik_nemesis` 45054
  to
  45058 (Belasco, Ruler of Limbo, S'ym, Witchfire, Battle for Limbo).
- Aspect and basic (null set): Leadership 45011 to 45019 (Cable, X-23, Team Training x3, Advanced Suit x3, Sidekick,
  Side-by-Side x3, Suit Up x3, Lead from the Front x3, The Power of Leadership x2), Aggression 45041 to 45047, basic
  45020 to 45024 (Legion, Marrow, Energy, Genius, Strength) and 45048 to 45052 (Triage, Stepford Cuckoos, Bloodgem,
  Basic Spell x3, Spiritual Meditation x3).
- 45015 Sidekick is a Title upgrade with "Max 1 per deck" (raw `deck_limit: 1`).

### 4.3 The five scenarios (rulebook `mc45_age_of_apocalypse.md`; scenario headings p. 8, 11, 14, 16, 19)

"Required" means the rulebook says the set cannot be removed. The rulebook markdown has no per-scenario page for the
setup text beyond the Campaign Instructions; the Contents and Setup lines come from each scenario's `a` main scheme
record
in raw. The scenario pages' set lists were read from the markdown only (unchecked on the PDF). Of the pages the markdown
calls "full-page graphic" I opened page 9 only (a comic page); the other seven are unchecked.

Common to all five: Standard set (Core) and the Expert set in expert mode; the rulebook p. 3 allows the Standard III
set in place of Standard ("approximately the same difficulty"). Campaign mode only: shuffle the `age_of_apocalypse` set
in, randomly choose a mission, an Overseer, put the Mission Rules card and Mission Team (45171a) into play, each player
searches their deck for an ally and adds it to hand (p. 8, 12, 14, 16, 20).

| #   | Scenario (our id)               | Villain deck (standard / expert)                                       | Main scheme                                                | Own and required sets                                                        | Modular (removable)                        | Setup, from the main scheme's Contents and Setup text                                                                                                                                                                          |
| --- | ------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Unus (`unus`)                   | Unus I (45059), II (45060) / II, III (45061)                           | Hunting Gene Traitors 45062                                | `unus`, `infinites` (required), Standard                                     | `dystopian_nightmare` (one set)            | Reveal Gene Pool (45071, Permanent and Setup). Expert: deal each player a facedown encounter card.                                                                                                                             |
| 2   | Four Horsemen (`four-horsemen`) | War, Famine, Pestilence, Death, side A / side B                        | The Horsemen of Apocalypse 45085                           | `four_horsemen`, Standard                                                    | `dystopian_nightmare`, `hounds` (two sets) | Shuffle the four Horsemen, reveal them left to right, active counter on the leftmost. Each player reveals a random Four Horsemen side scheme.                                                                                  |
| 3   | Apocalypse (`apocalypse`)       | Apocalypse II, III / III (rulebook; "begin with I" for an easier game) | The Age of Apocalypse 45103                                | `apocalypse`, `prelates` (see 4.7), Standard                                 | `dark_riders`, `infinites` (two sets)      | Set aside each unused villain card, each Prelate minion, and The Tyrant's Throne. Reveal Heart of the Empire. First player reveals a random set-aside Prelate.                                                                 |
| 4   | Dark Beast (`dark-beast`)       | Dark Beast I, II / II, III (45118, 45119, 45120)                       | Dark Beast's Bogus Journey 45121                           | `dark_beast`, `blue_moon`, `genosha`, `savage_land` (all required), Standard | `dystopian_nightmare` (one set)            | Set Blue Moon, Genosha and Savage Land aside, including their environments. Expert: reveal High-Tech Goggles 45122. Dark Beast's When Revealed reveals a random set-aside environment and shuffles the rest of its set in.     |
| 5   | En Sabah Nur (`en-sabah-nur`)   | Apocalypse I, II / II, III (three-sided, 45184 to 45186)               | En Sabah Nur's Pyramid 45147, The Rise of Apocalypse 45148 | `en_sabah_nur`, Standard                                                     | `celestial_tech`, `clan_akkaba` (two sets) | Apocalypse begins in Biomorph form. Deal each player a facedown encounter card. Clan Akkaba holds Ancient Ritual (Permanent and Setup). Campaign: reveal Protect the Professor (45170); Professor X cannot enter play (p. 20). |

Scenario shape notes for the curation (shapes that exist in `curation/types.ts`):

- **Scenario 2** has four villains in play, one at a time active (the active counter passes right after each
  activation).
  `multipleVillains` (the Wrecking Crew shape) with `villainCardCodes` fits the four, `encounterDecks: "shared"`. Each
  Horseman is one physical A/B card whose two faces print different stages ("A" and "B"), so the normalizer already
  makes
  each face its own one-stage card (`versionPairs`, the `mut_gen` Mansion Attack shape): 8 villain cards in all. The
  expert switch is per villain A to B, with "a mix" allowed by players (rulebook p. 11); `expertVillains` takes one
  villain code, so it cannot express four swaps (gap 15). Defeating a villain needs another villain to have 0 hit points
  ("cannot be defeated while another villain has at least 1 hit point"), so the win is on the last villain.
- **Scenario 3.** The chain is one villain with four stages over two physical cards: 45101a I (HP 8), 45101b II (HP 9),
  45102a III (HP 10), 45102b IV (HP 11), all per hero; the normalizer already builds this (comment in `villains.ts`
  line ~180, "Age of Apocalypse's Apocalypse, 45101 I/II and 45102 III/IV"). I checked the scans of 45101b, 45102a and
  45102b: II reads "Steady. Toughness. ... Remove this card from the game and reveal Apocalypse (III)", III "Steady.
  Toughness. ... Flip this card and reveal Apocalypse (IV)", IV "Stalwart. Toughness. [star] Apocalypse's attacks gain
  overkill. Forced Interrupt: When the main scheme is completed, the players lose the game." (IV's ATK shows 3 with a
  star, SCH 3). The difficulty entry points are not in `villainStages` shape: standard starts at II, expert at III, easy
  at I (open question 5).
- **Scenario 5.** Three-sided Apocalypse: each of I, II, III is one physical card, records `a` (Biomorph) plus nested
  `b`
  (Cyberpath) plus an unlinked `c` (Giant). Already supported ("three-sided" branch in `villains.ts`; the survey raises
  no villain error). Starting stats from raw: I 45184 (ATK 2, HP 16 per hero), II 45185 (ATK 3, HP 20), III 45186 (ATK
  3,
  HP 24); SCH 1 / 2 / 3 by form. The forms' Forced Responses on change (indirect damage, threat on each scheme, heal)
  are scripting.
- **Scenarios 1, 4**: single-card villains per stage (Unus I to III, Dark Beast I to III), no a/b. Standard stages
  `[1,2]`, expert `[2,3]` as `mut_gen`.
- **Mission** content is not scenario data: it is the `age_of_apocalypse` set plus the four available `aoa_mission` side
  schemes plus `overseer`, set up by the campaign instructions (4.5).

Main scheme numbers as raw carries them (**unchecked** except 45103b): 45062 target 11 per hero, start 0 (fixed),
acceleration 1 with `escalation_threat_star`; 45085 target 12, start 0, acceleration 1; 45103 target "X" (raw `-1`),
start 1 per hero, acceleration 1; **checked on scan 45103b**: top-left badge "X per hero", "+1 per hero", "1 per hero";
45121 target 10, start 1; 45147 target 8, start 1, star; 45148 target 10, start 1, star. The normalizer reads `-1` as
a non-numeric variable (`main-schemes.ts` line ~241); confirm at emit.

### 4.4 Modular sets

Besides the five scenario-owned sets (`unus`, `four_horsemen`, `apocalypse`, `dark_beast`, `en_sabah_nur`), the box has
nine ordinary modular sets (`infinites`, `dystopian_nightmare`, `hounds`, `dark_riders`, `blue_moon`, `genosha`,
`savage_land`, `celestial_tech`, `clan_akkaba`), `standard_iii` (a Standard-set replacement), the campaign-only sets of
4.5, and the `prelates` faces. Of these:

- Required by a scenario but "may be used in other scenarios": `infinites` (scenario 1; also modular in 3),
  `blue_moon`, `genosha`, `savage_land` (scenario 4). Treat as ordinary modular sets listed in
  `additionalEncounterSetCodes`. (Compare Wave 7's Flight / Super Strength / Telepathy.)
- Removable modular: `dystopian_nightmare` (1, 2, 4), `hounds` (2), `dark_riders` (3), `celestial_tech` and
  `clan_akkaba` (5).
- `prelates`: the five b faces of the Overseer minions; required in scenario 3, but there is no top-level record in this
  set
  (4.7).
- **Permanent and Setup side schemes** in sets: Gene Pool (45071), Ancient Ritual (45163); and Pursued by the Past
  (45075a,
  environment) in `standard_iii`. The set-aside, reveal-at-setup and flip behaviors are scripting.
- **Setting environments** (`savage_land` 45127, `genosha` 45133, `blue_moon` 45139): Setup keyword, "Special" ability,
  Setting trait, "When Revealed: Discard each other Setting environment in play". Dark Beast's scenario text refers to
  "the Setting environment's Special"; scripting.
- `hounds` (Ahab 45097, Hound x4 45098, Ahab's Energy Spear 45099, Release the Hounds 45100): the Hound's When Revealed
  changes the identity to hero form; scripting.

### 4.5 Campaign cards and the mission cards

The rulebook (p. 4) says "Cards 164-183 are cards that were created specifically for use in the Age of Apocalypse
campaign. Cards 171-176 are player campaign cards". That maps onto four campaign sets plus the Overseer set:

| Set                  | Codes            | What                                                                                                                                                                                             |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `age_of_apocalypse`  | 45164, 45165     | Agent of Apocalypse (minion x2), Worldwide Crisis (treachery x2): shuffled into the encounter deck in scenarios 1 to 4                                                                           |
| `aoa_mission`        | 45166a to 45170a | five Mission side schemes: Liberate the Seattle Core (1/5), Evacuate Survivors (2/5), Sabotage the Sea Wall (3/5), Find Lost Mutants (4/5), Protect the Professor (5/5, reserved for scenario 5) |
| `aoa_basic_campaign` | 45171a to 45176  | the six faction-`campaign` player cards: Mission Team 45171a/b (support), Destiny 45172, Blink 45173, Morph 45174, X-Man 45175 (campaign allies), Desperate Measures 45176 (upgrade x4)          |
| `aoa_campaign`       | 45177, 45178     | North American Sea Wall (side scheme), Panicked Refugees (obligation x4)                                                                                                                         |
| `overseer`           | 45179a to 45183a | Mister Sinister, The Shadow King, Abyss, Sugar Man, Mikhail Rasputin (a faces; b faces are the Prelates)                                                                                         |

Only `aoa_basic_campaign` is detected as campaign-specific automatically (faction `campaign`); the other four sets have
faction `encounter`, so they need `EncounterSetCuration.campaignSpecific: true` (gap 11). The player cards 45171a to
45176
are "BASIC / CAMPAIGN" on the card (scan 45171a, checked) and cannot be in any deck outside the campaign.

Mission side scheme a faces (all five read the same Forced Response and When Defeated; scan 45166a **checked**):
starting
threat **5 per hero**, trait Mission, the card number "1/5" at the bottom. The b face ("Finished.") flips with the
reward
text. Raw `base_threat: 5`, not fixed. The b faces are typed `side_scheme` with no threat, which is the survey's five
"side
scheme without starting threat" lines (4.8).

Mission rewards, copied from the log (PDF p. 24, **checked**):

| Mission (a face)          | Setup                                                    | Defeated                                                                                                                            | Not defeated                                                                                  |
| ------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Liberate the Seattle Core | set each copy of Desperate Measures aside                | for the rest of the campaign each player may shuffle 1 Desperate Measures into their deck each game (outside the minimum deck size) | remove each copy of Desperate Measures                                                        |
| Evacuate Survivors        | each player shuffles a Panicked Refugees into their deck | remove each Panicked Refugees; each player picks an upgrade from any aspect and may include 1 copy (outside the minimum)            | each player must shuffle a Panicked Refugees into their deck at the start of each game        |
| Sabotage the Sea Wall     | shuffle North American Sea Wall into the encounter deck  | remove North American Sea Wall; each player picks a support from any aspect, may include 1 copy                                     | shuffle North American Sea Wall into the encounter deck at setup for the rest of the campaign |
| Find Lost Mutants         | set each campaign ally aside                             | each player chooses a campaign ally and may include it in their deck for the rest of the campaign                                   | remove each campaign ally from the campaign                                                   |

The log also has four identity lines, "Remaining hit points" per player (expert only; capped at base HP), and
checkboxes for the five Overseers (Mister Sinister, The Shadow King, Abyss, Sugar Man, Mikhail Rasputin on the sheet).
Mission availability is by name struck from the log (rulebook p. 5); Overseer availability likewise, but Prelate
versions stay available for scenario 3 when the Overseer is struck (ruling, April 30, 2026 (4)). In the campaign:
scenarios
1 to 4 draw a random available mission 1/5 to 4/5, scenario 5 uses 5/5 and a win depends on defeating it (p. 20);
a lost scenario can be reset with no penalty. Persistent damage and the "place 3 threat on the mission to heal" rule
are expert-only. There is no Prohibited Card or prohibited set text in the rulebook (grep of the markdown found none),
so
`Campaign.prohibited` stays unset. A hand-authored `campaign.ts` follows `next_evol/campaign.ts` (`boxCode: "MC45"`,
five
scenario ids, `campaignSetIds` for the four sets plus `overseer`, `logSheetReference:
"docs/campaign-modes/log-sheets/mc45_age_of_apocalypse_campaign_log.pdf"`, which exists). The campaign log's reward
effects on deck building (extra copies outside the minimum, forced shuffles) are a progression question, not card data
(gap 19).

### 4.6 Suspect or missing MarvelCDB text (card codes)

Raw text was checked by script against a dictionary plus every card name in the 57 other raw packs. No misspelling was
found in `aoa` text (flagged words were proper nouns or contractions only). Items that need action:

| Code(s)                      | Raw state                                                                                                                                                              | Status                                                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 45017 Suit Up                | raw is the pre-errata wording ("that ally")                                                                                                                            | errata, section 3                                                                                                                                                                                                                                |
| 45171a Mission Team          | raw is the post-errata wording; **scan checked**: print reads "Reduce the cost of the next ally played to the mission by 2." (no "this phase") and has **no cost box** | errata (printed replace) and `specialCost: "dash"`                                                                                                                                                                                               |
| 45129 Velociraptor           | **no `scheme` in raw**; **scan checked**: SCH **1**, ATK **1 star**, 3 HP, boost 3                                                                                     | raw data error; `Correction` has no minion `scheme` field, so a `cardNotes` entry would record the wrong meaning (a dash or zero); gap 1                                                                                                         |
| 45104a Heart of the Empire   | `linked_card` is **45105b** (No Longer Worthy), the same b face as 45105a The Tyrant's Throne                                                                          | raw bug. Rulebook p. 14: No Longer Worthy sits "on the reverse side of The Tyrant's Throne". Heart of the Empire's own reverse is in neither raw nor the scans (`45104b` has no file). **Scan 45104a checked**: threat 2, "Flip this card over." |
| 45179a to 45183a (Overseers) | no `attack`, no `scheme` in raw                                                                                                                                        | printed dashes: **checked** on 45179a (SCH and ATK badges empty, 5 per hero HP); the p. 5 rulebook callout shows "ATK -" and "SCH -" for 45182a. 45180a, 45181a, 45183a **unchecked** (same layout)                                              |
| 45103 / 45103a main scheme   | target threat `-1`                                                                                                                                                     | "X" (checked, scan 45103b); handled by the normalizer's non-numeric rule                                                                                                                                                                         |
| 45062, 45147, 45148          | `escalation_threat_star: true`                                                                                                                                         | **unchecked** what the star printed is (the Forced Response on each begins with a star)                                                                                                                                                          |
| 45184c, 45185c, 45186c       | the Giant faces, unlinked, no `imagesrc`                                                                                                                               | by design (three-sided villain); scans exist                                                                                                                                                                                                     |
| 45084a Death                 | raw traits "Aerial. Horsemen."; the rulebook p. 12 callout shows only "HORSEMEN."                                                                                      | **scan checked**: prints "AERIAL. HORSEMEN."; raw is right, the markdown callout is truncated                                                                                                                                                    |
| 45059 to 45061 Unus          | raw "Unus also gains a [amplify] icon"; rulebook p. 2 callout reads "Unus gains the [star] icon"                                                                       | **unchecked**; the p. 2 callout is a preview, the amplify icon is a star-shaped icon; read the scan at emit                                                                                                                                      |

Missing text by design: 45062a, 45085a and the other `a` stage records of the main schemes hold the Contents and Setup,
the
unsuffixed records hold the numbers (as Wave 7). Resources (45010, 45019, 45022 to 45024, 45047) have no text.

Unchecked, worth a pass at emit: 45171b Mission Team's b face ("choose a player to draw 1 card"), 45177 North American
Sea Wall ("Hinder 2[per_hero]. Surge. Victory 2." and "[star] Boost: Deal this card to yourself as a facedown encounter
card"), 45164 Agent of Apocalypse ("add Agent of Apocalypse to the mission area" in its When Revealed), 45065 Infinite
Hunter, 45134 Magistrate ("finds Escaped Mutant and attaches it to their identity").

### 4.7 Double-sided and multi-face cards

The 31 records with a nested `linked_card`, by kind:

- **Identity pairs (2):** 45001a/b, 45030a/b.
- **Main scheme stages (6):** 45062a, 45085a, 45103a, 45121a, 45147a, 45148a, each linked to its b face (and each paired
  with an unsuffixed numbers record).
- **Villains (9):** four Horsemen a/b pairs (45081a to 45084a; versions A and B, section 4.3); two Apocalypse pairs
  (45101a/b = I and II, 45102a/b = III and IV); three En Sabah Nur a/b pairs (45184a to 45186a) each with a third
  top-level
  `c` record (45184c, 45185c, 45186c) for the Giant face.
- **Two-state encounter cards (5):** 45075a/b Pursued by the Past (environment to environment, flips on the pursuit
  counters), 45104a Heart of the Empire (link bug, section 4.6), 45105a The Tyrant's Throne (side scheme to the No
  Longer
  Worthy attachment 45105b), 45171a/b Mission Team (support to support).
- **Mission side schemes (5):** 45166a to 45170a, each linked to a "Finished." b face (side scheme, no threat).
- **Overseer / Prelate minions (5):** 45179a to 45183a. The **b face is a different encounter set, `prelates`** (card
  set
  name "Prelates", faction encounter, type minion, trait Prelate). The Overseer a faces (ATK and SCH dashes, Victory 5,
  mission-area behavior, Mission Response) are used only in campaign mode in the mission area; the Prelate b faces (real
  ATK and SCH, Victory 3, engage the first player) are what scenario 3 and standalone play use. `normalizeEncounterSets`
  builds sets from top-level records only (`encounter-sets.ts` lines 22 to 30), so `prelates` is not created and the b
  faces would land in `overseer` (gap 7).

### 4.8 What `survey.ts --pack aoa` reports today

It runs without a curation file (bare curation; no file created) and exits 0: "0 normalize cleanly, 1 do not", 20 lines,
by cause:

| Lines | Codes                                                      | What it needs                                                                                                             |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 10    | 45179a to 45183a (ATK and scheme, two lines each)          | printed dashes: `cardNotes` entries (precedent `mut_gen` 32080); checked on 45179a only                                   |
| 1     | 45129                                                      | raw is missing SCH 1 (4.6); needs a numeric correction, not `cardNotes`                                                   |
| 5     | 45166b to 45170b "side scheme without starting threat"     | the "Finished." b faces carry no threat; no dash field exists for side schemes (`dashedThreatFields` is main scheme only) |
| 1     | 45015 Sidekick                                             | "Attach to an identity-specific ally you control." not recognized (host shape; gap 2)                                     |
| 1     | 45124 Cruel Experiment "attachment without an attach rule" | `impliedAttachHost: "ownWhenRevealed"` (ruling February 20, 2026 (4))                                                     |
| 1     | 45124 "record never turned into a card"                    | consequence of the line above; clears with it                                                                             |
| 1     | 45171a Mission Team "support without a cost"               | `specialCost: "dash"` (scan checked: no cost box)                                                                         |

Not reported, but found by other means: the 45104a link bug (raw data); `Mission Response` text (below); the `prelates`
set
(no error, the set is silently missing); the 45017 errata (no error). **`Mission Response` mis-parses silently**: I
ran `parseCardText` on 45180a's text; it returned `constant` abilities for both "Cannot take damage while another minion
is
at the mission." and "Mission Response: After you discard cards, place 2 threat ...", with `unclassified: []`. `TRIGGER`
(`parse-text.ts` line ~165) has no `Mission Response` entry. Four Overseer a faces carry
one (45180a to 45183a); 45179a Mister Sinister has none.

### 4.9 Cards with no image, and scans

`imagesrc` is absent on 29 of the 195 top-level records: 45022 to 45024 (reprint basics); the `a` faces of the
double-sided
cards 45075a, 45081a to 45084a, 45101a/45102a, 45104a, 45105a, 45166a to 45171a, 45179a to 45183a; and the Apocalypse
faces 45184a/c, 45185a/c, 45186a/c. Counting nested b faces, 52 of 226 faces have no `imagesrc`. Local scans
(`assets/card-art/bundles/cards/`, gitignored) cover **every face except 45022, 45023 and 45024**, which are reprints
(`duplicate_of_code` 01088 to 01090); the emitted reprint basics point at the earlier print's image
(`48023` in `ncrawler` uses `01088.png`). `45104b` has no scan and no raw record (4.6). So `withLocalArt` resolves all
of
`aoa` except those three, as with Wave 7. Scans are not wired in as shippable data.

Hero art: `art/heroes/_pending/45001a-bishop/hero.png` and `45030a-magik/hero.png` now exist (modified 2026-10-07 14:11;
the handoff said "both empty"). The other heroes' folders hold `hero.webp` under `art/heroes/<code>-<slug>/`; the two
new
files are not yet moved or converted. Not opened here (unchecked). `art/campaigns/aoa/artboards/` is empty; the box's
eight
comic pages (7, 9, 10, 13, 15, 17, 18, 21) are in `art/campaigns/aoa/rulebook/`.

## 5. Per hero pack

### Common to all four

- No precon is curated: `starterDecks: []` in all four curations. Unlike the box, the hero packs' printed decklist is
  **not** in the repo and **cannot be derived from raw**: each pack's player-side copies exceed a 40-card deck (Iceman
  21
  hero + 15 aggression + 10 basic copies; Jubilee 15 + 14 justice + 12 basic + 3 + 3; Nightcrawler 15 + 20 protection +
  5
  basic + 3 + 3; Magneto 15 + 17 leadership + 15 basic). The Hall of Heroes Iceman page carries only a link labeled
  "Starter
  Deck" to an image (`.../wp-content/uploads/2024/07/img_3355.jpg`, fetched this session); the other three pages were
  not fetched. So the lists need the printed decklist card, as images to transcribe; as in Nebula's case
  (`curation/types.ts`, `quantityInSet` comment, "Hall of Heroes' `nebula-starter-deck.jpg`"). **Owner input needed.**
- Cycle name rename and the section 2 regen.
- No new card type or schema field is needed by the four hero packs. All four normalize with zero survey issues
  (`survey.ts --pack iceman --pack jubilee --pack ncrawler --pack magneto`: "4 normalize cleanly").
- Each pack has one extra encounter set besides the nemesis set: `sauron`, `arcade`, `crazy_gang`, `hellfire`. Emitted
  as `EncounterSet` with `packCodes` and no classification field in the file; whether they are modular sets in the
  rulebook sense is **unchecked** (no pack insert in the repo).
- 16 raw reprints (`duplicate_of_code`) in the four packs: Iceman 4 (46017 of 16043, 46021 of 12024, 46022 of 15031,
  46023
  of 13024), Jubilee 2 (47017 of 01062, 47020 of 38019), Nightcrawler 6 (48017 of 32014, 48019 of 01079, 48022 of 38018,
  and the basics 48023 to 48025 of 01088 to 01090), Magneto 4 (49023 of 16024 and the basics 49024 to 49026). Nine of
  them
  have no local scan: 47020, 48017, 48022, 48023, 48024, 48025, 49024, 49025, 49026 (with `aoa`'s three, 12 codes in the
  cycle). The rest have scans. The reprint path covers all of them.

### `iceman` (32 cards, 46001a/b to 46032)

- Hero: Bobby Drake / Iceman, hero 11 HP in alter-ego; "Freeze!" Interrupt attaches a set-aside Frostbite. Alter-ego:
  "begins the game with 6 Frostbite upgrades set aside", "Cool Off" Response (shuffle 1 Ice card per Frostbite in play).
- **Frostbite 46002** (x6 copies, `deck_limit: 6`, set `iceman_frostbite`) is aliased to Iceman by
  `auxiliaryHeroSetCodes`
  and gets `specialCost: "dash"`. The emitted card has `deckLimit: 6` and no separate-deck marker, so it is deckable as
  an
  ordinary card. The Storm Weather Deck precedent uses a `separateDecks` entry (`storm.ts` line ~107). Decision needed
  (gap 13).
- Player side scheme: 46018 Keep Up the Pressure (Victory 0; additional damage on Attack events). Aggression 46012 to
  46018,
  basic 46019 to 46023. Obligation 46024 Hot-Headed; nemesis 46025 to 46028 (Pyro, Playing with Fire, Pyro's
  Flamethrower,
  Burn! x2); Sauron set 46029 to 46032 (Sauron, Sauron Lives!, Life Drain, The Eye of Sauron x3).
- No errata. No Team-Up. 46032 regen drift (section 2).

### `jubilee` (40 cards, 47001a/b to 47034)

- Hero: Jubilation Lee / Jubilee; "Like, totally!" Resource ability (exhaust to generate a wild resource); alter-ego 9
  HP,
  "Mall Rat" Action puts Shopping Spree into play.
- **Three versions per signature card**: Firecracker 47007a/b/c, Flash of Light 47008a/b/c, Plasmoid Energy 47010a/b/c.
  Same position 7, 8 and 10, same text; they differ only in resource icons (Firecracker: energy, mental, physical;
  Plasmoid:
  energy+mental, energy+physical, mental+physical). All nine are emitted as separate cards, `deckLimit: 1` each. A
  title-level
  "copies of this card" rule across the three versions is **unchecked** (open question 9).
- Player side schemes: 47003 Shopping Spree (hero set) and 47016 Generation X (justice). Ally 47002 Wolverine (hero set,
  piercing attacks). Team-Up: **47022 Unlikely Duo** ("Team-Up (Jubilee and Wolverine)", basic event, Max 1 per deck;
  section 7). Reprint 47017 The Power of Justice, 47020 X-Gene.
- Obligation 47023 Grounded; nemesis 47024 to 47027 (Nanny, Naughty Children, Battle Suit, "Lost" Child x2); Arcade set
  47030 to 47034 (Arcade, three Trap! side schemes with Hinder 1 per hero, Elaborate Trap). Raw also lists 47028 Mutant
  Mayhem
  (leadership, x3) and 47029 Serve and Protect (protection, x3) in the pack; whether the precon uses them is unknown
  (decklist needed).
- Ruling: June 2, 2026 (1), section 3. Regen drift: Husk 47012 (section 2).

### `ncrawler` (38 cards, 48001a/b to 48038)

- Hero: Kurt Wagner / Nightcrawler; "Rapid Teleportation" Action returns a copy of Bamf! (48006, x3 upgrade, cost 0)
  from
  the discard pile once per phase. Alter-ego: search for a Bamf! once per round.
- Protection 48012 to 48020 (Rogue 48012 ally, Northstar, Change of Fortune, Under Control, "Come Get Me, Bub!",
  Powerful
  Punch 48017, Riposte, The Power of Protection, player side scheme 48020 Astonishing X-Men). Basic 48021 to 48025
  (Gambit,
  Moira MacTaggert, three basics). Also 48031 Combine Forces (aggression), 48032 Gunboat Diplomacy (justice).
- Obligation 48026 Crisis of Faith; nemesis 48027 to 48030 (Azazel, Brimstone Dimension, Azazel's Sword, Brimstone
  Strike
  x2); Crazy Gang set 48033 to 48038 (side scheme, Queen of Hearts, Jester, Executioner, Tweedledope, "Off with His
  Head!").
- Errata: 48012 Rogue and 48037 Tweedledope (section 3). 48017 is a reprint of 32014; FAQ applies. Regen drift: 48004
  Kurt's
  Cutlasses.

### `magneto` (42 cards, 49001a/b to 49042)

- Hero: Erik Lehnsherr / Magneto, 10 HP alter-ego; "Magnetic Pull" Action discards until a Magnetic card, adds it to
  hand,
  once per round. Magnetic is a trait on cards (49002 to 49011); Magneto's Armor 49004's Response refers to the Magnetic
  Pull ability by name.
- **Linked allies.** 49033 Surge, 49034 Anole, 49035 Bling!, 49036 Indra: `Linked (New Recruits)`, trait New, raw
  `deck_limit` absent (emitted `deckLimit: 1`), set aside by 49020 New Recruits (player side scheme, "Play only if your
  identity has the X-Men trait"; each player adds a set-aside New ally to hand on defeat). The `Linked` keyword parses
  (`keywords: [{ name: "linked", cardTitle: "New Recruits" }]`, checked in the emitted file).
- Leadership 49012 to 49020 (M, Kid Omega, Phoenix, Cyclops, Won't Stay Down, three events, New Recruits). Basic 49021
  to
  49026 and 49033 to 49037. Obligation 49027 Old Grievances; nemesis 49028 to 49032 (Exodus, Martyr for Mutants, Fabian
  Cortez, Frenzy, Angry Acolyte); Hellfire set 49038 to 49042 (Sebastian Shaw, Selene, Hellfire Pawn, The Inner Circle,
  Power and Decadence).
- Errata: 49010, 49023, 49028 (section 3). Regen drift: 49004.

## 6. Schema and parser gaps

"Parser" means `parse-text.ts` or a normalizer step; "curation" means an existing curation field is enough.

| #   | Gap                                                                                                                                                                                                                                                                               | Codes                                            | Fix kind                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | No numeric correction for a minion's printed SCH when raw omits it (Velociraptor prints SCH 1; `cardNotes` records dash or zero)                                                                                                                                                  | 45129                                            | `Correction` field (small `types.ts` plus `encounter-cards.ts`)                                 |
| 2   | Attach host "an identity-specific ally you control" (Sidekick)                                                                                                                                                                                                                    | 45015                                            | parser plus `AttachmentHost` shape (an ally of the identity's own set)                          |
| 3   | Attachment with no attach rule that attaches from its own When Revealed (ruling February 20, 2026 (4))                                                                                                                                                                            | 45124                                            | curation: `impliedAttachHost: "ownWhenRevealed"`                                                |
| 4   | Mission side scheme b faces typed `side_scheme` with no threat ("Finished.")                                                                                                                                                                                                      | 45166b to 45170b                                 | normalizer or card-type decision (side scheme dash field, or a non-scheme "finished" face)      |
| 5   | `Mission Response` is not a trigger header; it parses silently as a constant ability (probe-confirmed)                                                                                                                                                                            | 45180a to 45183a                                 | parser (`TRIGGER`, `kindOf`) plus a new `AbilityKind` in the schema and glossary                |
| 6   | Overseer a faces print dashes for ATK and SCH                                                                                                                                                                                                                                     | 45179a to 45183a                                 | curation `cardNotes` (10 survey lines)                                                          |
| 7   | A b face in a different encounter set (`prelates`); sets are built from top-level records only                                                                                                                                                                                    | 45179b to 45183b                                 | normalizer plus `EncounterSet` membership by face                                               |
| 8   | Raw link error: 45104a points at 45105b; Heart of the Empire's own back is absent from raw and scans                                                                                                                                                                              | 45104a                                           | curation (`ignoredRecords` or a face override) and a scan/printed-card check                    |
| 9   | Dash cost on a campaign support                                                                                                                                                                                                                                                   | 45171a                                           | curation `specialCost: "dash"`                                                                  |
| 10  | The double-sided Mission Rules reference card is not a MarvelCDB record (inferred from the 164 versus 165 count)                                                                                                                                                                  | none                                             | decision: data card, UI-only, or engine text                                                    |
| 11  | Campaign-specific sets with faction `encounter`: `aoa_mission`, `aoa_campaign`, `age_of_apocalypse`, `overseer`; two sets are both named "Campaign"                                                                                                                               | 45164 to 45170a, 45177 to 45183a                 | curation `EncounterSetCuration.campaignSpecific`; set names                                     |
| 12  | Seven errata (section 3); one is a classification change (Deft Focus)                                                                                                                                                                                                             | 45017, 45171a, 48012, 48037, 49010, 49023, 49028 | `Errata` entries; classification errata has no precedent I found                                |
| 13  | Frostbite deckable as emitted (`deckLimit: 6`); the kit starts set aside                                                                                                                                                                                                          | 46002                                            | curation `separateDecks` (Storm precedent) or a deck-limit correction                           |
| 14  | Scenario 3's four-stage chain with difficulty entry points II / III / I; stage IV reached only by scheme completion                                                                                                                                                               | 45101, 45102                                     | the normalizer builds the chain; `villainStages` and `Scenario` need a decision                 |
| 15  | Four Horsemen versions: `expertVillains` swaps one villain code, the scenario needs four A-to-B swaps (and optional mixing)                                                                                                                                                       | 45081a to 45084a                                 | `multipleVillains` plus a per-villain version field (architect)                                 |
| 16  | Standard III as a Standard-set alternative; Pursued by the Past (environment, Permanent and Setup)                                                                                                                                                                                | 45075a to 45080                                  | `standardSetCodes` alternative, or a scenario option                                            |
| 17  | Scenario setup rules with no data field: set aside whole sets (Blue Moon, Genosha, Savage Land; Prelates), "Professor X cannot enter play" (scenario 5), mission and Overseer selection                                                                                           | scenarios 3, 4, 5                                | scripting plus campaign data; list in `scriptingNotes`                                          |
| 18  | Mission area and mission attempt mechanics, Victory display, `Find`, Amplify on villains; Prelate availability by campaign log                                                                                                                                                    | cards in 4.5                                     | engine and `game-rules-architect`; `find` and `victory` keywords already exist in `keywords.ts` |
| 19  | Campaign log: per-player identity and remaining HP (expert), struck mission names, struck Overseers, reward effects on deck building (extra copy of a chosen any-aspect upgrade, support or campaign ally outside the minimum; Desperate Measures and Panicked Refugees shuffles) | `AOA_CAMPAIGN`                                   | hand-authored `campaign.ts` plus architect decision on log fields                               |
| 20  | Raw carries the print for four errata cards (`currentReplace`) and the current text for 45171a (`printedReplace`); 48037 and 49023 differ outside `text`                                                                                                                          | 45017, 48012, 49010, 49028; 45171a               | curation                                                                                        |
| 21  | Three versions of one card with different icons: title-level copy counting                                                                                                                                                                                                        | 47007, 47008, 47010                              | confirm the deck validator counts by title where a limit is by title                            |

Not gaps (confirmed handled): three-sided villain (`villains.ts` "three-sided" branch; survey raises no villain error),
the Apocalypse I to IV chain across two cards (comment and branch in `villains.ts`), `player_side_scheme` type,
`Linked (Title)`, `Hinder N[per_hero]` (`keywords.ts` line 131 to 137; aoa has 5 cards with it), `-1` as a non-numeric
main scheme target, versions-as-separate-cards (Horsemen), hero pack reprints through `duplicate_of_code`, Team-Up
keyword.

## 7. Team-Up cards in the cycle

Script grep of `Team-Up (` over the five caches finds exactly one card.

| Pair                  | Card (id)            | Pack      | Pictures folder     | Playable once                                                                             |
| --------------------- | -------------------- | --------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Jubilee and Wolverine | Unlikely Duo (47022) | `jubilee` | `jubilee-wolverine` | `jubilee` pack is released into the pool; Wolverine (cycle 6, `wolv`) is already playable |

`docs/team-ups.md` already lists this pair under "In later packs". Unlikely Duo is legal only in a Jubilee or Wolverine
deck (RRG 1.8 "Team-Up", p. 43, as the doc states) and playable while both are in play. No other cycle 8 card names a
pair.
The folder `art/teamups/jubilee-wolverine` does not exist (the folder listing has no `jub*`); check before the client
step.
The wave definition of done (section 5) asks for the picture folder.

## 8. Ordered data steps (one agent each)

Steps touching different files can run in parallel, at most three.

1. **Errata and text fixes in the emitted packs (small).** `Errata` entries for 48012, 48037, 49010, 49023, 49028 in
   `curation/ncrawler.ts` and `magneto.ts` (`currentReplace` for 48012, 49010, 49028; a note for 48037 and 49023; read
   `48012.png`, `49010.png`, `49023.png` and `49028.png` for the printed wording first), plus the Frostbite decision
   from
   gap 13 in `iceman.ts`. Do not regenerate yet.
2. **Parser prep (small).** Gaps 2 and 5: `Mission Response` trigger and `AbilityKind`, Sidekick's host shape; extend
   `parse-text.test.ts`. The `Mission Response` kind needs a short `game-rules-architect` ruling first (an ability type
   tied to a mission attempt).
3. **Normalizer prep (small).** Gaps 1, 4, 7, 8: minion SCH correction, side scheme b faces, b faces in their own set,
   the 45104a link. Output: a short decisions list in the wave 8 spec.
4. **`curation/aoa.ts` pass 1 (cards).** Cycle `{ id: "cycle8", name: "Age of Apocalypse", order: 8 }`, pack name,
   release
   date March 29, 2024 (sources doc), `outDir src/data/aoa`, `exportPrefix "AOA"`, `handAuthoredModules: ["campaign"]`;
   corrections: 45129 SCH, 45171a dash cost, 45124 `ownWhenRevealed`, ten `cardNotes` for the Overseer dashes, `Errata`
   for 45017 and 45171a, `campaignSpecific` on four sets. Register in `ingest-marvelcdb.ts` and `survey.ts`. Done when
   `survey.ts --pack aoa` is clean.
5. **`aoa` scenarios.** Five `Scenario` records per section 4.3 (Four Horsemen as `multipleVillains`, Apocalypse chain,
   Dark Beast's three required sets, Standard III option), verified against MC45 pages 8 to 20 and the main scheme `a`
   records.
6. **`aoa` starter decks.** Bishop / Leadership and Magik / Aggression from MC45 p. 22. Both lists were read on the
   printed page (checked) and sum to 40 each by script (Bishop 15 + 20 + 5; Magik 15 + 16 + 9) with every card name
   found in raw within the printed copy counts. Codes: Bishop 45002 to 45010, 45011 to 45019, 45020 to 45024; Magik
   45031
   to 45040, 45041 to 45047, 45048 to 45052. Basics 45022 to 45024 are reprints. `verified: true`. Cable (45011) and
   X-23
   (45012) are Leadership allies in the Bishop deck, not Team-Up cards.
7. **Hand-authored `src/data/aoa/campaign.ts`**, emit `aoa` (`ingest -- --pack aoa --offline`, which the registry makes
   possible after step 4), and add the `wave8.test.ts` data integrity describe (validate every card, scenario, starter
   deck, campaign).
8. **Hero pack precons** for `iceman`, `jubilee`, `ncrawler`, `magneto` (one pack per agent, or one agent for two) from
   the printed decklist images (owner supplies them, or an agent transcribes the Hall of Heroes images). Each deck 40
   cards; Iceman's excludes the six set-aside Frostbite.
9. **Rename the cycle and regenerate** the four packs (curation `cycle` name; regen with the art symlink and the
   committed
   image extensions); review the four ability-id diffs from section 2 by hand; run `data-only.test.ts` and the wave
   tests.
10. **`WAVE8_*` exports** in `index.ts` (before `PLAYABLE_CARDS`, as waves 5 to 7): `export *` for the five packs,
    `WAVE8_CARDS/_ENCOUNTER_SETS/_SCENARIOS/_STARTER_DECKS`, append to `PLAYABLE_CARDS`, `AOA_CAMPAIGN` to `CAMPAIGNS`,
    remove
    the four from `DATA_ONLY_*`, `data-only.test.ts` `PACKS` 9 to 5 and drop its cycle 8 assertion, the "no id collides"
    list, `pool-version` and `catalog-codes` checks. Update `docs/team-ups.md` (move 47022 to playable) and add the
    picture
    folder.
11. **Scripting hand-off notes.** Per hero and per scenario, plain-language notes in each curation's `scriptingNotes`
    for the
    cards in sections 4 and 5 (Bishop's Energy Absorption; Magik's faceup top card and the four FAQ answers; Frostbite;
    Husk;
    Bamf!; Magnetic Pull and Linked allies; the mission system; the Horsemen active counter; Apocalypse's chain and
    forms).
12. **Art step (owner-supplied files).** Move `hero.png` for Bishop and Magik out of `art/heroes/_pending/` and convert
    to
    the folder convention; add `art/teamups/jubilee-wolverine/`; campaign artboards.

## 9. Open questions

1. What is Heart of the Empire's (45104a) reverse? Raw links it to No Longer Worthy; the rulebook puts No Longer Worthy
   on
   the back of The Tyrant's Throne. No raw record or scan exists. Needs a photo of the printed card or a Hall of Heroes
   scan. (Owner or tracker.)
2. Is there a Mission Rules record anywhere? The 164 versus 165 encounter count suggests it is the missing card. Where
   should the mission steps live (data, engine rule text, or UI)?
3. Standalone scenario 3 needs the Prelate faces, but the Overseer a faces are campaign-only cards (rulebook p. 4). How
   should one physical card belong to a campaign-only set on side A and a normal modular set on side B?
4. Can Standard III replace Standard in any scenario (rulebook p. 3 says yes)? Is it one more `standardSetCodes` entry,
   a
   player choice at setup, or both?
5. How should the difficulty entry points of the Apocalypse chain be stored: standard begins at stage II, expert at III,
   easy at I (rulebook p. 14)? Is skirmish mode the same as "easier"?
6. Four Horsemen: how are the A and B sides chosen per villain, and is the "mix of A and B" rule (rulebook p. 11) a
   player
   option the data must allow?
7. Suit Up's printed "(Shuffle.)": still part of the current wording? Read `45017.png` against the RRG's "should read".
8. Frostbite: should the six copies be a separate deck (as Storm's Weather) so they cannot be put in a deck?
9. Jubilee's three versions of each signature card: do the three versions count as one title for any "Max N per deck" or
   copies rule? (The cards themselves print deck limit 1 each.)
10. Which mission b-face model: a side scheme with no threat, or a non-scheme "finished" state that only exists inside
    the
    mission flow?
11. The Iceman page's "Starter Deck" link goes to an image; I did not fetch the other three pages or open the image.
    Owner:
    do you want the four decklist cards supplied as files, or should an agent fetch them from Hall of Heroes?
12. The sources doc needs the corrections in section 3 (errata table, identity text for Iceman, counts) before the spec
    leans on it. Also confirm the box release date, March 29, 2024, against the Hall of Heroes page (not re-fetched).
13. Magik's FAQ (RRG p. 64) says her play from the deck counts as a play from hand; the scripting is the
    `ability-scripting-engineer`'s, but the data needs no field for it. Confirm before step 11.
