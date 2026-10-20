# Phase 7, Wave 11: Cycle 11 – Fear No Evil, Jessica Jones, Luke Cage – Sources

> **Status:** Source survey for Phase 7 wave 11 (Fear No Evil campaign box `fne` / MC60, Jessica Jones hero pack `jj` /
> MC61, Luke Cage hero pack `luke_cage` / MC62). Scope is in [phase7-wave11-handoff.md](phase7-wave11-handoff.md).
> Synthezoid Smackdown is out of scope (§1).
> **Check marks:** "[checked]" means read this session from a primary file (RRG markdown, rulings markdown, raw caches,
> repo source and docs, the MC60 markdown transcription) or from a Hall of Heroes page fetched this session. Everything
> else is "[unchecked]".
> **What this session could not do:** there is no shell, so `uv run docs/extract_pages.py` was not run. The `Read` tool
> cannot render PDFs here (`pdftoppm` is not installed), so `docs/campaign-modes/mc60_rulebook-web.pdf` is read only
> through its markdown transcription, and every rulebook page number is "[unchecked]" against the PDF. The Jessica Jones
> and Luke Cage rules sheets came back from WebFetch as raw PDF bytes and could not be read. RRG pages come from the
> footer markers in `mc_rulesreference_v18_compressed.md` (a line belongs to the page whose footer follows it).

---

## 0. What the spec author most needs to know

- **Cycle 11 is three products, and all three are released.** Fear No Evil (July 2026), Jessica Jones and Luke Cage
  (both August 2026). No other cycle-11 product is out (§1).
- **The repo labels Fear No Evil as cycle 10.** `packages/content/scripts/marvelcdb/curation/fne.ts` line 29 uses
  `cycle10`, "Cycle 10", which is the Civil War cycle (`cw.ts`, `wonder_man.ts`, `hercules.ts`). The handoff's
  `cycleId("cycle11")` is right; `fne.ts` must change before anything is emitted (§8.3).
- **The raw Fear No Evil cache has all the player cards and none of the box's own villains or encounter cards.** It holds
  all 89 player cards [checked] and 12 nemesis and obligation cards. It has none of the 16 villain cards, none of the
  underling villain or Kingpin encounter sets, and none of the six modular or scenario sets. About 175 cards are
  missing (§8.1). The handoff's "66 records" is the 68 `code` keys minus the two alter-egos [checked].
- **The box is not a linear campaign.** The player picks the next scenario after each game, and each setup draws two
  random campaign environments and progresses scenarios with them (rulebook pp. 8–9). The engine already models this
  (`packages/engine/src/campaign.ts`, lines 75–77, 262–293, 768), so the box uses that model rather than a new one.
- **Three keywords are new in this box, and RRG 1.8 has none of them.** Discount X (trait), Starting and Prerequisite
  (rulebook p. 3, transcription; the index agrees on Discount and Starting) [checked]. RRG 1.8 has no entry for any of
  them [checked]. Discount already has an engine path (`actions.ts`, `discountFor`). Starting and Prerequisite have
  schema types but no engine enforcement [checked by search].
- **Sense is a deck, not a keyword.** Daredevil's Sense deck is a face-up deck next to his identity (rulebook p. 26).
  RRG 1.8 has no Sense entry [checked]. This needs a rules-architect decision on a zone (§7).
- **Three source conflicts** need a recorded decision: Vulnerable (the insert says the first player chooses; RRG 1.8
  says the character is discarded before damage), Amplify (the insert extends it to characters' basic powers), and a
  Steady sentence the insert has and RRG 1.8 does not. The authority order settles all three in favour of RRG 1.8, with
  a code comment (§7).
- **About ten post-1.7 rulings touch these packs, and none is an errata.** Several involve a card from another pack
  (Aggressive Energy, Clarity of Purpose, Aerial Evacuation, Enhanced Spider-Sense) (§5).
- **A card name conflict:** the Luke Cage raw card is "Metal Bracer" (`62010`); the rulings call it "Metal Bracelet"
  (June 25 and July 9, 2026) [checked both] (§10).
- **Title matches across packs** (RRG p. 45, unique icon): Jessica Jones's Luke Cage ally (`61003`) and Luke Cage's
  Jessica Jones ally (`62002`) appear to match the other hero's identity, because each identity's alter-ego title is its
  own name (§4, §8.4). That reading needs a rules check.
- **No starter list for Jessica Jones or Luke Cage is available here.** The Hall of Heroes pages name none, and the
  rules sheets could not be read (§9).

---

## 1. Products and release order

RRG 1.8 Appendix VI, "Game Environments", p. 71 (`mc_rulesreference_v18_compressed.md` lines 5196–5288) [checked]. The
Current Environment lists "The _Fear No Evil_ campaign expansion (upon release)" (line 5222) and then "All products not
listed above that were released since ... v1.8 (Jul 2026)" (line 5246), which covers Jessica Jones and Luke Cage. The
"Limited Environment" waves list ends at wave 10 (lines 5262–5282), so cycle 11 is in no Limited Environment yet.

| Code               | Product       | Type                                          | Release (Hall of Heroes index)        | Status 2026-10-18 | Repo state                            |
| ------------------ | ------------- | --------------------------------------------- | ------------------------------------- | ----------------- | ------------------------------------- |
| `fne` / MC60       | Fear No Evil  | Campaign expansion, two heroes, six scenarios | July 2026 (index line 41) [checked]   | Released          | Raw cache; curation file, not emitted |
| `jj` / MC61        | Jessica Jones | Hero pack                                     | August 2026 (index line 61) [checked] | Released          | Raw cache only                        |
| `luke_cage` / MC62 | Luke Cage     | Hero pack                                     | August 2026 (index line 69) [checked] | Released          | Raw cache only                        |

**Membership check.** The index's 2025 and 2026 `Release date:` lines were searched [checked]. The 2026 entries are:
Hercules (February 20, line 49; cycle 10 in the repo), Fear No Evil, Jessica Jones, Luke Cage (above), Shadowland
(October 2026, line 113), Elektra Natchios (November 2026, line 32) and Iron Fist (November 2026, line 57). Shadowland's
page gives "Release date: October, 2026", "Lead Designer: TBA", and no product type or cycle [checked by WebFetch]. It is
not released as far as the index shows, and its cycle is unknown. Elektra and Iron Fist are announced with TBA designers.
**No other cycle-11 hero or scenario pack is released by 2026-10-18.**

**Order.** Hercules (February 2026) → Fear No Evil (July 2026) → Jessica Jones and Luke Cage (August 2026, same month,
no day given). Jessica Jones is listed first only because the index is alphabetical; the order between the two hero
packs is unknown (§10, question 4).

**Out of scope.** Synthezoid Smackdown (December 2025, index line 119; `57xxx`; since moved into this PR as cycle 10,
see `docs/phase7-synthezoid.md`), and Elektra Natchios and Iron Fist (above). **Shadowland (MC65, released 2026-10-16)
is now in this wave by the owner's instruction (2026-10-19): see `docs/phase7-shadowland.md`;** the "not released" and
"cycle unknown" wording above predates the release.

---

## 2. The MC60 box

**Files.** `docs/campaign-modes/mc60_rulebook-web.pdf` (28 pages; not renderable here) and
`docs/campaign-modes/markdown/mc60_fear_no_evil.md` (transcription; read in full this session) [checked]. The campaign
log is `docs/campaign-modes/log-sheets/mc60_campaign_log.pdf` [checked by glob]. The transcription's "Page N of 28"
headers are the rulebook's page numbers, unchecked against the PDF.

**Transcription problems** (read the text, not the summaries): the page 2 card callouts are scrambled, and the page 2
component line is partly garbled ("ELECTRO (1/14) / HIT POINTS 15 schemes, place 1 charge..."). Use the raw cache for
card text. Use the transcription for rules text only, and mark it unchecked.

### 2.1 Heroes

- **Daredevil**, `60001a` (alter-ego `60001b`, Matt Murdock). Sense deck `60002`–`60006` (`daredevil_sense_deck`, five
  cards, one copy each). Aspect and basic cards, nemesis set `daredevil_nemesis` (`60033`–`60036`: Bullseye, Deadliest
  Man Alive, Stolen Sai, Eye on the Target) and obligation Sensory Overload (`60032`) [checked raw; rulebook pp. 2, 25].
- **Echo**, `60037a` (alter-ego `60037b`, Maya Lopez). Aspect and basic cards, nemesis set `echo_nemesis` (Kingpin
  `60061`, Master Manipulator `60062`, Kingpin's Henchman `60063` ×2, Pawn of the Kingpin `60064`) and obligation Raised by
  the Kingpin (`60060`) [checked raw; rulebook pp. 2, 25].
- **Starter decks** (rulebook p. 25): every card name in the Echo and Daredevil lists is in the raw cache [checked].
  Quantities were not compared line by line.

### 2.2 Scenarios and villains

The five underling scenarios each combine one of five interchangeable main schemes with one of five interchangeable
underling villains (p. 5). The Kingpin scenario is the sixth. The rulebook's page order is shown.

| Scenario (p.)          | Main scheme deck                                        | Encounter sets (modular in bold)                                                     | Notes                                                                                                                                              |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protection Racket (13) | Protection Racket ×5, one per player, in each play area | Protection Racket, **Disasters**, **Tracksuit Mafia**, Standard, villain set         | Separate main schemes; Standard is from core. Check "Trust Established?" if Disturbed Psyche has 2+ threat.                                        |
| The Raft Breakout (15) | The Raft Breakout                                       | The Raft Breakout, **The Owl**, **Tombstone**, Standard, villain set                 | Master Key attachment deals minions face down instead of discarding them. Campaign setup gives Prisoner minions tough (and a boost at two checks). |
| Art Museum Heist (17)  | Art Museum Heist                                        | Art Museum Heist, **Cops**, **The Owl**, Standard, villain set                       | Four Art attachments; one starts on the villain.                                                                                                   |
| The Getaway (19)       | The Getaway                                             | The Getaway, **Cops**, **Drive**, Standard, villain set                              | Out Front / Alongside attachment on the villain; speed counters on the main scheme. Jackknifed Tanker Truck in setup.                              |
| Stop the Presses! (21) | Stop the Presses!                                       | Stop the Presses!, **Tombstone**, **Tracksuit Mafia**, Standard, villain set         | Each player starts with a random Daily Bugle support with Uses (3 stamina). A Bugle support leaving play loses the game.                           |
| Kingpin (23)           | The King's Gambit, Endgame                              | Kingpin, **Tombstone**, **Tracksuit Mafia**; no Standard (Expert set in expert mode) | Kingpin A1/A2 (B1/B2 in expert). Untouchable on his "1" side. Public Support counters. Nemesis minions' titles matter (§7).                        |

**Underling villains** (pp. 5, 8): **Bullseye** (I, II; expert II, III), **Electro** (I, II; expert II, III),
**Hammerhead** (I, II; expert II, III), **Purple Man** (I, II; expert II, III) and **Typhoid Mary** (A/B; B in expert).
Each has its own villain encounter set. Typhoid Mary wins differently: three tokens on Disturbed Psyche (p. 5). Her form
flips at the end of each villain phase (p. 5; FAQ p. 26) [checked for the text; unchecked against the PDF].

**Modular and scenario sets, checked against the repo.** None of `Disasters`, `Tracksuit Mafia`, `The Owl`, `Tombstone`,
`Cops`, `Drive`, the six scenario sets or the five villain sets appears as a `card_set_code` in any raw cache. The only
encounter-type sets in the raw cache are `standard` and `expert` (core), `standard_pvp` (Civil War, Synthezoid),
`standard_ii`/`expert_ii` (The Hood) and `standard_iii` (Age of Apocalypse) [checked by grep over
`packages/content/raw/marvelcdb`]. The box's set codes are unchecked and have to come from the PDF or a second source.

**Printed numbers.** The page 2 callouts give villain card numbers: Electro 65, Bullseye 86, Hammerhead 97, Typhoid Mary
110A, Kingpin 159A (unchecked). The rulebook's FAQ and setup refer to card numbers 40 (Photographic Reflexes, which is
`60040`), 112 (Disturbed Psyche), 113A (Establish Trust), 129A, 141, 145, 169, 205–209 (campaign environments) and 210
(Typhoid Mary ally) [unchecked]. So the box's own cards run from about 65 to about 276, and their MarvelCDB codes would
be `60065` onward. The raw cache stops at `60064` [checked].

**Card totals** (p. 2): 276 cards: 89 player, 16 villain, 171 encounter [unchecked]. The 89 matches the sum of the raw
player quantities [checked, §8.1].

### 2.3 Campaign rules

All "p." references are to the transcription's page numbers, unchecked against the PDF.

- **Scenario choice (p. 8; p. 9 step 4).** Five of the six scenarios make up the campaign, Kingpin last. After each game
  the players choose the next scenario. The first playthrough follows a recommended underling order (Hammerhead, Bullseye,
  Electro, then Purple Man or Typhoid Mary). Later playthroughs pick underlings at random (p. 8).
- **Environments (p. 8; p. 9 steps 1–3).** Five campaign environments, 205–209, each with a Completed and a Failed side.
  Before every scenario, including the first, two unresolved environments are drawn at random (one if only one is left).
  Each matching scenario is progressed by marking its first unmarked box. Three Xs mean the scenario has Failed and its
  penalty applies. A Completed scenario gives a benefit for the rest of the campaign.
- **Villain choice (p. 9 step 5).** A villain already recorded for a scenario must be used; otherwise the first
  unrecorded underling (first time through) or a random unrecorded one.
- **Deck surgery (p. 9 step 8).** Each player removes from the game each card titled in the "Allies/Supports Removed"
  section of the log. A deck below minimum size must be topped up.
- **Expert campaign (p. 9 steps 10–11; "Persistent damage"; "Elimination and victory").** Hit points carry over from the
  previous game (base is the ceiling). A player heals by dealing themself one face-down encounter card for REC. A player
  defeated during a scenario their team wins does not share the victory, but rejoins next scenario.
- **Typhoid Mary ally (pp. 13, 15, 17, 19, 21 "Victory"; p. 9 step 13).** Check "Trust Established?" when Disturbed Psyche
  has 2+ threat; check "Mary Defeated?" when ally 210 is in the victory display. While Trust is set and Mary is not
  defeated, the ally enters play in later games.
- **Kingpin (p. 23).** Setup: at least 3 Completed environments give each minion tough; 4 give the James Wesley attachment.
  Defeat in standard mode means a replay. In expert, flip one Completed environment to Failed and replay, or lose the
  campaign if none is Completed. Victory is defeating Kingpin.
- **Repo state for the campaign.** `packages/engine/src/campaign.ts` already names MC60 at lines 75–77 (scenario choice),
  262–263 (`beforeScenarioSetup`), 293 (`beforePlayerSetup`), 594 (choice gate), 710 (progression draw from
  `CampaignLog.rng`) and 768 (progress marks). `packages/client/src/view/campaign-scenario-choice-model.ts` exists;
  `docs/campaign-client-per-box.md` line 83 says MC60's choice board has no screen [checked by grep and read].

---

## 3. New keywords and mechanics

"FNE" is the rulebook transcription's "Featured Keywords" and "Featured Terms" (pp. 3–4). The index's "New keywords:
Discount, Starting" for Fear No Evil (index line 41) [checked] matches p. 3. Repo columns are checked by search.

| Term                                                    | FNE (p.)           | RRG 1.8 (p.)                                                                                | Status                 | Repo and raw                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Discount X (trait)**                                  | 3, new             | none (no "Discount" in the RRG) [checked]                                                   | New                    | Schema type in `packages/content/src/schema/keywords.ts`; engine `actions.ts` `discountFor` (applies once for any matching trait; FNE p. 26 FAQ). Raw: Know Your Enemy `60023` (Martial Artist), Legal Trouble `60026` (Attorney or Police), Move in Shadow `60027` (Martial Artist or Spy) [checked].                                                                                |
| **Starting**                                            | 3, new             | none; RRG p. 51 uses "starting hand size" only [checked]                                    | New                    | Schema setup keyword (`keywords.ts` ~lines 112–117). No engine enforcement found [checked]. Raw: Innate Reflexes `60038` (per `keywords.ts` comment, raw line unchecked); Innate Aggression, Perception and Inspiration `61034`, `61036`, `61037` (`jj.json` text lines 1855, 1948, 1994 [checked]).                                                                                  |
| **Prerequisite (form or trait)**                        | 3, new             | none [checked]                                                                              | New                    | Schema type only; no engine enforcement [checked]. Raw: `jj.json` line 1515, on the record named "Defend Our City" (name at line 1510) [checked text; card identity unchecked].                                                                                                                                                                                                       |
| **Sense deck** (not a keyword)                          | 2, 25, 26          | none [checked]                                                                              | New zone               | Raw set `daredevil_sense_deck` (`60002`–`60006`). Face-up; order is fixed; the top card is playable as if in hand by paying its cost (`60001a` text, checked); only the controller may trigger a Sense upgrade (p. 26 FAQ); an upgrade that leaves play goes to the bottom of the deck (identity forced interrupt, both sides, p. 26). No engine zone found by name search [checked]. |
| **Exactly defeat**                                      | 4, updated         | none [checked]                                                                              | Updated                | The character version matches the August 3, 2026 ruling (§5). The side-scheme version (a thwart that removes no more threat than needed) is only in the insert (p. 4). Used by Know Your Enemy and Stick (p. 25) [unchecked].                                                                                                                                                         |
| **Team-Up**                                             | 3, not flagged     | p. 43 (line 3440); summary p. 25 (line 2026) [checked]                                      | Not new                | `60031` Dance with the Devil: Team-Up (Daredevil and Elektra). `60055` See No Evil, Hear No Evil: Team-Up (Daredevil and Echo) [checked raw].                                                                                                                                                                                                                                         |
| **Temporary**                                           | 3                  | p. 44 (line 3464)                                                                           | Same                   | `60027` Move in Shadow: "Temporary. Max 1 per player" [checked].                                                                                                                                                                                                                                                                                                                      |
| **Tuck**                                                | 4                  | p. 45 (line 3598): tucked cards are not in play and are discarded when the card leaves play | Same                   | Raw text has "Tuck" on two lines in `fne.json` (not mapped to cards); Echo's identity response tucks events (rulebook p. 25) [unchecked].                                                                                                                                                                                                                                             |
| **Vulnerable**                                          | 3, updated (**)    | p. 48 (line 3802): discarded before damage, not defeated                                    | **Conflict**           | §7.1.                                                                                                                                                                                                                                                                                                                                                                                 |
| **Villainous**                                          | 3, updated (**)    | p. 47 (line 3788): already says "character"                                                 | Same wording           | Black Cat ally keeps villainous (FAQ p. 26) [unchecked; card not in the fne raw].                                                                                                                                                                                                                                                                                                     |
| **Amplify icon**                                        | 4, "UPDATED"       | p. 7 (line 520): "during an enemy activation"                                               | **Conflict**           | §7.2.                                                                                                                                                                                                                                                                                                                                                                                 |
| **Steady**                                              | 3                  | p. 41 (line 3284)                                                                           | Insert adds a sentence | §7.3.                                                                                                                                                                                                                                                                                                                                                                                 |
| **Patrol**                                              | 3                  | p. 32 (line 2476) detail; p. 25 (line 1980) summary                                         | Consistent             | Detail says "cannot use cards they control to thwart"; the p. 25 summary says "cannot thwart". The detail wins [checked].                                                                                                                                                                                                                                                             |
| **Hinder X**                                            | 3                  | p. 22 (line 1712): enters play with X threat, in addition to normal threat                  | Consistent             | `jj.json` line 1662 (Hinder 3) and line 1515 (Hinder 1) [checked text].                                                                                                                                                                                                                                                                                                               |
| **Permanent**                                           | 3                  | p. 32 (line 2520)                                                                           | Consistent             | Box attachments (Electric Charge, Adamantium-Laced Spine) are not in the raw [unchecked].                                                                                                                                                                                                                                                                                             |
| **Piercing**                                            | 3                  | p. 32 (line 2534)                                                                           | Consistent             | Not seen in the three raw files [checked by grep].                                                                                                                                                                                                                                                                                                                                    |
| **Victory X**                                           | 3                  | p. 46 (line 3678)                                                                           | Consistent             | Typhoid Mary's win uses tokens, not the victory display (p. 5).                                                                                                                                                                                                                                                                                                                       |
| **Setup**                                               | 3                  | p. 40 (line 3158)                                                                           | Consistent             | Setup cards and permanent set-aside (p. 32).                                                                                                                                                                                                                                                                                                                                          |
| **Stalwart**                                            | 3                  | p. 40 (line 3216)                                                                           | Consistent             | Fourth Art attachment grants it (p. 17) [unchecked].                                                                                                                                                                                                                                                                                                                                  |
| **Player side scheme**                                  | 4, "new"           | p. 34 (lines 2680–2708), including the limit                                                | Label stale            | Raw: Focus the Senses `60012`, Piecing It All Together `61007`, Run Them to Ground `61020` [checked names and types]. RRG 1.8 already defines it and the limit (one for one or two players, two for three or four).                                                                                                                                                                   |
| **Find**                                                | 4                  | p. 19 (line 1494): searches each area where the card could be found                         | Insert adds exclusions | Victory display, removed-from-game cards, face-down encounter cards and face-down boost cards are not searched (p. 4). The RRG is silent on those exclusions [checked].                                                                                                                                                                                                               |
| **Uses (X type)**                                       | 21 (Daily Bugle)   | p. 25 (line 2034) summary                                                                   | Same                   | `jj.json` Uses at lines 1711, 1760, 1809 (the Suggestion obligations) [checked text].                                                                                                                                                                                                                                                                                                 |
| **Surge**                                               | not in these packs | p. 42 (line 3336)                                                                           | Cross-cutting          | No Surge text in the three raw files [checked]. August 3, 2026 ruling (§5).                                                                                                                                                                                                                                                                                                           |
| **Toughness, Restricted, Alliance, Quickstrike, Guard** | not flagged        | p. 25 summary                                                                               | In the raw             | `jj.json` Toughness (line 229), Restricted (1230), Alliance (1377); `luke_cage.json` Toughness and Quickstrike [checked text].                                                                                                                                                                                                                                                        |

---

## 4. RRG 1.8 entries that bear on wave 11

- **Unique icon (p. 45, lines 3612–3626).** Two unique cards match if they share a title and neither has a subtitle or
  alter-ego title, or if one's subtitle or alter-ego title matches the other's title, subtitle or alter-ego title. The
  RRG's examples are "the Jessica Jones ally and the Jessica Jones minion" (line 3618) and an identity whose alter-ego is
  T'Challa matching a T'Challa ally (line 3620). A deck cannot hold matching cards; game effects can add them later, and
  identities chosen at setup cannot match. Raw alter-ego names are Matt Murdock (`60001b`), Maya Lopez (`60037b`), Jessica
  Jones (`61001b`) and Luke Cage (`62001b`) [checked]. On that reading, Jessica Jones's Luke Cage ally `61003` and Luke
  Cage's Jessica Jones ally `62002` match the other hero's identity through the alter-ego title. Daredevil ally `60039`
  and Echo ally `61038` do not match their identities, which have different alter-ego titles. Confirm on the physical
  card and the RRG examples before tests depend on it [unchecked].
- **Nemesis encounter set (p. 30, line 2350).** Each identity has one nemesis set; it is set aside at the start of the game
  and brought in by encounter cards. A nemesis set may only be used alongside an identity sharing its set icon.
- **Player side schemes (p. 34)** and the **player side scheme limit** (lines 2704–2708): see §3.
- **Setup order (p. 51, Appendix II).** Step 11 puts setup cards into play; step 13 is campaign setup; step 14 draws to
  hand size; step 15 is mulligans (lines 4010–4024) [checked]. Starting cards are searched for before the starting hand
  is drawn (FNE p. 3). The RRG has no Starting step, so where it slots in is a rules-architect decision (§7).
- **Environments (p. 71).** §1.
- **Appendix IV and V (FAQ and errata).** No entry names a card from these three packs [checked by name search over about
  25 names]. The one "Jessica Jones" hit is the unique-icon example above.

---

## 5. FFG rulings after RRG 1.7 that touch these packs

Source: `marvel-champions-rulings-post-rrg-1-7.md`, December 17, 2025 through August 13, 2026 (Hall of Heroes transcription;
the rulings specialist is Alex Werner) [checked]. Cite by date heading and ruling number. The file has no entries after
August 13, 2026. **No ruling names a Jessica Jones card, and two name Luke Cage cards.**

| Date (ruling)                                        | Ruling, in brief                                                                                                                                                                                                                         | Wave 11 cards (raw code)                                                                                                         | Bearing                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| June 25, 2026 (Ruling 2)                             | Raising Hell paid with Aggressive Energy: Aggressive Energy adds +1 damage to each enemy the effect damages (an enemy with 2 upgrades takes 4 + 1 = 5 in the example).                                                                   | Raising Hell `60011`. Aggressive Energy is in `mut_gen.json` (line 2676) and `wolv.json` (line 1109)                             | Damage calculation. The other card is outside wave 11.                               |
| June 25, 2026 (Ruling 6) and July 9, 2026 (Ruling 2) | Damage taken as a cost can be reduced or prevented, and the cost stays paid. "Reduce" (Metal Bracelet) and "prevent" (Aerial Evacuation) are the same for costs. Aerial Evacuation prevents damage taken, and the damage is still dealt. | `62010` Metal Bracer (raw name). Clarity of Purpose is in `spdr.json` (line 1511); Aerial Evacuation in `falcon.json` (line 494) | Name conflict (§10). Cost payment with damage prevention.                            |
| July 9, 2026 (Ruling 3, Q3)                          | Evaluate Threat reduces the cost for the next time it is played only. The question names Hellcat.                                                                                                                                        | None identified. Hellcat records are in `jj.json` (line 1318), `core.json` and `cw.json`                                         | Only matters if the Hellcat asked about is the JJ card; unchecked.                   |
| August 3, 2026 (Ruling 1)                            | Acute Tactility attached to Focus the Senses: Acute Tactility's interrupt resolves on the last threat's removal, before the scheme's When Defeated. It discards first, so Focus the Senses can retrieve it.                              | `60002` Acute Tactility; `60012` Focus the Senses (player side scheme)                                                           | Ordering of an interrupt against When Defeated on a player side scheme.              |
| August 3, 2026 (Ruling 2)                            | Echo's protection ally can reduce indirect damage to herself up to her remaining HP without exhausting. Valkyrie's interrupt resolves before allies are defeated, so she can sacrifice herself to save another ally.                     | Echo ally `61038` (`jj.json`, protection faction); Valkyrie ally `62014` (`luke_cage.json`, leadership)                          | Indirect damage and simultaneous defeat.                                             |
| August 3, 2026 (Ruling 5)                            | Team Investigation's printed cost scales with players: 2-player printed cost 4, dealing 4 with Echo's Katana.                                                                                                                            | Echo's Katana `60045`                                                                                                            | Cost scaling. The Team Investigation card's pack is not pinned down [unchecked].     |
| August 3, 2026 (Ruling 6)                            | To "exactly defeat" is to defeat by an attack that dealt no excess damage; damage reducers generally cannot be exactly defeated.                                                                                                         | None in wave 11                                                                                                                  | Consistent with insert p. 4 for characters. The side-scheme version is not ruled on. |
| August 3, 2026 (Ruling 3)                            | RRG 1.8's Surge is a When Revealed ability and can be cancelled by Enhanced Spider-Sense.                                                                                                                                                | None in wave 11 (no Surge text)                                                                                                  | Cross-cutting (RRG p. 42).                                                           |
| August 13, 2026 (Ruling 1)                           | Echo Stunned: an Attack event is still played, so play-triggered Responses resolve. A borrowed event goes to its owner's discard pile, so Study the Tape cannot tuck it.                                                                 | `60041` Study the Tape; Echo's identity `60037a`                                                                                 | Stun, play triggers, Study the Tape.                                                 |
| August 13, 2026 (Ruling 2)                           | Focus the Senses' When Defeated triggers after Interrupts to its defeat (such as Acute Tactility). Sense cards may be moved in and triggered before the scheme is discarded.                                                             | `60012` Focus the Senses; `60002`                                                                                                | Same ordering as August 3, Ruling 1.                                                 |

Cross-cutting, lower priority: June 2, 2026 (Ruling 3) on Galaxy's Most Wanted expert mode (heal to printed hit points at
no cost); August 3, 2026 (Ruling 4) on campaign rewards (negative victory points mark no node; Linked cards cannot enter
decks). Both concern campaign-level rules, not these boxes' cards.

---

## 6. Errata

No errata entry in the rulings file names a Fear No Evil, Jessica Jones or Luke Cage card [checked]. The errata in the file
are for other waves (Captain Marvel's Energy Channel, Ionic Physiology, Yellow Jacket, Phased Out). RRG 1.8 Appendix V has
none for these packs [checked, §4]. The insert is not errata.

---

## 7. Source conflicts and rules questions

**Authority order applied** (CLAUDE.md): RRG 1.8 > current errata > FFG rulings after 1.8 > older rulings consistent with
1.8 > engine interpretation. The insert is a product rules text and is not in the order. Where it conflicts with RRG 1.8
and no ruling exists, RRG 1.8 governs, and the code gets a comment naming both.

**7.1 Vulnerable (settled by the order: RRG 1.8).** RRG 1.8 p. 48 (lines 3802–3810): a character that would take enough
damage to be defeated and become stunned or confused is discarded before damage and is not considered defeated. Insert
p. 3 (updated): "the first player chooses whether that character is considered defeated or not." No ruling covers it.
Default: RRG 1.8. Ask FFG (§10, question 2).

**7.2 Amplify (settled by the order: RRG 1.8).** RRG 1.8 p. 7 (lines 520–524): boost cards turned face up during an enemy
activation gain one boost icon per amplify icon. Insert p. 4 ("UPDATED"): "When a character resolves a boost card while
using a basic power". Default: RRG 1.8. No wave-11 card is known to need the character case [unchecked].

**7.3 Steady (settled by the order: RRG 1.8).** Insert p. 3 adds: after the character's attack, scheme or thwart is
canceled by a status card effect, remove all status cards of the corresponding type. RRG 1.8 p. 41 (line 3286) has no such
sentence. Default: RRG 1.8.

**7.4 Patrol (wording, not substance).** The p. 25 summary is shorter than the p. 32 detail. The insert matches the detail.

**7.5 Exactly defeat for side schemes (only the insert speaks).** Insert p. 4 defines it for side schemes (a thwart that
removes no more threat than needed). RRG 1.8 has no definition and no ruling covers it. This is an engine interpretation
with the insert as its only source (§10, question 7).

**7.6 Player side scheme label (stale).** The insert marks it "new to this expansion". RRG 1.8 p. 34 already has it.

**Questions the rules architect owns (no source settles them):**

- **Sense deck as a zone.** Face-up, order fixed, playable from the top by paying cost, bottom placement when a Sense
  upgrade leaves play, controller-only triggers. `packages/engine/src/playable-top-of-deck.test.ts` exists and may be the
  nearest primitive [checked by filename only].
- **Starting placement.** Search the deck for the starting card before the hand is drawn (FNE p. 3). It is a setup keyword
  in the schema; the RRG's setup steps (Appendix II, p. 51) have no matching step.
- **Prerequisite enforcement.** Form (hero or alter-ego) or trait, checked when the card is played.
- **Nemesis minions sharing a title with a villain in play.** The insert removes a nemesis minion that shares a title with a
  character in play, but only in the Kingpin scenario (p. 23: "such as Echo's nemesis minion, Kingpin"). RRG p. 45 restricts
  matching only for deck building and identity choice. Default: only the Kingpin scenario removes one.

---

## 8. What is already in the repo

### 8.1 Raw caches (MarvelCDB, `packages/content/raw/marvelcdb/`)

- **`fne.json`** [checked]. `fetchedAt` 2026-09-13. 68 `code` keys: 66 non-alter-ego records plus two alter-egos
  (`60001b`, `60037b`). 89 player cards by summed `quantity` (identity, aspect, basic and Sense cards), matching rulebook
  p. 2. Encounter-type records: nemesis sets `daredevil_nemesis` (5 copies) and `echo_nemesis` (5 copies), and obligations
  `60032` and `60060`. Nothing else.
  - **Missing:** 16 villain cards and 159 encounter cards (the rulebook's 171 less the 12 above), about 175 in all. This
    follows from the rulebook's counts and printed numbers (§2.2) [unchecked against the PDF]. The MarvelCDB cache, not
    the box, is the likely cause; refetch before scripting.
  - **Photographic Reflexes** `60040a`, `60040b`, `60040c` have quantity 2 each: six copies in total, which matches the
    rulebook's "(x6)" and the FAQ's "one of the six copies" [checked raw; rulebook text unchecked]. This answers the
    curation file's worry that the three records were a duplication bug. Whether they are three printings or one card is
    still open for the pipeline (§10, question 8).
- **`jj.json`** [checked]. 43 `code` keys: 42 non-alter-ego records plus `61001b`. Set codes `jessica_jones` and
  `jessica_jones_nemesis`. Nemesis: Purple Man minion `61031` (a second "Purple Man", see §8.4), Indomitable Will (`61032`),
  "Suggestion" obligations `61033a`–`c` (energy, mental, physical). Ally cards named for other heroes include Luke Cage
  `61003`, Captain Marvel `61015`, Spider-Woman `61016`, Squirrel Girl `61017` and Echo `61038` [checked names]. No modular
  set. Fetched date not checked.
- **`luke_cage.json`** [checked]. 38 `code` keys: 37 non-alter-ego records plus `62001b`. Set codes `luke_cage` and
  `luke_cage_nemesis`. Nemesis (names): Cottonmouth, Venomous Whispers, Augmented Jaws, Asp, Sidewinder, obligation Internal
  Injury (`62028`). Ally Valkyrie `62014` (leadership). Unbreakable Bond `62024` is a duplicate of `61027` [checked]. No
  modular set. Fetched date not checked.
- `docs/cards/by_pack/{fne,jj,luke_cage}.md` are generated from these caches and say they are not authoritative [checked].

### 8.2 Emitted data

None. There is no `packages/content/src/data/fne`, `jj` or `luke_cage` directory [checked by glob].
`packages/content/src/data/index.ts` does not mention these packs [checked].

### 8.3 Curation

- **`packages/content/scripts/marvelcdb/curation/fne.ts`** exists [checked]. Its header says it is "Curated but NOT
  registered for emission", and it names the Requirement, Discount, Prerequisite and Starting gaps from phase 7 wave 2.
  - **Cycle label:** `cycle: { id: "cycle10", name: "Cycle 10", order: 10 }` (line 29). Change it to `cycle11` and name
    the cycle in the same PR. The Civil War cycle is `cycle10` in `cw.ts`, `hercules.ts` and `wonder_man.ts`.
  - **Release date** `2026-07-01` is a placeholder (day of month only). The source says "July, 2026" [checked].
  - Its Sense-deck handling is `auxiliaryHeroSetCodes` (`daredevil_sense_deck` to `daredevil`), the same mechanism as
    `storm.ts` and `hercules.ts`.
- **No `jj.ts` or `luke_cage.ts`** [checked by glob].

### 8.4 Name collisions

Each pair is a unique-icon question (§4) or a deck-building question:

| Title                         | Where                                                                                            | Note                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Bullseye                      | Daredevil nemesis minion `60033` (fne) and the Bullseye underling villain (box, not in raw)      | Different cards; §7.                                                         |
| Purple Man                    | Jessica Jones nemesis minion `61031` (jj) and the Purple Man underling villain (box, not in raw) | Different cards; §7.                                                         |
| Kingpin                       | Echo nemesis minion `60061` (fne) and the Kingpin villain (box, not in raw)                      | Insert p. 23 removes the nemesis minion in the Kingpin scenario.             |
| Echo                          | Echo identity `60037a` and Echo ally `61038` (jj)                                                | Different alter-ego title (Maya Lopez), so not a match on the reading in §4. |
| Daredevil                     | Daredevil identity `60001a` and Daredevil ally `60039` (Echo's set)                              | Same; not a match on the §4 reading.                                         |
| Luke Cage / Jessica Jones     | Hero identities `62001a` and `61001a`; allies `61003` and `62002`                                | Cross-pack matches on the §4 reading; check it.                              |
| Metal Bracer / Metal Bracelet | `62010` (raw) and the rulings                                                                    | §10, question 6.                                                             |

### 8.5 Art and music

- **Card art** (`assets/card-art/bundles/cards/`) [checked by glob]. About 127 files for `60xxx` (`.jpg` and `.png`), from
  `60001a` at least to `60051`; the listing was truncated. For `61xxx`: 21 codes (`61001a`, `61001b`, `61002`–`61006`,
  `61008`–`61011`, `61014`, `61015`, `61017`, `61019`, `61020`, `61023`, `61024`, `61026`, `61027`, `61029`). For `62xxx`:
  12 codes (`62001a`, `62001b`, `62002`, `62004`–`62006`, `62011`, `62013`, `62015`, `62018`, `62019`, `62022`). So Jessica
  Jones art covers 21 of its 43 codes and Luke Cage art 12 of 38. The missing ones include `62010` (Metal Bracer).
- **`art/heroes/_pending/`** [checked]: `60001a-daredevil/`, `60037a-echo/`, `61001a-jessica-jones/` and `62001a-luke-cage/`,
  each holding only `.gitkeep`.
- **Music** [checked by glob]. There is no `music/campaigns/fne`, no `music/scenarios/` folder for these packs, and no
  `music/packs` entry. `music/scenarios/_pending/` holds only registration and resistance folders. `music/campaigns/` has
  interlude and finale tracks for nine other boxes and none for MC60.

### 8.6 Earlier notes

- `PLAN.md` line 1242 (campaign table): MC60, six scenarios, zero campaign cards, "data only" [checked]. Line 1225 lists
  MC60 among boxes that need a design pass for their client [checked].
- `PLAN.md` lines 1206–1213: no instruction in `fne` adds a card to a deck; MC60's rewards are environment and scenario
  state [checked].
- `packages/content/src/schema/glossary.ts` lines 499–503 mark discount, prerequisite and starting as "later" boxes;
  `glossary.test.ts` lines 113–119 flag Discount as unverified and cite "Fear No Evil rulebook, p. 3" [checked].
- `packages/content/src/schema/keywords.ts` lines 22–46: the schema's own note that RRG 1.8 has no Discount entry [checked].

---

## 9. Hall of Heroes: inserts and starter decks (community pointers, not authorities)

Fetched with WebFetch this session. Hall of Heroes is a pointer; the insert PDFs are FFG's.

- **Fear No Evil** (index line 41): insert `mc60_rulebook-web.pdf` and campaign log `mc60_campaign_log.pdf` (both in the
  repo) [checked by name]. New keywords: "Discount, Starting" (matches p. 3). Heroes: Daredevil and Echo. Villains and
  scenarios as in §2.2. The page does not mention the modular sets, the Sense deck or expert mode [checked]. News: FFG
  articles of April 16, April 30 and May 12, 2026.
- **Jessica Jones** (index line 61): rules sheet `https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc61_rulesheet-web.pdf`.
  Starter deck listed, with no card names or quantities. New keywords: none listed. Card count: not stated. Designers: Frank
  Brooks, Tony Fanchi, Aaron Haltom. **The rules sheet could not be read here.**
- **Luke Cage** (index line 69): rules sheet `https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc62_rulesheet-web.pdf`.
  Starter deck listed, with no card names. New keywords: not shown. Designers: Aaron Haltom, Frank Brooks, Tony Fanchi,
  Caleb Grace. **The rules sheet could not be read here.**

So the Jessica Jones and Luke Cage starter lists, any keyword beyond the raw text, and the nemesis contents of the two
packs are "[unchecked]" for the community and the FFG insert, and "[checked]" for the raw cache only.

---

## 10. Open questions

Only the questions the authority order and the sources cannot settle, each with a recommended default:

1. **Cycle label.** `fne.ts` says `cycle10`; the handoff says cycle 11. _Default:_ `cycle11`, changed in the same PR as the
   emission.
2. **Vulnerable with simultaneous damage (§7.1).** _Default:_ RRG 1.8 p. 48. Ask FFG through the contact form, since the
   insert's wording is the only other source.
3. **Amplify for characters (§7.2).** _Default:_ RRG 1.8 p. 7. Confirm whether any card in these packs needs the character
   case before implementing either reading.
4. **Order of Jessica Jones and Luke Cage (both August 2026).** _Default:_ Jessica Jones first, matching the index order.
   This affects only the cycle's listing order.
5. **Shadowland (MC65).** Settled in part: released 2026-10-16, a scenario pack, in this wave (owner, 2026-10-19). Its
   cycle is still open (cycle 11 default); see `docs/phase7-shadowland.md` Q1.
6. **Metal Bracer or Metal Bracelet (`62010`).** The raw name and the rulings disagree, and no art exists locally for
   `62010`. _Default:_ keep the raw name, note "Metal Bracelet" in a comment on the ruling, and confirm against a physical
   card.
7. **Exactly defeat for side schemes (§7.5).** _Default:_ implement the insert's p. 4 text, since it is the only source, and
   record that in a comment.
8. **Photographic Reflexes codes `60040a`–`c`.** _Default:_ keep three records, each quantity 2, matching "(x6)" and the six
   copies. The pipeline decides whether they are printings or one card.
9. **Missing box cards.** The raw cache has none of the box's villain or encounter cards (about 175). _Default:_ refetch
   `fne` from MarvelCDB before scripting, and treat the rest of the box as blocked until the cards are in the cache or the
   PDF is read.
10. **Sense deck and Starting (§7).** _Default:_ the rules architect proposes a face-up deck zone and a setup-step placement
    for Starting, to be reviewed before `ability-scripting-engineer` starts `60002`–`60006` and `60038`.
11. **Unique-icon matches across packs (§4).** The Luke Cage and Jessica Jones allies may match the other hero's identity.
    _Default:_ apply the RRG p. 45 rule as written, confirm it on the physical cards, and add a deck-building test only
    after the confirmation.
12. **Rulebook and rules sheets.** The MC60 PDF and the two hero rules sheets cannot be read in this environment.
    _Default:_ proceed from the transcription and the raw caches, mark everything taken from them "[unchecked]", and
    install poppler (or use the owner's copy) before the rules QA pass.

---

## Sources

Repo files (read this session):

- `docs/phase7-wave10-sources.md` (outline and format), `docs/phase7-wave11-handoff.md`
- `mc_rulesreference_v18_compressed.md` (RRG 1.8; page from footer markers)
- `marvel-champions-rulings-post-rrg-1-7.md` (Hall of Heroes transcription of FFG rulings)
- `docs/campaign-modes/markdown/mc60_fear_no_evil.md`, `docs/campaign-modes/markdown/index.md` (MC60 transcription)
- `hallofheroes-llms.txt` lines 28, 32, 41, 49, 57, 61, 69, 113, 119
- `packages/content/raw/marvelcdb/{fne,jj,luke_cage}.json`, and `spdr.json`, `mut_gen.json`, `wolv.json`, `falcon.json`,
  `core.json`, `cw.json`, `hercules.json` for cross-references
- `packages/content/scripts/marvelcdb/curation/{fne,wonder_man,hercules,cw}.ts`
- `packages/content/src/schema/keywords.ts`, `packages/content/src/schema/glossary.ts`, `glossary.test.ts`
- `packages/engine/src/actions.ts` (`discountFor`), `packages/engine/src/campaign.ts`,
  `packages/engine/src/playable-top-of-deck.test.ts` (filename)
- `packages/client/src/view/campaign-scenario-choice-model.ts`, `docs/campaign-client-per-box.md`
- `PLAN.md` (lines 1206–1246), `docs/cards/by_pack/{fne,jj,luke_cage}.md`

Web (pointers, fetched this session):

- https://hallofheroeslcg.com/fear-no-evil/
- https://hallofheroeslcg.com/jessica-jones/
- https://hallofheroeslcg.com/luke-cage/
- https://hallofheroeslcg.com/shadowland/
- https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc61_rulesheet-web.pdf (not readable)
- https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc62_rulesheet-web.pdf (not readable)
