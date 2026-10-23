# Phase 7 working spec (task 1: sources and survey): Shadowland (MC65), delivered in the wave 11 PR

Owner instruction (2026-10-19): Shadowland just released and is added to wave 11 (PR #251, `feature/wave-11`) before the
client work. This file is the sources and survey pass only: **no data is emitted yet**. The model is
`docs/phase7-synthezoid.md` (a scenario pack added mid-wave; its §8 build order is copied below) and
`docs/phase7-wave11-scenarios.md` (Fear No Evil's encounter half, the closest precedent for a transcription from scans).
Agents do not edit statuses or open questions; they report, and the main session flips them. Facts below are tagged
[checked] (read this session from the named source) or [unchecked].

## 0. Sources

| Source                                                                                       | What it gave                                                                                               | State                          |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Hall of Heroes page `https://hallofheroeslcg.com/shadowland/`                                | release date, designers, card list by section, 45 card preview images, links (insert, article, stream)     | [checked], fetched             |
| Insert PDF `https://hallofheroeslcg.com/wp-content/uploads/2026/10/shadowland-rules-pdf.pdf` | 20 printed pages (11 PDF pages, photographs, **no text layer**): rules, three campaign scenarios, FAQ, log | [checked], all pages read      |
| FFG news article `https://www.fantasyflightgames.com/en/news/2026/7/28/creeping-corruption/` | product code MC65en, 90 cards, villains, mechanics summary                                                 | [checked] via WebFetch summary |
| MarvelCDB (`/api/public/packs/`)                                                             | **no Shadowland pack**: the newest packs are `fne`, `jj`, `luke_cage`; no `shadowland`, `mc65` or Elektra  | [checked] 2026-10-19           |
| Hall of Heroes rulings page (`/latest-ffg-rulings-post-rrg-1-7/`) and the repo's transcript  | no Shadowland ruling yet: no hit for Shadowland, Krahllak, corruption, TRAP! or Dark Protege               | [checked]                      |
| Hall of Heroes `shadowland-encounters-and-mods` and similar                                  | 404: the box/encounter gallery that Fear No Evil has is not published yet                                  | [checked]                      |
| Elektra Natchios and Luke Cage pages                                                         | linked as the next and previous releases                                                                   | [unchecked] not read           |

The starter-deck and poster links the index lists (`hallofheroes-llms.txt` line 113) are not on the live page; the live
page links the insert, rulings, the FFG article, a stream (`https://www.youtube.com/watch?v=hRaygimVGBI`) and the back
of the box. The index line (October 2026, "Lead Designer: TBA") is stale.

**The rules insert is in the repo.** `docs/campaign-modes/mc65_rulebook-web.pdf` (added) and the hand transcription
`docs/campaign-modes/markdown/mc65_shadowland.md` (added; listed in `markdown/index.md` and in
`docs/project/rules-authority.md`'s product rulebook table). The scraper script cannot read this PDF (photographs), so it
is not registered in `scripts/scrape_campaign_markdown.py`'s `CAMPAIGNS`, which would overwrite the transcription with an
empty file; a later contributor who OCRs it can register it. The insert is FFG's product rules text: it governs where
RRG 1.8 is silent and yields where they conflict.

## 1. The product

| Field          | Value                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Name, code     | Shadowland Scenario Pack; **MC65** (FFG article: MC65en); MarvelCDB code unknown (suggest `shadowland`)                    |
| Type           | Scenario pack, "extra-large", 90 cards, **no heroes**; a three-scenario campaign (insert p. 4)                             |
| Released       | **2026-10-16** (Hall of Heroes); announced 2026-07-27 [checked]                                                            |
| Designers      | Michael Boggs with Frank Brooks, Tony Fanchi, Aaron Haltom (the HoH page says "Frank Books"; the insert p. 19 says Brooks) |
| Expansion mark | a four-tier pagoda symbol before the collector number (insert p. 1)                                                        |

### 1.1 Cycle and chronology

Release order by date: Fear No Evil (MC60, 2026-07-24) < Jessica Jones (MC61) and Luke Cage (MC62) (2026-08-21) <
**Shadowland (MC65, 2026-10-16)** < Elektra Natchios (November 2026) < Iron Fist (November 2026). The HoH page links
Luke Cage as the previous release and Elektra as the next. No source names a cycle: the page names none, and the FFG
article only compares the villain selection to the non-Kingpin Fear No Evil scenarios. Product numbering (MC60 to MC62
now, MC65 here, so MC63 and MC64 are presumably Elektra and Iron Fist [unchecked]) points at one six-product cycle,
which the repo calls **cycle 11** (`fne.ts` carries `cycle10` today; the sources page §10 Q1 changes it to `cycle11` in
the emission PR). **Default: `cycle11`, `order: 11`, placed after Luke Cage by `releaseDate` (2026-10-16) and never
before Jessica Jones or Luke Cage**, the way Synthezoid is placed inside cycle 10 by date. The array order in
`WAVE11_*` must agree with the date (Fear No Evil, Jessica Jones, Luke Cage, Shadowland), because several places read an
array and not the date (`docs/phase7-synthezoid.md` §1.2). Open question Q1 below records the alternative.

### 1.2 What the pack contains (insert pp. 1 to 5, FFG article)

- **Three scenarios**, playable alone or as a campaign in order: #1 Shadows in the Night, #2 Shadow Labyrinth, #3 Heart of
  Shadow (Krahllak). The campaign is won by winning all three (p. 4); a loss may be reset with no penalty (p. 5).
- **One special encounter set, Dark Protege** (16 cards, "six villain cards and 10 other encounter cards linked to those
  villains"; cannot be used outside the pack): Archpriestess, Daredevil (possessed), Elektra (possessed), Gorgon, Lady
  Bullseye, White Tiger (possessed). Scenario #1 uses one of the six as its villain; the FFG article says each has five
  linked cards that enter the encounter deck only when that villain is chosen. **Settled by the cards (Q4, 2026-10-22):
  both are right.** Each of the 10 linked cards prints "Linked (X, Y, or Z)" naming three villains, so 10 x 3 = 30 links
  = 6 villains x 5 linked cards each.
- **Three modular sets:** Black Flower (13), Deadly Contraptions (11), Ninja Swarm (9). Black Flower is **prohibited as a
  modular set in any scenario while playing the campaign** (p. 5) because the campaign instructions use it.
- **Per-set counts printed on the cards** (footer "SET (n/N)"): Shadows in the Night 13, Dark Protege 16, Ninja Swarm 9,
  Shadow Labyrinth 11, Deadly Contraptions 11, Heart of Shadow 17, Black Flower 13; total 90 [checked, sums to the FFG
  count]. Shadows in the Night, Shadow Labyrinth and Heart of Shadow are the scenario sets (villain, main scheme(s),
  scenario cards); "Whisper in the Dark", the one TRAP! attachment, is in Shadow Labyrinth (p. 12).
- **Campaign cards and log:** the log is on the back cover (p. 20) and records: each player's identity, remaining hit
  points (expert campaign), two recorded supports or upgrades, whether each player's Creeping Corruption was
  OVERPOWERING in scenarios 1 and 2, and which Dark Protege villains are removed. The log's six villains: Archpriestess,
  Daredevil, Lady Bullseye, Elektra, White Tiger, Gorgon. No campaign ally or obligation is known.
- **No player cards, no hero decks, no starter decks** known (the index mentions a starter deck link that the page does
  not carry; Q6).

### 1.3 Cards seen in the Hall of Heroes previews (45 faces of 90)

The page shows 45 images (300 x 426 px, 426 x 300 for landscape faces), 43 names; every card is footer-labelled with its
set position and collector number. Collector numbers: Shadows in the Night 1 to 11 (with 3A/3B and 4A/4B double-sided),
Dark Protege 12A to 17A (villains) then 18 to 27, Ninja Swarm 28 to 36, Shadow Labyrinth 37 to 45, Deadly Contraptions
46 to 56, Heart of Shadow 57 to 71, Black Flower 72 to 78. **Settled by the full-size cards (Q5, 2026-10-22):** the two
sets do not overlap. Heart of Shadow is 57 to 59 (Krahllak I, II, III), 60A/B and 61A/B (main schemes), 62 to 69, and
70 and 71 (two copies each) = 17; Black Flower is Creeping Corruption 72A/B (x4, positions 1 to 4), 73 (5/13), 74, 75,
and 76, 77 and 78 (two copies each) = 13. All "type" notes below are read from the card
frames and are [unchecked] where marked "?".

| Set (position / printed total) | Seen (collector number; file stem under `.../2026/07/mc65_cards_`)                                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shadows in the Night (13)      | The Streets Below / Atop the Tenshu, two double-sided environments (3A/3B `the_streets_below_villian` + `atop_the_tenshu_villian`; 4A/4B `the_streets_below_hero` + `atop-the-tenshu_hero`); Black Tarantula 5; Strategic Positioning 8 (landscape); Chaos in Hell's Kitchen 10; Moonlit Silhouette 11 |
| Dark Protege (16)              | Archpriestess 12A, Daredevil 13A, Elektra 14A, Gorgon 15A, Lady Bullseye 16A, White Tiger 17A (villains, HP 15 per hero; the file stems `_daredevil`, `_elektra`, `_gorgon` have a double underscore); Art of the Kill 18, Krahllak's Blessing 19, Darkness Within 26, Embraced by Darkness 27         |
| Ninja Swarm (9)                | Black Mountain 28, Bo Staff Ninja 30, Katana Ninja 32, Dancing Shadows 35 (landscape), Countless Numbers 36                                                                                                                                                                                            |
| Shadow Labyrinth (11)          | Shifting Corridors 37 (villain, hit points infinity), Into the Labyrinth 38 (landscape, main scheme?), Chamber of Vile Secrets 39 (landscape), Lord Deathstrike 41, No Time to Think 44, Sudden Shift 45, Dead End (6/11, landscape)                                                                   |
| Deadly Contraptions (11)       | Nervous Jitters 46, Iron Monk 47, Hall of Punishment 48 (landscape), Path of a Thousand Cuts (4/11, landscape), Blinding Powder 50, Caltrops 51                                                                                                                                                        |
| Heart of Shadow (17)           | Krahllak 57 (villain stage I of three: 57 = I, 58 = II, 59 = III, each one-sided; SCH 2, ATK 3, 18 per hero, Steady, Interrupt), Mark of the Wicked 64, Pull of Power 65, Hellbride 67, Snakeroot Elders 69, Veil of Nightmares (14/17, landscape), Submit or Suffer 71                                |
| Black Flower (13)              | Creeping Corruption 72A and 72B (A side and "overwhelming" side, one double-sided upgrade, `creeping_corruption_a-side`, `creeping_corruption-overwhelming_side`)                                                                                                                                      |

**Not previewed (about 45 faces):** Dark Protege villain B sides and 6 to 10 linked cards, most of Ninja Swarm (the FFG
article says seven Ninja minions; four are seen), Shadow Labyrinth's villain B side, Whisper in the Dark and the seven
other TRAP! treacheries (Deadly Contraptions, p. 12), all but one of the Black Flower cards, the main scheme faces
(stage 1B or 2 of each scenario), most of Shadows in the Night and Heart of Shadow, and the duplicate copies. The FFG
article names a Dark Shroud card (an announcement image `mc65_announcement_article_splash_dark_shroud.png` exists, not a
card scan). The card types are not named anywhere on the page.

## 2. Scans: what exists and where from

- **Local:** none (`assets/card-art/bundles/cards/` has no `65xxx`; the folder is gitignored).
- **Hall of Heroes:** 45 previews, direct URLs `https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc65_cards_<stem>.png`
  (the stems are in §1.3; the page's `href`/`src` list is the index). **Low resolution** (300 x 426) and legible but small:
  text is readable, the icons and the footer are, a boost icon or a threshold in the small print needs a second look. The
  whole box gallery (`shadowland-encounters-and-mods`, the page Fear No Evil's scans came from) returns 404 today.
- **MarvelCDB:** nothing; it will carry the pack once its maintainers transcribe it, and `fne`, `jj` and `luke_cage` show
  it can be weeks (the Fear No Evil scenario half still has no MarvelCDB records, `docs/phase7-wave11-data-survey.md`).
  Check the pack list again before each task starts; if it appears the plan becomes a normal ingest with the scans as the
  second source.
- **Tooling:** `scripts/fetch_card_art.py`. `fetch` and `missing` need a `PACK_PAGES` entry (`"shadowland": "shadowland"`,
  line 137 block) and card codes in the pool, so they come after D2. `grab --page https://hallofheroeslcg.com/shadowland/
  --out <scratch dir>` downloads the previews now into a directory **outside** `assets/card-art/` (the script refuses
  that location, and no art bytes belong in the repo: `CLAUDE.md` "Content & IP boundaries"). This session's copy is
  in the session scratch directory only and is not part of the deliverable.
- **PDF insert:** the 11 PDF pages render at 90 dpi well enough to read the text (done); render at 150 dpi for the small
  print of pp. 8 to 9 and 12 to 13 before building.

## 2.1 Was locked until the scans were posted; unlocked 2026-10-22 (implementation note)

**Unlocked 2026-10-22.** All 53 missing faces were transcribed from full-size card images
(owner-approved, 2026-10-22; the images are kept outside the repo, no art is committed). Footer checks: 40 = Whisper in
the Dark (Shadow Labyrinth 4/11), 42 = Dead End (6/11), 43 = Hall of Hidden Doors (7/11). Shifting Corridors (37) has
**no B side**: the scenario is won through main scheme 1B (Into the Labyrinth: threshold infinity, damage to Shifting
Corridors removes threat from it, removing the last threat advances to 2A). The seven sets were scripted and taken out
of `UNSCRIPTED_ENCOUNTER_SET_IDS` on `feature/shadowland-unlock` (PR #355). The rest of this section is kept as the
record of the lock.

Shadowland was **locked** from 2026-10-20 (owner): its seven sets stayed in `UNSCRIPTED_ENCOUNTER_SET_IDS`
(`packages/cards/src/playable/unscripted.ts`), so no scenario, modular pick or campaign offered it, and wave 11 shipped
without it. On the 2026-10-20 re-check the Hall of Heroes page (`https://hallofheroeslcg.com/shadowland/`) still showed
only the 45 preview faces (`fetch_card_art.py grab` saved those 45 plus announcement splashes and a fan of the six Dark
Protege A sides), so nothing new could be transcribed.

**What was missing** (collector numbers from the card footers, §1.3):

| Set                       | Missing faces                                                                                                                                                           | Blocks                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Shadows in the Night (13) | 1, 2, 6, 7, 9 and the rest not previewed, incl. the main scheme faces (1A/1B and any stage 2)                                                                           | scenario #1 record (`shadows-in-the-night`)   |
| Dark Protege (16)         | the six villain B sides 12B to 17B; linked cards 20 to 25                                                                                                               | the villain choice, each villain's linked set |
| Ninja Swarm (9)           | 29, 31, 33, 34 (the FFG article names seven Ninja minions; four are seen)                                                                                               | the modular set                               |
| Shadow Labyrinth (11)     | 38A and 39A (the main scheme fronts; 38B and 39B are held in `SHADOW_LABYRINTH_B_FACES_PENDING_A`), 40, 43 (Whisper in the Dark is one), 42, Shifting Corridors' B side | scenario #2 record (`shadow-labyrinth`)       |
| Deadly Contraptions (11)  | 49 and 52 to 56 (the other TRAP! treacheries)                                                                                                                           | the trap deck's full contents                 |
| Heart of Shadow (17)      | 58 to 63 (incl. the main scheme faces), 66, 68, 70, Krahllak's other stage if any                                                                                       | scenario #3 record (`heart-of-shadow`)        |
| Black Flower (13)         | everything but Creeping Corruption 72A/72B                                                                                                                              | the campaign's Black Flower setup             |

**Where they were to come from:** Hall of Heroes first (preferred, owner 2026-10-20): when the Shadowland page or a
card database page listed the full set, the plan was to run
`uv run scripts/fetch_card_art.py fetch --packs shadowland --fill-missing --dry-run -v` (the pack's page is mapped in
the script), then without `--dry-run`, then `compress`; anything it could not match by name,
`grab --page https://hallofheroeslcg.com/shadowland/ --out <scratch>` and transcribe by hand as §3 describes. Fallbacks:
MarvelCDB once it carries the pack, or the owner's own photos of the physical cards. Then: transcribe (D2/D3), set
`scenarios: SHADOWLAND_SCENARIO_RECORDS` in `curation/shadowland.ts` and re-emit (D4), script the new refs, run QA, and
remove the seven ids from `UNSCRIPTED_ENCOUNTER_SET_IDS` / `GATED_THOUGH_SCRIPTED`.

## 3. How the data will be produced (the Fear No Evil method)

The Fear No Evil scenario half was pulled from Hall of Heroes with `scripts/fetch_card_art.py` and transcribed by hand as
`addedRecords` (RawCard-shaped literals) in `packages/content/scripts/marvelcdb/curation/fne-encounter/*.ts`, one file per
group (`villains-a.ts`, `villains-b.ts`, `kingpin.ts`, `scenarios.ts`, `modular-campaign.ts`), joined into
`curation/fne.ts`; see `docs/phase7-wave11-data-survey.md` §3 (the transcription option) and
`docs/phase7-wave11-scenarios.md` S0 and S1. Shadowland has no raw cache at all, so every record is an added record:

1. A new `curation/shadowland.ts` (`packCode: "shadowland"`, `cycle: { id: "cycle11", name, order: 11 }`, `releaseDate:
   "2026-10-16"`, `outDir: "src/data/shadowland"`, `exportPrefix: "SHADOWLAND"`) plus `curation/shadowland-encounter/*.ts`,
   one file per set (7 files: the three scenario sets, Dark Protege villains, Dark Protege linked cards, and the three
   modular sets). A pack with no raw file needs the empty-raw path (`curation/empty.ts` is the existing example to read
   first, [unchecked]).
2. **Each record is transcribed from the full-size scan once, then second-checked by a different agent against the same
   scan**, set by set (the owner's rule for this wave). The checker records every mismatch in a scan-check note in the
   style of `docs/phase7-synthezoid-scan-check.md` and fixes it with a `typo(...)`-style correction. A record whose scan is
   missing or too small to read is not guessed: it is written with a `cardNotes` line and left for the owner's list.
3. Fields per record: code (`65` + collector number, to be confirmed against the full scans, Q5; a/b for double-sided),
   name, type, set, traits, keywords, text, stats, hit points per hero, stage, threat, boost icons, quantity, flavor
   text. The printed text is `printed`; a later erratum goes to `current` (§0 of the synthezoid spec shows the shape).
4. The insert's rules (§4) give the card-text _meaning_; the cards' printed text is the data.

## 4. New rules and mechanics (insert; for the engine and scripting handoff)

Status as of 2026-10-22 (PR #355): every row is **built**, with the module and the test that covers it. (The survey of
2026-10-19 marked each row **exists (verify)** or **new**; the history is in git.)

| #   | Mechanic (source)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Status                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Villain and hero positions** (p. 8): two double-sided environments, "The Streets Below" / "Atop the Tenshu", with traits VILLAIN POSITION and HERO POSITION; "change the villain's position" flips the VILLAIN POSITION card; "the positions are the same / different" compares the two faceup titles; the villain-position card carries both the "if both are the same" and the "if different" abilities                                                                                                                                                                                                                                                                                                        | **built** (`packages/cards/src/wave11/shadowland/shadows-in-the-night.ts`; `packages/engine/src/positions-passage.test.ts`, `packages/cards/src/wave11/shadowland/shadows-in-the-night.test.ts`)               |
| M2  | **Creeping Corruption** (Black Flower 72A/72B, pp. 9, 14, 17, FFG article): a double-sided upgrade with the Setup keyword on its A side put into play under each player's control by the campaign instructions (and by the scenario setup in a standalone game, [unchecked]); **corruption counters** gained voluntarily or by card effects and removed by other cards; the **OVERPOWERING** trait on the overwhelming side drives campaign records; too much corruption "turns a hero into a Dark Protege"                                                                                                                                                                                                        | **built** (`packages/cards/src/wave11/shadowland/creeping-corruption.ts`, `packages/cards/src/wave11/shadowland/black-flower.ts`; `packages/cards/src/wave11/shadowland/creeping-corruption.test.ts`)          |
| M3  | **The trap deck** (pp. 12 to 13, FAQ p. 18): a second encounter-card deck of the TRAP! treacheries plus one attachment (8 cards, more with other modular sets); "reveal a card from the trap deck" reveals the top card; a TRAP! card that would be discarded goes to a **trap discard pile**; an empty trap deck is reshuffled from that pile **without counting as resetting the encounter deck and without an acceleration token**; effects may shuffle encounter cards into the trap deck, and a non-TRAP! card discarded from it goes to the encounter discard pile; a surge from the trap deck reveals the next card from the **encounter** deck. Most TRAP! cards offer Avoid, Disarm or Trip (FFG article) | **built** (`packages/engine/src/resolve/game-areas.ts`, `packages/engine/src/state.ts`; `packages/engine/src/trap-deck.test.ts`, `packages/cards/src/wave11/shadowland/deadly-contraptions.test.ts`)           |
| M4  | **Infinite hit points** (p. 13): the Shifting Corridors villain cannot be defeated by damage; damage can still be dealt (attacks, effects)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **built** (`packages/engine/src/counter-limit.ts`; `packages/cards/src/wave11/shadowland/shadow-labyrinth.test.ts` "is never defeated by damage")                                                              |
| M5  | **Passage counters** on Shifting Corridors (p. 13): set during setup, removed by abilities, **the players lose when none remain**; the hit point dial is a display aid                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **built** (`packages/cards/src/wave11/shadowland/shadow-labyrinth.ts`; `packages/engine/src/positions-passage.test.ts`, `packages/cards/src/wave11/shadowland/shadow-labyrinth.test.ts` "the players lose")    |
| M6  | **Assault** keyword (p. 2): a basic thwart against an assault scheme uses ATK instead of THW; an ally takes the consequential damage printed under its ATK                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **built** (verified: the keyword; `packages/engine/src/assault.test.ts`, `packages/cards/src/wave11/shadowland/shadow-labyrinth.test.ts` "has Assault")                                                        |
| M7  | **Linked (Card Title)** (p. 2): set aside at the start unless a card in the encounter deck or a player's deck names it; does not count toward deck size; the six Dark Protege villains' linked cards come in only with their villain                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **built** (`packages/engine/src/deck.ts`, `packages/cards/src/wave11/shadowland/dark-protege.ts`; `packages/engine/src/linked-set-aside.test.ts`, `packages/cards/src/wave11/shadowland/dark-protege.test.ts`) |
| M8  | **First Player Action** (p. 2): only the first player may trigger it, any time they may take a standard action (a hero action by the first player)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **built** (`firstPlayerOnly`, `packages/engine/src/legal.ts`; `packages/cards/src/wave11/shadowland/shadows-in-the-night.test.ts` "is a First Player Action")                                                  |
| M9  | Keywords the insert re-explains (pp. 2 to 3): Hinder X, Patrol, Permanent, Piercing, Ranged, Setup, Stalwart, Steady, **Teamwork (TRAIT)**, **Villainous**; NINJA Teamwork follow-up order (FAQ p. 18: the new minion's Teamwork checks only after the original's When Defeated resolves and it is discarded)                                                                                                                                                                                                                                                                                                                                                                                                      | **built** (Teamwork FAQ order: `packages/cards/src/wave11/shadowland/ninja-swarm.test.ts`; Villainous: `packages/cards/src/wave11/shadowland/shadow-labyrinth.test.ts`)                                        |
| M10 | **Krahllak's Interrupt** (FAQ p. 18): "when Krahllak attacks you" is chosen before a teammate decides to defend (an interrupt that resolves at the attack's start)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **built** (`packages/cards/src/wave11/shadowland/heart-of-shadow.ts`; `packages/cards/src/wave11/shadowland/heart-of-shadow.test.ts` "the attacked player decides before a teammate")                          |
| M11 | **Dealing a hero a facedown encounter card** to restore hit points (pp. 6, 14, 17), and "deal one minion at random to each player as a facedown encounter card" (p. 17)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **built** (`packages/cards/src/campaigns/shadowland.ts`; `packages/cards/src/campaigns/shadowland.test.ts`)                                                                                                    |
| M12 | **A Streets Below effect that places threat and stuns "your identity"** (FAQ p. 18): choose one effect, resolve it fully, then flip the environment ("then" ordering; the flip does not happen when the chosen effect cannot resolve at all)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **built** (`packages/cards/src/wave11/shadowland/shadows-in-the-night.ts`; `packages/cards/src/wave11/shadowland/shadows-in-the-night.test.ts` "FAQ p. 18")                                                    |

### 4.0 Settled by the authority order (rules expert, built on `feature/shadowland-unlock`)

Each reading below was put to the rules expert, built to its verdict, and cited in the code where the behavior is not
obvious from the card text.

| Question                                                                 | Verdict (built)                                                                                                                          | Source                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shadow Labyrinth: is the set-aside chosen villain revealed?              | No: it stays set aside and hidden until Whisper in the Dark or 2A brings it out. 65038A prints no "reveal", unlike 65001A                | RRG p. 39 ("Set Aside") is silent on facing; engine reading from the card text (authority step 5); owner question 2 |
| Lady Bullseye (65022): whose attack is redirected, and who breaks a tie? | The same attack is retargeted to your ally (an attack on your ally still attacks you); Crossfire precedent; ties: the first player picks | Wave 4 spec §3.21 (Crossfire); RRG p. 25, p. 8; "First Player" p. 19                                                |
| Shadowy Plot (65025): reveal 1 of 3, then discard the rest               | The chosen card is revealed first; only the looked-at cards still in the deck are then discarded (a surge reveal is not)                 | RRG "Surge" p. 42                                                                                                   |
| Whisper in the Dark as a minion: which text and hit points?              | Side A text stays; its 6 printed hit points are flat (not per player)                                                                    | RRG p. 12, p. 35                                                                                                    |
| A Dark Protégé villain discarded as a minion                             | It is removed from the game (a double-sided card)                                                                                        | RRG p. 17; ruling 2025-06-10 (Magneto's Fortress)                                                                   |
| Whisper in the Dark leaving the minion role                              | The card stays in play as a villain (a status change, not leaving play)                                                                  | Ruling Dec 17, 2025 (1) #3; owner question 4                                                                        |
| The chosen villain defeated or removed before 2A                         | It is removed from the game; 2A finds nothing and the game goes on under the Grim Rule                                                   | RRG p. 15, p. 17; Grim Rule p. 4; owner question 8 (default built)                                                  |
| Trap Disarm: may it target a Permanent card?                             | No: Permanent cards are excluded from Disarm targets                                                                                     | Insert p. 3 (Permanent)                                                                                             |
| Kirigi: may a spend the player cannot pay be chosen?                     | Yes, it may be chosen (and resolves as far as it can)                                                                                    | Wave 9 spec Q33                                                                                                     |

### 4.1 Campaign layer (new work; the model is `docs/phase7-wave11-scenarios.md` S3.11 to S3.15 and S5)

A campaign definition (`SHADOWLAND_CAMPAIGN_DEFINITION`, under `packages/cards/src/campaigns/`) with three scenarios in
a fixed order (no branching; a loss resets with no penalty), and a log with these fields (insert pp. 9 to 20):

- per player: identity (cannot change during the campaign; aspects and deck may), remaining hit points (expert only,
  capped at the base value), up to **two recorded supports or upgrades** (cost 2 or less, no cost "-" not allowed; one chosen
  per scenario win), and a per-scenario flag "Creeping Corruption had OVERPOWERING";
- a **removed Dark Protege villains** set (six names): scenario #1 checks off the villain it used; **choosing Daredevil or
  Elektra as your identity removes that villain from the campaign**; scenario #3's four minions (Archpriestess, Gorgon,
  Lady Bullseye, White Tiger) are dealt out by the campaign instructions;
- per-scenario Setup steps (p. 9, 14, 17) and Victory steps (pp. 9 to 10, 14 to 15, 17), the **expert campaign** steps
  (persistent damage; restore by a facedown encounter card), and the extra threat on the main scheme (+1 [per_hero] in #1,
  +3 [per_hero] in #2, none printed in #3, which should be read against the PDF).
- Black Flower is excluded from the modular picker in campaign mode (p. 5), but stays selectable in a standalone scenario.
- Whether each scenario's own text also shapes its setup (scenario #3: "Find the four minions from the Dark Protege set",
  p. 17) is a stage 1A Setup matter for the scripts, not the log.

## 5. Questions (default is built unless the owner says otherwise)

| Q   | Question                                                                                                                                        | Default                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Which cycle? No source says; product numbering suggests cycle 11 with the Fear No Evil box                                                      | `cycle11`, order 11, after Luke Cage by date (§1.1); a separate "cycle 12" only if FFG says so                                                                                                                                                                                                                                             |
| 2   | Is the pack's MarvelCDB-style code `shadowland`, `mc65`, `sl`, ...? MarvelCDB has not published it                                              | `shadowland` (matches `PACK_PAGES` and the HoH slug); recode if MarvelCDB differs                                                                                                                                                                                                                                                          |
| 3   | The pack has no heroes: does anything unlock it? (Synthezoid's precedent: it opens with the cycle's existing gate, no new hero reward)          | no new unlock row; the three scenarios and the campaign open with cycle 11's gate. **Built 2026-10-22:** this branch adds `alsoCampaignIds: ["shadowland"]` to the cycle 11 wave in the client's `progression/unlocks.ts`                                                                                                                  |
| 4   | Dark Protege: 16 cards = 6 villains + 10 linked, versus the FFG article's "five linked cards per villain"                                       | read the full-size scans; build to the cards, and flag the article **Settled 2026-10-22:** each linked card names three villains; 10 x 3 = 30 = 6 x 5. Both sources agree.                                                                                                                                                                 |
| 5   | Collector numbers: Heart of Shadow runs to 71 and past while Black Flower starts at 72A; the codes of double-sided and duplicate-numbered cards | read each footer from the full-size scans; **no code is guessed** (a wrong code mismatches MarvelCDB later) **Settled 2026-10-22:** Heart of Shadow 57 to 71, Black Flower 72 to 78, no overlap (§1.3).                                                                                                                                    |
| 6   | The index mentions a starter deck: does a precon list exist (heroes are not in the pack)?                                                       | none; do not invent; ask only if a page appears                                                                                                                                                                                                                                                                                            |
| 7   | Scenario #3's Creeping Corruption: the p. 17 setup prints no "put 1 Creeping Corruption into play" step                                         | it carries over from scenario #2 (the p. 17 text counts corruption on "their Creeping Corruption upgrade"); verify at the PDF **Settled 2026-10-22:** Dark Invitation 60A Setup prints "Each player puts a Creeping Corruption upgrade into play. Set the rest aside."                                                                     |
| 8   | Corruption "turns a hero into a Dark Protege" (FFG article): what does the card text do (take over, lose, or defeat)?                           | read the Overwhelming side and the Dark Protege cards in the second-check pass; rules expert before scripting **Settled 2026-10-22:** 72B prints "If there are at least 5 corruption counters here, you are defeated" (the controller's hero is defeated); scripted in `creeping-corruption.ts`, audited in `docs/phase7-shadowland-qa.md` |
| 9   | The unrevealed art-less faces (B sides, linked cards): who supplies scans?                                                                      | owner list at D8; HoH's box gallery when published; nothing is transcribed from memory **Settled 2026-10-22:** transcribed from full-size card images (owner-approved).                                                                                                                                                                    |
| 10  | The insert is photographs of a printed booklet, not a clean PDF: is there a text copy?                                                          | the hand transcription stands; the FFG PDF, if published, replaces it                                                                                                                                                                                                                                                                      |

### 5.1 Owner answers

| Q   | Question                                                                                                                             | Owner answer                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | The 30 unscanned faces (all three main schemes among them): supply scans, or wait?                                                   | Quin, 2026-10-20: lock Shadowland for now. Hall of Heroes still shows only the 45 previews (re-grabbed 2026-10-20); the sets stay gated in `playable/unscripted.ts` and wave 11 ships without it. **Follow-up 2026-10-22:** the 53 missing faces were transcribed from full-size card images (owner-approved) and Shadowland was unlocked on `feature/shadowland-unlock` (PR #355, §2.1).                                                  |
| K1  | Krahllak's Blessing (65019): "would take any amount of damage **from a character** ... attacks that character". Which damage counts? | Quin, 2026-10-20: follow RRG 1.8 "You, Your" (p. 49). Character-sourced damage includes an identity's, an ally's and an enemy's own, and an event's or upgrade's attributed to the identity, labeled "(attack)" or not. Support, player side scheme and encounter-card damage is not attributed to an identity through ownership. Built as `TargetQuery.actsFor` (`actingCharacterOf`); an enemy source is reduced but cannot be attacked. |

**Owner questions for PR #355** (the PR's "What needs you"; each default is built and none blocks merging. 1 to 8 are
the PR's items, 9 to 13 the QA audit's "Unsettled rules questions", `docs/phase7-shadowland-qa.md`):

| #   | Question                                                                                                                              | Options (recommended first; A is built)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Card art for 39 faces: only the 45 Hall of Heroes preview scans are in the repo                                                       | A: ship without art and add scans when Hall of Heroes posts the box gallery. B: the owner supplies art **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                           |
| 2   | Hidden villain in Shadow Labyrinth (§4.0)                                                                                             | A: the drawn Dark Protégé villain stays facedown until Whisper in the Dark or 2A reveals it (1A prints no "reveal"). B: show it when drawn **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                       |
| 3   | Picking a Dark Protégé villain ("choose 1 random villain")                                                                            | A: random by default, with a labelled house pick. B: random only **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                                                                 |
| 4   | Whisper in the Dark discarded by a player card during stage 1 (§4.0)                                                                  | A: it stays in play as a second villain until 2A (status change, ruling Dec 17, 2025). B: it is set aside. C: it stays in play but inert **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                         |
| 5   | Campaign: scenario 2's villain checked off?                                                                                           | A: not checked off, since p. 15 prints no bullet. B: checked off like scenario 1's **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                                               |
| 6   | Campaign: "cost of 2 or less" for an X-cost card                                                                                      | A: allowed; X counts as 0. B: excluded, like "–" **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                                                                                 |
| 7   | Campaign: scenario 3's recorded cards                                                                                                 | A: take none, one or both. B: all or nothing **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                                                                                     |
| 8   | The chosen villain removed from the game before 2A (discarded as Whisper's minion, or defeated as a second villain; RRG p. 17) (§4.0) | A: 2A finds nothing, the game goes on with no villain, and 2B completion loses (Grim Rule, RRG p. 4). B: the players win after 2A. C: the players win at the defeat **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                              |
| 9   | 65038 1B prints "(the players win by advancing)"                                                                                      | A: a reminder only; advancing is not a win (2A reveals the chosen villain, 2B loses on completion). B: advancing wins **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                            |
| 10  | Toughness on a villain's flipped side or new stage (SITN side B, Krahllak II/III; RRG p. 45)                                          | A: a tough status card is placed on each. B: only when a new card enters play. **Answered B (Quin, 2026-10-22): built; a villain's flip gives no tough status card, a new stage still does. Opt-in `flipCard` `resolveToughness`: Typhoid Mary (MC60 p. 26 FAQ; follow-up answer, Quin, 2026-10-22: she keeps her tough card on the flip, B applies to every other villain) and Shadow Labyrinth 2A expert (2A reveals side B in place of side A, in or out of play)** |
| 11  | "After Krahllak is defeated" (Dark Invitation 1B)                                                                                     | A: per stage (standard advances when stage I falls, expert when II falls; RRG p. 47). B: only when the final stage is defeated **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                   |
| 12  | Expert campaign hit points set before the scenario's own setup damage, against RRG Appendix II step 13 and insert p. 5                | A: keep (ruling June 2, 2026 (3) #2 precedent). B: set them after setup damage. **Answered B (Quin, 2026-10-22): built; Shadowland only, other boxes keep A**                                                                                                                                                                                                                                                                                                          |
| 13  | Expert campaign vs expert mode (RRG p. 29 keeps them separate; AoA text says "expert difficulty")                                     | A: kept separate, the client offers both. B: one setting **Answered A (Quin, 2026-10-22): the recommended default, as built.**                                                                                                                                                                                                                                                                                                                                         |

## 6. Build order (proposed; one task per agent, one commit per task, the Synthezoid §8 shape)

**D (card-data-pipeline).**

- **D0 (done):** PDF and markdown transcription added; index and rules-authority table updated; the sources page's out of
  scope note and §10 Q5 updated.
- **D1:** `curation/shadowland.ts` shell, the cycle, pack, release date and source line; register in
  `scripts/ingest-marvelcdb.ts` and `scripts/marvelcdb/survey.ts`; `PACK_PAGES["shadowland"]`; empty-raw path.
- **D2a to D2g:** one task per set, transcribed from the full-size scans (§3): (a) Shadows in the Night, (b) Shadow
  Labyrinth, (c) Heart of Shadow, (d) Dark Protege villains (six, two sides), (e) Dark Protege linked cards, (f) Black Flower,
  (g) Deadly Contraptions and Ninja Swarm (or two tasks). Each task lists the faces it could not read.
- **D3a to D3g:** the second-check task for each D2 task, by a different agent, against the scans; findings to
  `docs/phase7-shadowland-scan-check.md`.
- **D4:** the scenario records: three `ScenarioCuration`s (a villain choice for #1 from the six Dark Protege villains, as
  Fear No Evil's underling option; Shifting Corridors for #2; Krahllak for #3), modular set picks, the campaign record
  and the Black Flower campaign exclusion; validators pass.
- **D5:** chronology wiring (`data/index.ts` `WAVE11_*` after Luke Cage, `pool.ts` is the client agents' file and is
  handed over, not edited here), content tests (cycle, date order, the 90 faces counted per set).
- **D6:** the owner's list for the PR: scans for unseen faces, music, art for the scenario pictures.

**M (game-rules-architect), one primitive per task:** M1 positions; M2 Creeping Corruption and corruption counters (with
the rules expert on Q8); M3 trap deck and trap discard pile; M4 and M5 infinite hit points and passage counters with the
loss condition; M6 to M10 and M12 as verification tests in the owning scripting task, extends appended if one fails; M11
campaign layer (§4.1); Villainous waits on the other agent.

**S (ability-scripting-engineer), one module per set**, under `packages/cards/src/wave11/shadowland/` (the wave 11 home,
since the pack joins `WAVE11_*`): scaffold and coverage groups; Shadows in the Night; Shadow Labyrinth; Heart of Shadow
(Krahllak); Dark Protege (one task per two villains); Black Flower; Deadly Contraptions; Ninja Swarm; the campaign
definition. Each waits on its D2 and D3.

**QA (rules-qa-engineer):** `docs/phase7-shadowland-qa.md`: the pack audited card by card against the insert, RRG 1.8 and
rulings; seeded games for each scenario (standard and expert), each Dark Protege villain, a trap-deck reshuffle, a
Shifting Corridors passage loss, a full three-scenario campaign with persistent expert damage, and a precon-style e2e
game (no heroes ship: use two existing heroes).

**Client (not started here; the client agents own `packages/client`):** pool and cycle wiring, the position environments
and trap deck zones, the corruption counter display, the campaign log screen, hover and Guided text for the new rules.

## 6. Rules brief for the engine (rules expert, 2026-10-20)

Sources: the insert (`docs/campaign-modes/mc65_rulebook-web.pdf`, printed page numbers; pp. 8-9, 12-13, 16-17 checked
against the photographs) and RRG 1.8. No Shadowland ruling exists yet.

- **M1 Positions (insert p. 8; RRG "Environment" p. 18, "Flip" p. 20).** Setup puts two double-sided environments in
  play, The Streets Below / Atop the Tenshu: one with the VILLAIN POSITION trait, one with HERO POSITION (one hero card
  in total). "The villain's position is X" = that card shows X; "change the villain's position" flips it. "Both
  positions are the same / different" compares the two faceup titles. A flip is not a reveal (rulings 2026-02-28 #7.3,
  2026-01-26 #4.2); tokens and attachments stay. FAQ p. 18: an effect that cannot fully resolve may be chosen on The
  Streets Below, and then (because of "then") the card is not flipped. Starting faces and movement come from card text.
- **M2 Creeping Corruption (pp. 9, 14, 17).** 72A is a double-sided upgrade (Black Flower), Setup keyword on A; 72B has
  OVERPOWERING (not "overwhelming"). Corruption counters are all-purpose counters (RRG p. 6) and survive the flip.
  Campaign scenarios 1-2 setup (RRG step 13): one 72A per player, rest set aside, rest of Black Flower shuffled in.
  Black Flower is not a campaign modular pick (p. 5). Q7: the upgrade does not carry over between games; scenario 3's
  "counter on their Creeping Corruption" assumes Heart of Shadow's own setup provides it — verify on the 1A scan; if
  silent, owner question (A: one 72A per player, as pp. 9/14; B: none). Q8 (corruption "turns a hero into a Dark
  Protégé"): build from 72B's printed text once transcribed; if it gives no mechanic, owner question (A: that player is
  eliminated, RRG p. 34; B: the players lose).
- **M3 Trap deck (pp. 12-13, FAQ p. 18; RRG "Deck" p. 15).** Built after the encounter deck from every TRAP! treachery
  in it, the Deadly Contraptions set, Whisper in the Dark, and any TRAP! card from added modular sets (8 by default).
  "Reveal a card from the trap deck" reveals its top card. A TRAP! card that would be discarded goes to the trap discard
  pile from anywhere; a non-TRAP! card goes to the encounter discard even if drawn from the trap deck. Once empty,
  reshuffle its discard immediately; not an encounter deck reset, no acceleration token. Surge from a trap card deals
  from the encounter deck (FAQ p. 18). Trap deck and discard both empty: engine reading, the reveal does nothing (no
  loss).
- **M4 Infinite hit points (p. 13; RRG "Hit Points" p. 22).** Shifting Corridors takes damage but is never defeated;
  damage-taken triggers still fire. Precedent: wave 3 §3.1.
- **M5 Passage counters (p. 13).** Placed by card text; removed by card abilities. The players lose as soon as none
  remain (a state check).
- **M6 Assault (p. 2 = RRG p. 8).** A basic thwart against an Assault scheme uses ATK instead of THW; an ally takes its
  ATK consequential damage; basic-power increases apply to ATK. Basic thwarts only; Patrol/Crisis still apply. Check the
  engine's `assault` hits are this keyword, not the TRoRS card Assault.
- **M7 Linked (RRG p. 27).** Never in a deck; set aside at setup when any deck (the villain deck counts) holds the named
  card. The 10 Dark Protégé linked cards are set aside only for scenario 1's villain. Linked cards cannot be campaign
  rewards (ruling 2026-08-03 #4.3).
- **M8 First Player Action (p. 2; project decision wave 3 §3.13).** Only the first player, whenever they could take a
  standard action, on any card (Milano precedent). Reuse `firstPlayerOnly`.
- **M9 Teamwork (RRG p. 43; FAQ p. 18).** After the minion enters play and engages, if another minion with the trait is
  in play it activates against that player, after its When Revealed. FAQ: a NINJA's When Defeated putting a Teamwork
  NINJA into play checks after the defeated minion is discarded (it never counts). Test it.
- **M10 Villainous (RRG p. 47).** Follow the RRG ("uses a basic power"); rulings 2026-02-28 #6 and 2026-01-26 #4.1.
- **M11 Krahllak's Interrupt (FAQ p. 18).** "When Krahllak attacks you" resolves before a teammate declares defense.
- **M12 Campaign (pp. 4-6, 9-10, 14-15, 17, 20).** Campaign setup at RRG step 13. Identity fixed for the campaign;
  aspect/deck may change. Recording Daredevil or Elektra as an identity removes that Dark Protégé villain. Scenario 1
  victory removes the villain used. Scenario 3 deals the four Dark Protégé minions (Archpriestess, Gorgon, Lady
  Bullseye, White Tiger) at random, one facedown per player, rest shuffled in (all four regardless). A loss replays the
  scenario with no penalty (p. 5). OVERPOWERING flag recorded at scenario 1 and 2 victory; scenario 2 setup +1 counter
  if set in 1; scenario 3 +1 per flag. Recorded cards: each victory, each player may record one support or upgrade they
  control with cost 2 or less (not "-", not linked), two slots; scenarios 2/3 setup may put that card (from their
  current deck, no shuffle) into play free for +1 counter each. Expert: record remaining HP at victory (capped); set it
  at setup and the player may deal themself a facedown encounter card to heal to full; a player defeated in a won
  scenario rejoins next time (owner question if no HP is recorded: A, they must take the card to heal to full; B, base
  HP). Extra main scheme threat: +1 per player (s1), +3 per player (s2), none (s3).

## 7. Client items (owner, 2026-10-20; art live 2026-10-22)

The owner-supplied art is live (`art/campaigns/shadowland/SOURCE.md` has the credits and rules).

- **Cover and tiles.** `art/campaigns/shadowland/cover.png` is the Saga tile and Cover screen. Each scenario's tile
  picture is `art/scenarios/<id>/villain.png` (`shadows-in-the-night`: the key art, `shadow-labyrinth`: the dojo,
  `heart-of-shadow`: the throne).
- **Story.** The story file uses the page model (`campaign/stories/shadowland.ts`). The five Hall of Heroes panels
  (`art/campaigns/shadowland/artboards/`) open the issues; the six Marvel _Shadowland_ (2010) pages
  (`.../pages/01..06`) are each issue's Aftermath read, two per issue, and print the series credit on screen (the
  panels print none).
- **Extras.** Every picture is on Extras > Artwork as an earned extra (`progression/shadowland-extras.ts`): each
  scenario win opens its share (Shadows in the Night: Hand Ninja and pages 1-2; Shadow Labyrinth: The Dojo, Daredevil
  in Flame and pages 3-4; Heart of Shadow: The Throne and page 5), completing the campaign opens page 6, and the first
  panel is the box's cover tile (opens on starting the campaign). Lock hints name the scenario ("Win Shadow
  Labyrinth"), not its random villain.
