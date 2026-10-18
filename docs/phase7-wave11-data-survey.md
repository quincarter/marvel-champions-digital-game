# Wave 11 data survey (cycle 11 in our ids: Fear No Evil, Jessica Jones, Luke Cage)

Survey only, 2026-10-18, branch `feature/wave-11`. No card data or code was changed; this file is the only thing
written. Packs: `fne` (Fear No Evil, MC60, campaign expansion), `jj` (Jessica Jones, MC61, hero pack) and `luke_cage`
(Luke Cage, MC62, hero pack). Scope and resume notes: [phase7-wave11-handoff.md](phase7-wave11-handoff.md). Model:
[phase7-wave10-data-survey.md](phase7-wave10-data-survey.md).

Commands used. Every count below is by script, not by eye.

- Node scripts over `packages/content/raw/marvelcdb/{fne,jj,luke_cage}.json` (top level `{ source, fetchedAt, pack,
  cards: [...] }`; a b face is nested under a record's `linked_card`).
- `node --experimental-strip-types scripts/marvelcdb/survey.ts --pack <p> --json <scratch>` (dry run; nothing written)
  for each pack, and a scratch `normalizePack` run on `fne` with one scratch `separateDecks` entry (section 4).
- MarvelCDB's public API, fetched into the session scratch folder (never into `raw/`): `/api/public/cards/<pack>` for
  the three packs, `/api/public/cards/` (all 2,155 cards), `/api/public/packs/`, `/api/public/decklists/by_date/<d>`.
- Hall of Heroes pages for the three packs (WebFetch), the two hero pack insert PDFs (`mc61_rulesheet-web.pdf`,
  `mc62_rulesheet-web.pdf`, text extracted), RRG 1.8 text extracted with PyMuPDF, and the MC60 rulebook markdown.
- Local scans in `assets/card-art/bundles/cards/` opened as images: 60001a, 60001b, 60037a, 60037b, 61001a, 61001b,
  62001a, 62001b.

**Convention for printed-card claims (Wave 7 lesson).** A claim is **checked** only if I opened the scan or rendered
page this session. The eight scans above are the only checked card faces. Everything else is **unchecked**: it comes
from MarvelCDB raw text or the rulebook markdown (a text extract, not the rendered page).

## 0. Corrections to the brief and to the handoff

1. **`fne` is not "short" in the way the handoff suggests: it holds all 89 player cards.** The MC60 rulebook p. 2
   says "276 cards, consisting of 89 player cards, 16 villain cards, and 171 encounter cards". By script the raw cache
   has player-faction copies **89** (exact match), encounter copies 12 (the two hero nemesis sets and obligations) and
   2 identity b faces: 103 of 276. What is missing is the **scenario half of the box**: about 173 cards, all villain,
   scheme, encounter and campaign cards (section 3).
2. **MarvelCDB does not have the missing cards either.** Its own pack record says `fne` "known: 68, total: 276"
   (68 = our 66 records plus 2 nested b faces). A fresh fetch today returned the same 66 records as the cache (zero new
   codes). So refetching changes nothing; this is not an ingestion bug.
3. **The two hero packs are complete.** MarvelCDB's pack records say `jj` known 43 / total 60 and `luke_cage` known 38
   / total 60. Our caches have 59 copies plus one identity b face each = 60 (53 player + 6 encounter + 1 b face).
4. **Release dates.** Hall of Heroes gives only the month for all three ("July, 2026", "August, 2026"). MarvelCDB's
   pack records give `available`: `fne` **2026-07-24**, `jj` **2026-08-21**, `luke_cage` **2026-08-21**. The existing
   `fne.ts` placeholder `2026-07-01` should become 2026-07-24 with that source named (MarvelCDB is a pointer, not an
   authority; the day is unconfirmed by FFG).
5. **`pack_wave` is absent** from all three caches (Wave 10 records carried `pack_wave: 10`), so nothing in raw
   confirms the cycle number. Cycle 11 is our own ordering (release order after Wave 10), consistent with RRG 1.8
   Appendix VI (p. 71), which lists only waves 1 to 10 and names Fear No Evil as "(upon release)" in the Current
   Environment list.
6. **RRG 1.8 Appendix V (errata) has no entry for any card in these three packs.** Checked by script over the
   extracted text of the whole errata section (card names `(#n)`): none of the 60xxx, 61xxx or 62xxx titles appear.
   There is nothing to put in `errata: []` from the RRG. FFG rulings since v1.8 do name these cards (section 8) but are
   rulings, not errata.
7. **`fne.ts` carries `cycle10` / "Cycle 10"** (a Wave 2 placeholder). That must change to `cycle11` (section 7).

## 1. Where each pack stands

| Pack        | Raw cache (`raw/marvelcdb/`) | Emitted (`src/data/`) | Curation (`scripts/marvelcdb/curation/`)   | Registered in ingest | In `survey.ts` | Pool today |
| ----------- | ---------------------------- | --------------------- | ------------------------------------------ | -------------------- | -------------- | ---------- |
| `fne`       | yes, 66 records, 68 faces    | no                    | `fne.ts` (50 lines, empty but the aux set) | **no** (comment)     | registered     | none       |
| `jj`        | yes, 42 records, 43 faces    | no                    | **none**                                   | no                   | bare curation  | none       |
| `luke_cage` | yes, 37 records, 38 faces    | no                    | **none**                                   | no                   | bare curation  | none       |

All three caches have `fetchedAt` 2026-09-13 and `source` `https://marvelcdb.com/api/public/cards/<pack>`. The
ingest comment at `scripts/ingest-marvelcdb.ts` line 165 says `fne` is "NOT registered" because of a parser/schema
gap named in Wave 2; section 4 shows that gap is gone.

## 2. Raw shape and counts

### 2.1 Totals

| Pack        | Records | Faces | Nested b faces | Copies (sum of `quantity`) | Copies with b faces | Printed total | `duplicate_of_code` |
| ----------- | ------- | ----- | -------------- | -------------------------- | ------------------- | ------------- | ------------------- |
| `fne`       | 66      | 68    | 2              | 101                        | 103                 | 276           | 6                   |
| `jj`        | 42      | 43    | 1              | 59                         | 60                  | 60            | 3                   |
| `luke_cage` | 37      | 38    | 1              | 59                         | 60                  | 60            | 6                   |

No record has a nested `linked_card` of its own (no third faces). The b faces are all alter-egos: 60001b Matt Murdock,
60037b Maya Lopez, 61001b Jessica Jones, 62001b Luke Cage. A c face does not occur; the `a/b/c` suffixes below are
three top-level records, not faces.

### 2.2 By `type_code` (records)

| Type               | `fne` | `jj` | `luke_cage` |
| ------------------ | ----- | ---- | ----------- |
| hero               | 2     | 1    | 1           |
| ally               | 6     | 6    | 6           |
| event              | 14    | 7    | 10          |
| support            | 6     | 2    | 3           |
| upgrade            | 22    | 13   | 6           |
| resource           | 3     | 1    | 5           |
| player_side_scheme | 3     | 6    | 0           |
| obligation         | 2     | 4    | 1           |
| minion             | 3     | 1    | 3           |
| side_scheme        | 2     | 1    | 1           |
| attachment         | 1     | 0    | 1           |
| treachery          | 2     | 0    | 0           |
| Total              | 66    | 42   | 37          |

There is **no** `villain`, `main_scheme`, `environment`, `leader` or `alter_ego` top-level record in any cache.

### 2.3 By `faction_code` (records)

- `fne`: hero 30, justice 10, protection 8, basic 8, encounter 10.
- `jj`: hero 14, justice 11, aggression 2, leadership 1, protection 3, basic 5, encounter 6.
- `luke_cage`: hero 11, leadership 8, aggression 1, justice 1, protection 1, basic 9, encounter 6.

### 2.4 By `card_set_code`

| Set code                | Records      | Codes / contents                                                                                                             |
| ----------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `daredevil`             | 14           | hero 60001a, kit 60007 to 60018, obligation 60032 (obligation carries the hero set code)                                     |
| `daredevil_sense_deck`  | 5            | 60002 to 60006, `card_set_parent_code: "daredevil"`, `card_set_type_name_code: "hero_special"`                               |
| `daredevil_nemesis`     | 4            | 60033 Bullseye (minion), 60034 Deadliest Man Alive, 60035 Stolen Sai, 60036 Eye on the Target (x2)                           |
| `echo`                  | 13           | hero 60037a, kit 60039 to 60047 with 60040a/b/c, obligation 60060                                                            |
| `echo_nemesis`          | 4            | 60061 Kingpin (minion), 60062 Master Manipulator, 60063 Kingpin's Henchman (x2), 60064 Pawn of the K.                        |
| `jessica_jones`         | 15           | hero 61001a, kit 61002 to 61014, obligation 61030                                                                            |
| `jessica_jones_nemesis` | 5            | 61031 Purple Man (minion), 61032 Indomitable Will, 61033a/b/c Suggestion (obligations, one per icon)                         |
| `luke_cage`             | 12           | hero 62001a, kit 62002 to 62011, obligation 62028                                                                            |
| `luke_cage_nemesis`     | 5            | 62029 Cottonmouth, 62030 Venomous Whispers, 62031 Augmented Jaws, 62032 Asp, 62033 Sidewinder                                |
| none (aspect and basic) | 26 + 22 + 20 | `fne` 60019 to 60031, 60038, 60048 to 60059; `jj` 61015 to 61029, 61034 to 61040; `luke_cage` 62012 to 62027, 62034 to 62037 |

## 3. `fne`: what is missing, and how complete packs were fetched

**Missing (by the rulebook, unchecked against rendered pages):** six scenarios (Protection Racket, The Raft Breakout,
Art Museum Heist, The Getaway, Stop the Presses!, Kingpin), five interchangeable main schemes plus the per-scenario
ones, five underling villains (Bullseye, Electro, Hammerhead, Purple Man, Typhoid Mary; rulebook p. 2 stage counts
"1/14", "1/14", "1/14", "1/15", "1/15" for their sets) and Kingpin ("1/22"), 16 villain cards in total, the encounter
sets Disasters, Cops, Drive, The Owl, Tombstone, Tracksuit Mafia and the per-scenario sets, five campaign environments
(numbered 205 to 209 on rulebook p. 9) with Completed and Failed sides, and the alternate encounter card back cards.
Collector numbers seen in the rulebook run up to at least 210 ("210A"), against 64 numbers in raw (60001 to 60064), so
roughly 145 distinct records are absent (276 copies minus 103).

**How earlier waves fetched complete packs.** There was no special path. `scripts/ingest-marvelcdb.ts` has one
fetcher, `loadRaw(pack, offline)`, which GETs `https://marvelcdb.com/api/public/cards/<pack>` once per pack code and
writes the whole array into `raw/marvelcdb/<pack>.json` (with `--offline` it re-reads the committed cache). `cw`,
`trors`, `gmw` and the others were complete because MarvelCDB had transcribed the whole box under the pack code. The
Go scraper in `packages/content/scripts/scraper` and `scripts/fetch_card_art.py` fetch **images**, not card data.
Where MarvelCDB lacked a face, the repo's mechanisms were hand entries in the curation: `addedRecords` (a
`RawCard`-shaped literal transcribed from a scan, one face at a time, used for `45104b`), `linkOverrides`, and
`imageOverrides` (a cited URL for one missing image). Nothing in the repo supplies a bulk second source.

**Does MarvelCDB have them now?** No (section 0, items 1 and 2). I also checked the all-cards endpoint: it holds 127
records with a 6xxxx code, split `fne` 58, `jj` 37, `luke_cage` 32 (it omits letter variants and b faces), none with a
code above 60064, and no card named after any of the six villains with a 6xxxx code. The `fne` pack record there says
`known: 68`.

**Other sources, none machine-readable:** (a) the MC60 rulebook (`docs/campaign-modes/mc60_rulebook-web.pdf`, markdown
`docs/campaign-modes/markdown/mc60_fear_no_evil.md`) shows each villain's card face and each scenario's setup, but not
every encounter card; (b) Hall of Heroes' Fear No Evil page has image galleries only, unlabeled, with some duplicate
files (headings: Daredevil, Echo, Bullseye, Electro, Hammerhead, Purple Man, Typhoid Mary, Kingpin; scenarios; encounter
sets Disasters, Cops, Drive, The Owl, Tombstone, Tracksuit Mafia, Campaign); (c) the three FFG news articles the page
links (2026-04-16, 04-30, 05-12). There are **no local scans** past 60064 in `assets/card-art/bundles/cards/` (160
files cover only the three packs' player and nemesis cards). Transcribing about 145 cards by `addedRecords` from images
is possible but is the single large piece of Wave 11 work and needs the owner's scans or a decision (section 10).

**What can ship without them.** All four heroes, their kits, obligations and nemesis sets are complete in raw, so the
player half of `fne` can be emitted and played against Core villains. The campaign and the six scenarios cannot be
until the scenario cards exist.

## 4. Normalizer results today (dry runs, nothing written)

| Pack        | Result under the survey              | Detail                                                                                            |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `fne`       | 5 issues, all `deck_limit undefined` | 60002 to 60006 (the Sense cards print no `deck_limit`)                                            |
| `jj`        | 21 issues                            | 17 artwork lines, 61002 no cost, 61031 ATK and SCH absent, 61040 "Attach to a card." unrecognized |
| `luke_cage` | 18 issues                            | 17 artwork lines, 62020 Hulk has no thwart                                                        |

- **The Sense deck is the whole `fne` gap.** A scratch run of `normalizePack` on `fne` with `FNE_CURATION` plus one
  `separateDecks` entry (`identityCode: "60001a"`, `deckName: "Sense"`, `cardCodes` 60002 to 60006, `topCardFaceup:
  true`, `discardPile: "none"`, `whenEmpty: "stayEmpty"`) normalizes **all 66 records with no error**. The result:
  Daredevil's `HeroIdentityCard.separateDecks` holds the five cards; 60012 Focus the Senses is a
  `player_side_scheme` with `startingThreat { base: 4, perPlayer: 0 }` and `resourceIcons { mental: 1 }`; 60056
  Superpower Training `startingThreat { base: 0, perPlayer: 3 }`. The Wave 2 "blocked on a parser gap" comment in
  `ingest-marvelcdb.ts` is therefore stale for the player half (the Requirement/Discount/Starting/Prerequisite
  keywords it named are now in `src/schema/keywords.ts` and `parse-text.ts`).
- **Artwork lines.** `fne` raw carries `imagesrc` and local files exist, so it shows none. `jj` and `luke_cage` raw have
  no `imagesrc` on 17 records each, and no local scan covers them: jj 61007, 61012, 61013, 61028, 61030, 61031, 61032,
  61033a/b/c, 61034 to 61040; luke_cage 62003, 62007 to 62010, 62023, 62024, 62028 to 62037. The art is a gitignored
  non-redistributed concern (CLAUDE.md); the survey's hard error stays until the owner supplies the scans or the
  curation names an `imageOverrides` URL.

## 5. Schema fields the new card types need

Most of this wave's surface already exists. What is new or unproven:

| Need                                                                                                                       | Where it shows up                                                                                                                   | State today                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sense deck: a faceup identity deck, never discarded, order fixed, with a "leaves play goes to the bottom of the deck" rule | 60001a/60001b, 60002 to 60006                                                                                                       | `IdentitySeparateDeck` (`topCardFaceup`, `discardPile: "none"`, `whenEmpty: "stayEmpty"`, `cardFamily: "player"`) fits the storage. **Gap:** the "place on the bottom of the Sense deck instead of leaving play" replacement, "you can look through it but cannot change the order" and "put into play from the Sense deck" are not expressible as deck flags; they are ability scripting (section 9), but the spec should say whether `IdentitySeparateDeck` grows a `lookThroughAnytime` or `fixedOrder` flag |
| Sense upgrades "Attach to an enemy or scheme."                                                                             | 60002 to 60006                                                                                                                      | `AttachmentHost { kind: "anyOf" }` exists and parses                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sense upgrade deck limit                                                                                                   | 60002 to 60006                                                                                                                      | needs `separateDecks` so the missing `deck_limit` is exempt (section 4); the cards are Daredevil's own and are never deck-built                                                                                                                                                                                                                                                                                                                                                                                 |
| Player side schemes                                                                                                        | 60012, 60024, 60056, 61007, 61019 to 61021, 61028, 61029, 61039                                                                     | `PlayerSideSchemeCard` exists with `startingThreat: ScalingValue`. New text: 61007 "does not count against the player side scheme limit" (engine knows the limit; the exemption is per card), 60012 "Threat cannot be removed ... except by Daredevil or Matt Murdock", 60024 and 61020 "cannot take damage" shapes. Nothing new in the card shape                                                                                                                                                              |
| Fixed versus per-player starting threat                                                                                    | 60012, 60024, 61007: `base_threat_fixed: true` with `base_threat` 4, 4, 6                                                           | `fne` scratch run gave `{ base: 4, perPlayer: 0 }` for 60012. **Check:** 60056 raw `base_threat: 3`, `base_threat_fixed: false` gave `{ base: 0, perPlayer: 3 }` (per player); confirm each of the nine against its face (unchecked)                                                                                                                                                                                                                                                                            |
| New keywords `Discount X (trait)`, `Starting`, `Prerequisite (form or trait)`                                              | 60023, 60026, 60027 (Discount); 60038, 61034, 61036, 61037 (Starting); 61029 (Prerequisite)                                         | present in `keywords.ts` and `parse-text.ts` since Wave 2                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Updated keywords `Villainous`, `Vulnerable` (rulebook p. 3 stars)                                                          | scenario cards, not in the player half                                                                                              | modelled; check wording against RRG 1.8 once scenario cards exist                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Team-Up` with two named characters                                                                                        | 60031, 60055 (Daredevil and Echo), 61027, 61029, 62022 to 62024                                                                     | modelled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Uses (N <name> counters)` with new counter names                                                                          | pheromone (61033a/b/c), evidence (`jj` ten cards), rage (62020), 62018                                                              | counter names are free text so far; confirm `definedCounterTypes` is not needed (it is for card-defined counters, section 5 of the Wave 10 survey)                                                                                                                                                                                                                                                                                                                                                              |
| `Permanent` on a support and an upgrade                                                                                    | 61002 Alias Investigations, 61014 Stakeout                                                                                          | modelled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Three printings of one card with a different resource icon                                                                 | 60040a/b/c Photographic Reflexes (Energy, Mental, Physical; `quantity` 2 each; the rulebook says six copies); 61033a/b/c Suggestion | normalizes as three separate cards under their own ids with the same name; `deckLimit` 2 each. **Gap:** a per-name deck limit (a deck of six would be three entries of 2). The precon needs all six, so the deck validator must count by name or by a group, not per id (open question, section 11)                                                                                                                                                                                                             |
| `Attach to a card.`                                                                                                        | 61040 Mitigated Threat                                                                                                              | **Gap:** no `AttachmentHost` kind for "any card" (kinds stop at `encounterCard`, `leader`, `nonActiveVillain`); the parser reports "unrecognized attach rule"                                                                                                                                                                                                                                                                                                                                                   |
| Dash and star stats                                                                                                        | 61002 (support, no cost), 61031 Purple Man (ATK and SCH from text), 62020 Hulk (ally with no thwart)                                | each needs a `cardNotes` plus `dashedMinionStats` or an `attack`/`thwart` correction, as Wonder Man's dash costs were curated                                                                                                                                                                                                                                                                                                                                                                                   |
| Photographic Reflexes cost                                                                                                 | 60040a/b/c raw `cost: -1`                                                                                                           | the scratch run emitted `cost: 0`; the card prints a dash cost with a star effect. Confirm against a scan and add a `specialCost` or `cardNotes` entry (Wave 10 precedent: Ionic Physiology 58002)                                                                                                                                                                                                                                                                                                              |
| "Alternate encounter card back"                                                                                            | rulebook p. 4; the campaign environments                                                                                            | `Correction.cardBack` exists (`"encounter"                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | "player"`); the scenario half needs it |
| Per-player main schemes, flipping villain, charge counters, tokens on environments                                         | Protection Racket ("each player has their own main scheme"), Typhoid Mary / Bloody Mary, Electro, Disturbed Psyche                  | not modelled; cannot be judged until the cards are transcribed (blocker, section 3)                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Glossary `box`                                                                                                             | `src/schema/glossary.ts` line ~101 `GlossaryBox` stops at `"cycle10"`                                                               | add `"cycle11"` and entries for the new terms: Sense deck, tuck-and-recast (Echo), Exactly Defeat (updated), Find (updated), Unpreventable Damage (Luke Cage insert), Discount, Starting, Prerequisite, player side scheme limit                                                                                                                                                                                                                                                                                |

**New terms printed in the inserts (checked, text extracted):** MC61 insert: Prerequisite, Starting, "Exactly Defeat".
MC62 insert: Prerequisite, "Unpreventable Damage" (cannot be reduced or prevented; does not remove tough). The engine
already mentions `unpreventable` and `exactly defeat` (`packages/engine/src/abilities.ts`); `@mc/content` has no
glossary entry for either.

## 6. Raw text and stat defects (corrections owed)

| Card                                              | Defect                                                                                                                                                                                     | Evidence                                                                                                                                                                     | Fix                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **60001a Daredevil**                              | raw `thwart: 1`; the printed card says **THW 2** (ATK 2, DEF 2)                                                                                                                            | **checked**: scan 60001a (2/2/2); rulebook p. 2 text lists "2 2 2 THW ATK DEF"                                                                                               | `Correction { code: "60001a", thwart: 2 }`                                      |
| **60001a Daredevil**                              | raw `text` has only "Superhuman Senses"; the printed hero face also prints the Forced Interrupt "When a Sense upgrade would leave play, place it on the bottom of the Sense deck instead." | **checked**: scan 60001a shows it; scan 60001b has it too (raw has it only on the b face); rulebook p. 26: "the forced interrupt on both sides of Daredevil's identity card" | `Correction.textReplace` appending the sentence to 60001a (the b face is right) |
| 60001b Matt Murdock, 60037a/b, 61001a/b, 62001a/b | none: text, hand size, HP, REC and stats match the scans                                                                                                                                   | **checked**                                                                                                                                                                  | no correction                                                                   |
| 62010 Metal Bracer                                | the FFG ruling pages call the card "Metal Bracelet" (June 25, 2026 R6; July 9, 2026 R2); MarvelCDB and every decklist say "Metal Bracer"                                                   | raw name 62010; rulings transcript lines 100, 103                                                                                                                            | flag: do not rename on one source; check a scan of 62010 (none local)           |
| 61002 Alias Investigations                        | no `cost` in raw (Permanent, put into play by 61001b's Setup)                                                                                                                              | raw; the survey line "support without a cost"                                                                                                                                | `cardNotes`: dash cost, like Ionic Physiology 58002 and Cameo 58031             |
| 61031 Purple Man                                  | ATK and SCH are `[star]`-stated in text ("SCH equals the highest SCH or THW...", "ATK equals the highest ATK...") and absent as numbers                                                    | raw text; survey lines                                                                                                                                                       | `dashedMinionStats: ["atk", "sch"]` and a `cardNotes` entry                     |
| 62020 Hulk                                        | ally with `attack: 2`, no `thwart` field (a printed dash); `attack_cost` 2                                                                                                                 | raw; survey line                                                                                                                                                             | `cardNotes`, dash thwart as other attack-only allies were curated               |
| 61040 Mitigated Threat                            | "Attach to a card." (section 5)                                                                                                                                                            | survey line                                                                                                                                                                  | parser rule or a new host kind                                                  |
| 60025, 60056 and the other 13 reprints            | MarvelCDB's `duplicate_of_code` text and cost match the original in every case (script: text equal, cost equal)                                                                            | script                                                                                                                                                                       | none; keep `duplicateOfCardId`                                                  |
| 60055 See No Evil, Hear No Evil                   | raw `resource_wild: 1`, `quantity: 2`, `deck_limit: 1` ("Max 1 per deck")                                                                                                                  | raw                                                                                                                                                                          | none; noted so a precon builder uses 1 copy                                     |
| 60012 Focus the Senses                            | `card_set_code: "daredevil"`, `is_unique: true`, `deck_limit: 1`, fine                                                                                                                     | raw                                                                                                                                                                          | none                                                                            |

Nothing else was found by comparing names, traits and text against the 60 other caches, but a typo hunt needs scans:
only the eight identity faces above were checked, so **every other stat and text is unchecked**.

## 7. Reprints (`duplicate_of_code`)

15 records, all verbatim (text and cost equal to the original, checked by script). Every target is in an earlier
cache (nine packs) or a sibling wave 11 pack.

| Record              | Name                     | Original            | Original pack                |
| ------------------- | ------------------------ | ------------------- | ---------------------------- |
| 60025               | Chance Encounter         | 26034               | `vision`                     |
| 60051               | Powerful Punch           | 32014               | `mut_gen`                    |
| 60056               | Superpower Training      | 40059               | `next_evol`                  |
| 60057, 60058, 60059 | Energy, Genius, Strength | 01088, 01089, 01090 | `core`                       |
| 61018               | Lay Down the Law         | 12031               | `ant`                        |
| 61021               | Lay the Trap             | 41016               | `psylocke`                   |
| 61022               | Determination            | 21052               | `mts`                        |
| 62016               | Innovation               | 21058               | `mts`                        |
| 62017               | The Power of Leadership  | 01072               | `core`                       |
| 62024               | Unbreakable Bond         | **61027**           | `jj` (same wave, other pack) |
| 62025, 62026, 62027 | Energy, Genius, Strength | 01088, 01089, 01090 | `core`                       |

The normalizer records `duplicateOfCardId` (`normalize/context.ts` line 222) and reuses the original's art when the
reprint has none (`normalize/art.ts`). Of the reprints, 61018, 61021, 61022, 62016, 62017, 62024 and 62025 to 62027 sit in
the survey's art lists only where the original also lacks a local scan; none was checked individually. 62024's original
is in `jj`, so emit `jj` before `luke_cage`.

## 8. FFG rulings that name these cards (post RRG 1.8)

From `marvel-champions-rulings-post-rrg-1-7.md`. Cite by date heading with the RRG page. These feed `rules-qa-engineer`
and `ability-scripting-engineer`; none is an erratum.

- June 25, 2026 R2: Raising Hell (60011) paid with Aggressive Energy adds +1 damage to each enemy damaged.
- June 25, 2026 R6 and July 9, 2026 R2: Luke Cage with Metal Bracelet (our 62010 "Metal Bracer") and Clarity of Purpose; "reduce" versus
  "prevent"; damage taken as a cost may be reduced to 0 and the cost is still paid.
- July 9, 2026 R1 and August 13, 2026 R2: Acute Tactility (60002) on Focus the Senses (60012); Interrupt to the last
  threat removed resolves first, so it discards and Focus the Senses' When Defeated can fetch it; the When Defeated
  triggers after any Interrupts to the scheme's defeat.
- August 3, 2026 R2: Echo (ally 61038) reduces indirect damage assigned to her up to her remaining HP; Valkyrie (ally 62014) interrupt resolves before allies are defeated.
- August 3, 2026 R5: Echo's Katana (60045) with "2 per player" printed cost (Team Investigation): 4 in two players.
- August 3, 2026 R6: Exactly Defeat definition.
- August 13, 2026 R1: Echo stunned and playing an attack event still triggers play responses; Study the Tape (60041)
  cannot tuck a borrowed event (it goes to its owner's discard pile).

The MC60 rulebook FAQ (p. 26, text only, unchecked) adds: Sense abilities are usable only by the controller; Photographic
Reflexes (60040) is usable whenever the tucked event could be played, and the tucked event goes to its owner's discard
pile; discount applies once however many traits match.

## 9. What the abilities need (for `ability-scripting-engineer`, plain terms only)

- Daredevil: Action to play the top Sense card as if from hand, paying its cost; a Forced Interrupt (on both identity
  faces) that sends a leaving Sense upgrade to the bottom of the deck; the Sense deck is faceup, can be looked through,
  never reordered. Focus the Senses: threat only removable by Daredevil or Matt Murdock; When Defeated, move any number
  of Sense upgrades to other legal hosts, then put chosen Sense cards into play from the deck without shuffling.
- Echo: tuck an aspect or basic event from the discard pile under her (limit 3 tucked; discard all but 3); Photographic
  Reflexes discards from hand to play a tucked event at cost minus 2, once the tucked event's own timing allows; Practice
  Makes Perfect (Maya Lopez) fetches an event on change to hero form.
- Jessica Jones: evidence counters on Alias Investigations (Permanent, Setup from the alter-ego), a response that can
  defeat the villain's current stage by spending counters equal to its remaining hit points; Suggestion obligations
  (three, one per icon) with pheromone counters; Purple Man's stats read from characters in play.
- Luke Cage: any number of tough status cards, attacks against him lose piercing, a Forced Response dealing unpreventable
  damage when a tough card is discarded; Burstein Process search each phase; Hulk's rage counters; Cottonmouth's repeat
  attack (limit once per phase).
- Keywords to confirm are wired: Discount, Starting, Prerequisite, Team-Up, Permanent, Temporary, Restricted,
  Hinder X (61029, 61032), Piercing, Ranged.

## 10. Precon starter decks (four heroes) and where each list comes from

| Deck                    | Source                                                                                    | Status                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Daredevil / Justice     | MC60 rulebook p. 25, "Starter Decks" (markdown text, unchecked against the rendered page) | printed list; 40 cards plus the five Sense cards outside the deck |
| Echo / Protection       | MC60 rulebook p. 25, same page                                                            | printed list; 40 cards                                            |
| Jessica Jones / Justice | **no printed source found**                                                               | stand-in only                                                     |
| Luke Cage / Leadership  | **no printed source found**                                                               | stand-in only                                                     |

- **Daredevil (checked by script against raw quantities, 40 cards).** Hero cards (15): 60007 Elektra, 60008 x2, 60009 x2,
  60010 x2, 60011, 60012, 60013, 60014, 60015, 60016, 60017, 60018. Justice (20): 60019, 60020, 60021, 60022, 60023 x3,
  60024, 60025 x3, 60026 x3, 60027 x3, 60028 x3. Basic (5): 60029 Stick, 60030 x3, 60031. Sense cards 60002 to 60006
  (outside the deck). Obligation 60032; nemesis set 60033 Bullseye, 60034, 60035, 60036 x2.
- **Echo (40 cards).** Hero (15): 60039 Daredevil, 60040a x2, 60040b x2, 60040c x2 (the six Photographic Reflexes), 60041
  x2, 60042, 60043, 60044, 60045, 60046, 60047. Protection (20): 60038, 60048 x3, 60049 x3, 60050 x3, 60051 x3, 60052
  x3, 60053, 60054 x3. Basic (5): 60055 See No Evil, Hear No Evil, 60056, 60057 Energy, 60058 Genius, 60059 Strength.
  Obligation 60060; nemesis set 60061, 60062, 60063 x2, 60064.
- **Conflict to settle.** The printed rulebook basic line for Echo has **Strength** and no Stick. MarvelCDB public decklist
  63934 ("Echo - precon deck", posted 2026-07-24 by user 25564) has **Stick (60029) in place of Strength (60059)**,
  everything else identical. The rulebook is the primary source; the decklist is wrong, so use the rulebook list. Do
  not copy the MarvelCDB list.
- **Jessica Jones and Luke Cage.** The Hall of Heroes pages for both print "Starter Deck" as plain text with no link
  (checked today, as for Wonder Man and Hercules in Wave 10; the Wave 9 pages linked an image). The two inserts
  (`mc61_rulesheet-web.pdf`, `mc62_rulesheet-web.pdf`, text extracted) are two pages each: story, new keywords, credits,
  **no decklist**. The only list is MarvelCDB public decklists 65137 ("Jessica Jones precon deck", 41 cards) and 65136
  ("Luke Cage - precon deck", 40 cards), posted 2026-08-21 by the same user 25564 who posted the Fear No Evil ones. Same
  situation as Wonder Man in Wave 10: a stand-in, `verified: false`, until the owner supplies the printed decklist card
  or a screenshot.
  - Jessica Jones / Justice (41 = 40 plus 61002 Alias Investigations, the Permanent card put into play by Setup, the
    Wonder Man rule): hero 61002, 61003, 61004 x2, 61005, 61006 x3, 61007, 61008, 61009, 61010, 61011, 61012, 61013,
    61014; justice 61015, 61016, 61017, 61018 x3, 61019 x3, 61020, 61021, 61022, 61023 x3, 61024 x3; basic 61025, 61026
    x3, 61027, 61028, 61029. Obligation 61030; nemesis set 61031, 61032, 61033a/b/c.
  - Luke Cage / Leadership (40): hero 62002, 62003 x2, 62004, 62005 x2, 62006 x2, 62007, 62008, 62009 x2, 62010 x2,
    62011; leadership 62012, 62013, 62014, 62015 x3, 62016, 62017 x2, 62018 x3, 62019 x3; basic 62020, 62021, 62022 x3,
    62023, 62024, 62025, 62026, 62027. Obligation 62028; nemesis set 62029 to 62033.
- `StarterDeckCuration` fields: `identityCode` 60001a, 60037a, 61001a, 62001a; `aspect` justice, protection, justice,
  leadership; `obligationCode`, `nemesisCodes` as above.

## 11. What `cycleId("cycle11")` and the WAVE11 exports will need

- **Curations.** Change `fne.ts` to `{ id: "cycle11", name: "Fear No Evil", order: 11 }` (Wave 10 named its cycle after
  the box; Wave 10's owner question applies equally here), release date 2026-07-24. Write `curation/jj.ts` and
  `curation/luke_cage.ts` with the same cycle object (the packs of one wave share one cycle), releases 2026-08-21,
  `outDir src/data/jj` and `src/data/luke_cage`, `exportPrefix "JJ"` and `"LUKE_CAGE"`. Register all three in
  `scripts/ingest-marvelcdb.ts` (`CURATIONS`, remove the stale `fne` comment) and `survey.ts`.
- **`fne` curation content:** `separateDecks` for Sense (section 4), the 60001a corrections (section 6), `starterDecks`
  for Daredevil and Echo, `scriptingNotes` (section 9), `auxiliaryHeroSetCodes` (already there), and, once the cards
  are transcribed, scenarios, `addedRecords`, `separateVillainVersions`/`villainFrontIsSideA` as needed.
- **Emitted files**, as for every pack: `src/data/<pack>/{cards,encounterSets,packs,starterDecks,scenarios,index}.ts`, plus
  `export * from "./fne/index.js"` and the two siblings in `src/data/index.ts`.
- **`src/data/index.ts`:** `WAVE11_CARDS = [...CORE_CARDS, ...FNE_CARDS, ...JJ_CARDS, ...LUKE_CAGE_CARDS]` (a sibling pool
  starting from Core, like `WAVE10_CARDS`), `WAVE11_ENCOUNTER_SETS`, `WAVE11_SCENARIOS` (empty until the scenario half
  exists), `WAVE11_STARTER_DECKS`, and `...WAVE11_CARDS.slice(CORE_CARDS.length)` appended to `PLAYABLE_CARDS`. Also the
  campaign-box list that already names `trors`, `gmw`, `mts`, `sm`, `mut_gen`, `mojo` needs `fne` once campaign data
  exists (docs/campaign-mode-design.md section 11 step 6; `mc60` is a campaign expansion, handoff "Definition of done"
  step 6).
- **Every `"cycle10"` consumer** (grep found them): `packages/client/src/progression/unlocks.ts`,
  `view/new-in-box-model.ts`, `view/civil-war-entry.ts`, `guide/mechanic-tryits.ts`, `content/pool.test.ts`, and the
  Wave 10 tests that assert the cycle of `cw`, `hercules` and `wonder_man`. Each needs a `cycle11` counterpart; the
  Wave 10 ones must stay as they are.
- **Glossary** `GlossaryBox` gets `"cycle11"` and a test like `wave10`'s ("every id has a sourced concept entry in
  cycle11").
- **New data tests:** `src/data/wave11.test.ts` modelled on `wave10.test.ts` (counts per pack, the 15 reprints, the
  Sense deck, the three Photographic Reflexes printings, the two a-face corrections); `data-only.test.ts` and
  `pool-version.test.ts` change only if the pool version is bumped.
- **Art stubs:** `art/heroes/_pending/` already holds empty folders for `60001a-daredevil`, `60037a-echo`,
  `61001a-jessica-jones`, `62001a-luke-cage`. Identity scans and many player cards exist locally; `jj` and `luke_cage`
  have 17 missing fronts each (section 4); `fne` has no scans for anything past 60064.

## 12. Open questions

For the owner:

1. **The `fne` scenario half (blocker).** About 145 records (173 copies) that neither MarvelCDB nor the repo has. Choose:
   (a) ship the heroes now and emit the scenario half when MarvelCDB transcribes it; (b) the owner supplies scans or a
   list and the data agent transcribes them as `addedRecords` (a long, error-prone job: needs a card by card
   transcription with a second source for each); (c) a minimal slice (the six villains and main schemes from the
   rulebook only). Recommended default: (a), with the six scenarios and the campaign deferred, since the rulebook alone
   cannot yield stats and text for every encounter card.
2. **Cycle display name:** recommended "Fear No Evil" for all three packs.
3. **Printed decklist cards for Jessica Jones and Luke Cage** (screenshots, as for Wonder Man in Wave 10), or accept the
   MarvelCDB stand-ins as `verified: false`.
4. **Scans** for the 34 missing `jj` and `luke_cage` fronts and for 62010 (to settle "Metal Bracer" versus "Metal
   Bracelet"), and for 60040a to c and 60012 (cost and threat shape).

For `game-rules-architect` (spec, `docs/phase7-wave11.md`):

1. Should `IdentitySeparateDeck` grow flags for "look through anytime" and "fixed order", or are those rules left to
   scripting? The Sense deck never uses a discard pile and its "bottom of the deck" redirect is a replacement effect.
2. Deck-limit counting for three printings of one card (Photographic Reflexes 60040a/b/c, six copies in a precon).
3. An `AttachmentHost` kind for "any card" (61040 Mitigated Threat).
4. Whether the 61007 exemption from the player side scheme limit is a per-card flag or ability text.

## 13. Proposed emit order and tests that change

1. Corrections and `separateDecks` in `curation/fne.ts`; emit `fne` player half (all 66 records); register.
2. `curation/jj.ts` then `curation/luke_cage.ts` (in that order, for the 62024 reprint of 61027), with the dash and star
   `cardNotes` of section 6 and the 61040 host decision; emit and register.
3. Starter decks for Daredevil and Echo (rulebook, section 10, **not** MarvelCDB's Echo list), then the two stand-ins
   flagged `verified: false`.
4. `src/data/index.ts` wave 11 exports, glossary `cycle11`, `wave11.test.ts`.
5. Scenario half and campaign only after the owner's answer to question 1.

Tests that change: `survey.ts` clean-pack list (three more), `data-only.test.ts` (if packs move through the data-only
pool first), `pool.test.ts` and the `unlocks`/`new-in-box` view tests (cycle 11 unlock group), and any test that counts
`PLAYABLE_CARDS` or the number of starter decks.
