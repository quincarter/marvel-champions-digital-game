# Phase 7 wave 2: cycle 1 finished, data-only pool growing (`card-data-pipeline`)

Scope: PLAN.md Phase 7 "Wave 2 scope decided (2026-09-18)". This file now covers five passes:

1. **2026-09-18, first pass:** the schema-neutral parser sweep across all 62 non-Core packs, then curating and
   emitting `scw`, `ant`, `wsp`, `trors` (cycle 1). `docs/phase7-wave2.md` is `game-rules-architect`'s parallel
   spec for cycle 1's schema and engine primitives — cited throughout by section.
2. **2026-09-18, second pass:** finished cycle 1 (`qsv`, `toafk`), applied every remaining §5
   curation/image check, wired `WAVE2_CARDS` with tests, curated all six cycle 1 starter decks, and made a start
   on Part 2 — 15 more packs (`bp` plus 14 packs that needed no curation at all) wired into a new, separate,
   explicitly-not-playable `DATA_ONLY_CARDS` pool.
3. **2026-09-19, third pass ("Part 3" below):** closed both cycle 1 data gaps `ability-scripting-engineer`
   reported (`WAVE2_SCENARIOS`, Legions of Hydra), finished registering `nova`/`silk`/`spdr` (left incomplete by
   an intervening checkpoint), and grew `DATA_ONLY_CARDS` to 21 packs (`rogue`, `wolv`, `hood` newly curated).
4. **2026-09-19, fourth pass ("Part 4" below):** grew `DATA_ONLY_CARDS` to 23 packs (`ironheart`, `iceman`),
   added the general `auxiliaryHeroSetCodes` mechanism plus two more general normalizer fixes, curated ten more
   packs without fully unblocking all of them, and consolidated nine schema/parser-architecture requests for
   `game-rules-architect`.
5. **2026-09-19, fifth pass (this one, "Part 5" below):** implemented the six schema requests
   `game-rules-architect` landed (docs/phase7-wave2.md §7) as parser mappings, found one more general parser
   fix along the way (attach rules inside a triggered ability's body), grew `DATA_ONLY_CARDS` to 28 packs
   (`wonder_man`, `x23`, `valk`, `deadpool`, `spiderham`), and restated the three still-open schema items.

## Result

- **Before this file existed (2026-09-18 morning):** 1,498 issues across 63 packs, 9 normalize cleanly (Core +
  8 wave 1 packs).
- **After the first pass:** 768 issues across 63 packs, 25 normalize cleanly (+ `ant`, `cyclops`, `drax`, `gam`,
  `gambit`, `ncrawler`, `nebu`, `ron`, `scw`, `stld`, `trors`, `vision`, `vnm`, `warm`, `winter`, `wsp`); `scw`,
  `ant`, `wsp`, `trors` emitted as real data.
- **After this pass:** every pack still normalizes at least as cleanly as before (no regressions — see "What
  changed under me" for the one apparent regression, `spdr`, which is explained, not a real one). **30 of 63
  packs now normalize cleanly** (up from 25): the original 25, plus `bp`, `falcon`, `magneto` (unblocked by the
  `Linked` keyword parser fix, not hand-curated for those two), `qsv` and `toafk` (finished this pass).
  **20 packs are now emitted as real data** (up from 4): all six cycle 1 packs (`trors`, `toafk`, `ant`, `wsp`,
  `qsv`, `scw`) plus 14 more (`bp`, `cyclops`, `gambit`, `drax`, `gam`, `stld`, `vnm`, `nebu`, `warm`, `vision`,
  `ncrawler`, `magneto`, `winter`, `falcon`, `ron`).
- **Verification (end of second pass):** root `pnpm typecheck` and `pnpm test` clean: content 374, engine 607,
  cards 441, client 1271 — 2,893 tests, zero failures. `src/data/core` and the eight wave 1 pack folders
  confirmed git-unmodified (`git status`) — byte-identical, as required.
- **After the third pass (Part 3):** `WAVE2_SCENARIOS` now holds all six cycle 1 scenarios (was empty).
  `DATA_ONLY_CARDS` is 21 packs (up from 15): the original 15 plus `nova`, `silk`, `spdr` (registered/emitted,
  finishing the checkpoint's own unfinished step), `rogue`, `wolv` (one dash-cost correction each), `hood` (a
  general `flatten.ts` fix for double-sided-card aggregate quantities, which also unblocks the same shape in the
  not-yet-registered `mts`). Survey: **38 of 63 packs normalize cleanly** (up from 34 at the start of this pass —
  `angel` was already clean coincidentally; `nova`/`silk`/`spdr` were already registered in `survey.ts` by the
  checkpoint). `phoenix` is curated and survey-clean but deliberately withheld from emission — see Part 3 §5.
  Content tests: 374 → 387. Full detail, evidence and the reverted false start (Core/wave 1 regeneration
  staleness unrelated to this pass) are in Part 3 below.
- **After the fourth pass (Part 4):** `DATA_ONLY_CARDS` grew to 23 packs (`ironheart`, `iceman`). Survey: 40 of
  63 clean. Nine schema/parser-architecture gaps reported to `game-rules-architect`.
- **After the fifth pass (Part 5, this one):** `game-rules-architect` landed six of those nine requests
  (docs/phase7-wave2.md §7); this pass implemented the matching parser mappings and found one more general fix.
  `DATA_ONLY_CARDS` grew to **28 packs** (`wonder_man`, `x23`, `valk`, `deadpool`, `spiderham`). Survey: **45 of
  63 packs normalize cleanly**. Content tests: 389 → 408. Three schema items remain open (re-stated in Part 4 §5,
  kept current there rather than duplicated). Full detail in Part 5 below.

---

## Part 1: cycle 1 finished

### 1. `qsv` and `toafk` emitted

**`qsv` (Quicksilver).** Blocked before this pass on one issue: Pietro Maximoff's alter-ego face (`14001b`) has
no `imagesrc` at all on MarvelCDB — confirmed with a direct fetch of `marvelcdb.com/bundles/cards/14001b.png` and
`.jpg`, both 404, not just absent from the cached pack response. Hall of Heroes' own Quicksilver release page
(https://hallofheroeslcg.com/quicksilver/) hosts a second, independent scan gallery; its `0b.jpg` is confirmed
(viewed directly) to be Pietro Maximoff's alter-ego face — title, "ALTER-EGO" banner, "HAND SIZE 6 / HIT POINTS
9" all matching the raw record, collector mark "1B". Wired as a new, general mechanism rather than a one-off:

- **`PackCuration.imageOverrides?: Record<string, string>`** (`curation/types.ts`) — an absolute URL used as a
  face's art reference when MarvelCDB has none *at all* for that record (confirmed by a direct 404, not merely
  absent from the cache). Stored as a reference exactly the way a MarvelCDB path is (CLAUDE.md "Content & IP
  boundaries" — no bytes, just a cited second-source URL), with a `usedImageOverrides` staleness check
  (`checks.ts`) so an unused override is caught, not silently stale.
- `context.ts`'s new `imageOfWithOverride` records the substitution in the card's own provenance notes.
- `qsv`'s starter deck was also curated from Hall of Heroes' own `qs.jpg` (a photographed decklist page on the
  same release page — see "Precons" below).

**`toafk` (The Once and Future Kang).** Landed the "Kang shapes" docs/phase7-wave2.md §1.6/§1.8 describes, as
**normalizer generalizations, not Kang-specific code** (all in `packages/content/scripts/marvelcdb/normalize/`):

- **`villains.ts`.** The `kang`/`exp_kang` sets each hold six single-stage villain records (Kang (I), four
  differently-titled Kang (II) variants, Kang (III)) that don't form one villain's incrementing stage sequence.
  Recognized structurally — **more than one record claims the same stage number**, which no genuine single
  villain's stages ever do — and emitted as six separate one-stage `VillainCard`s instead of erroring "stage
  names differ". This is a general fallback (triggers on the shape, not on a card name), so it will also catch
  the same pattern in `aos`/`gmw`/`mts` if their villain sets turn out to be the same shape (not yet checked).
- **`main-schemes.ts`.** A stage whose starting/target/acceleration threat MarvelCDB marks `*_fixed: true` with
  no numeric value (The Master of Time, stage 2B, `11008b`) is now read as `dashedValues` instead of erroring
  "missing threat" — general, not Kang-specific (any pack's main scheme can use it).
- **`flatten.ts`.** The aggregate-vs-B-side consistency check no longer treats an *absent* aggregate value
  (`undefined`) and an *explicit* `null` B-side value as a mismatch — both mean "no printed value"; a dashed
  stage's aggregate record uses the former while its B-side record uses the latter. This resolved the survey's
  "aggregate 11008 does not match its B side" false positive.
- **A pre-existing image-orientation bug, fixed generally.** `main-schemes.ts` read a stage's A-side image from
  the *B-side* record's own `imagesrc` (correct for the wave 1 packs this was written against, where the B-side
  record happens to carry it) with no fallback. Kang's records go the other way — the A-side record carries its
  own image and the B-side has none — so `aSideImage` now falls back to the A-side record's own `imagesrc` when
  the B-side's is absent. Backward compatible: this fallback never fires for wave 1 (the B-side always has one
  there), verified by the unchanged wave 1 output.
- Kang's four stage 3 alternatives (Chronopolis/Inexorable Fate/Realm of Rama-Tut/Present Future War) already
  normalize as one `MainSchemeCard`'s four `stageNumber: 3` entries, told apart by `name` — the existing "keep a
  later stage's own title" rule handled this with no change needed.
- **Curated, in `curation/toafk.ts`:** two confirmed transcription-typo fixes ("in turn oder" → "in turn order",
  confirmed against 11008a's card image; "advanced to stage 4A" → "advance to stage 4A", corrected on the
  strength of the same confirmed pattern since 11008b has no scan of its own) and `cardNotes` recording every
  §5 image check (below). Scenario setup (`ScenarioCuration`) is **not** curated for `toafk` — matches `trors`'
  own scope cut; only card data (villains, main scheme, encounter cards) is emitted.

### 2. §5 curation and image checks

Every item in docs/phase7-wave2.md §5 is now addressed. Each card image was fetched from
`marvelcdb.com/bundles/cards/<code>.<ext>` and viewed directly (no bytes committed — CLAUDE.md "Content & IP
boundaries"); a starter-deck photo was fetched from its cited Hall of Heroes URL the same way.

| §5 item | Resolution |
|---|---|
| Marked for Death, Rise of Red Skull 1A, Bitter Rival, Beetle errata (RRG 1.8 p. 66) | Marked for Death/1A/Bitter Rival were already applied in `curation/trors.ts` (first pass). **Beetle (13028) was missing** — added this pass to `curation/wsp.ts`, confirmed against raw text; a real gap, not previously caught because `wsp`'s starter deck (which lists Beetle in its nemesis set) wasn't curated until this pass, and nothing else exercised the card's text. |
| Drop `10098` | Already applied (`ignoredRecords`, first pass). |
| "Crossbone's Machine Gun" typo | Already applied (first pass). |
| Other typos | `toafk`'s "in turn oder"/"advanced to stage 4A" fixed this pass (above). The `11009`/`11010`–`11012` "complete"/"completed" inconsistency between Kang's four stage 3 alternatives is **not fixed** — no card image exists for any of their B sides, so there's no evidence either way; flagged in `curation/toafk.ts` instead of guessed at. |
| Red Skull I's ATK | **Confirmed already correct, no fix needed.** Card image (`marvelcdb.com/bundles/cards/04125.png`) shows ATK printed **0*** (starred, variable via "+1 ATK for each side scheme in play"), matching raw's `attack: 0` exactly. The doc's concern ("has no attack") didn't reproduce against the current raw cache. |
| Scarlet Centurion's SCH | **Confirmed already correct, no fix needed.** Standard (`11005`) shows SCH **0***; expert (`11038`) shows SCH **1***, both matching raw exactly (`scheme: 0` / `scheme: 1`). Recorded as a `cardNotes` entry on `toafk.ts` citing the images. |
| Master of Time 2B's dashes | **Not independently confirmed from a scan** — no image exists for `11008b` on MarvelCDB at all (`imagesrc: null`; direct fetch 404). The `_fixed: true` + null-value pattern (distinct from the `_fixed: false` + null pattern a genuine data gap shows) is the basis for reading it as dashed. Flagged as high-confidence-but-unverified in `curation/toafk.ts`'s `cardNotes`. |
| Captive allies' classification | **Confirmed "none" (not "Basic") from all four card images** (Moon Knight `04097`, Shang-Chi `04098`, White Tiger `04099`, Elektra `04100`): each prints "CAPTIVE. HERO FOR HIRE." with no aspect-colored border and no "Basic" text anywhere on the card, unlike a real Basic card. Already wired via `aspect: "none"` in the general parser path (first pass); this pass adds the image confirmation to `trors.ts`'s scriptingNotes/provenance trail. |
| Campaign upgrades' dash cost | **Confirmed from all four card images** (`04159a`–`04162a`): no cost circle printed anywhere on the card, just "HYDRA CAMPAIGN / BASIC" at the bottom. `curation/trors.ts`'s four `specialCost: "dash"` corrections had this flagged "unconfirmed" in the first pass; that caveat is now removed and replaced with the confirmed evidence. |
| Size Increase's counters | **Confirmed a real MarvelCDB typo from the card image** (`12028`): the printed text reads "Uses (**3 size counters**)." — not "3 counters" as raw has it. Added as a new `Correction` to `curation/ant.ts` this pass (missed in the first pass, since `ant` was declared "0 hand corrections needed" before anyone checked this specific card against its image). |

### 3. `WAVE2_*` pool, wired and tested

`packages/content/src/data/index.ts` now exports `WAVE2_CARDS` (Core + all six cycle 1 packs, release order),
`WAVE2_ENCOUNTER_SETS`, `WAVE2_SCENARIOS` (empty — no `ScenarioCuration` written yet for any of the six packs;
tracked as a named follow-up, not a silent gap) and `WAVE2_STARTER_DECKS`, mirroring `WAVE1_*` exactly.

`packages/content/src/data/wave2.test.ts` (45 tests): every card validates, no duplicate ids, pack/cycle
membership, no leftover HTML/markup, the pool version is deterministic and well-formed (`poolVersionOf`), errata
and typo-fix regression tests (Marked for Death, 1A, Bitter Rival, Beetle, Crossbones' Machine Gun, `10098`,
Captive allies, campaign upgrades), and the full "one villain per Kang record / stage alternatives / dashed
values" suite. **Two known, reported (not fixed) schema gaps are named and excluded** rather than silently
skipped — see "Schema gaps found and reported" below.

### 4. Precons for all six cycle 1 heroes

All six now have a real, verified starter deck (previously: zero). Every one was cross-checked card-by-card
against raw MarvelCDB data (name, code, quantity) after transcription from an image, following wave 1's
provenance discipline (`curation/thor.ts` et al.):

| Hero | Source (viewed directly, not stored) | Notes |
|---|---|---|
| Hawkeye (Leadership) | Red Skull rulebook (spoiler edition PDF), p. 18, "Starter Decks" | The *spoiler-free* rulebook the rest of `trors.ts` cites is only 12 pages and doesn't have this section — the spoiler edition does. |
| Spider-Woman (Aggression & Justice) | Same, p. 18 | 15 + 11 + 11 + 3 = 40, matching docs/phase7-wave2.md §2.1's own count from the rulebook *text*. Needed a real schema-adjacent fix (below) — Spider-Woman's precon is the first deck in the whole pipeline that legitimately needs two aspects. |
| Ant-Man (Leadership) | Hall of Heroes gallery scan, `antmanstarterdeck.jpg` | |
| Wasp (Aggression) | Hall of Heroes gallery scan, `waspstarterdeck.jpg` | |
| Quicksilver (Protection) | Hall of Heroes gallery scan, `qs.jpg` (same page as the `imageOverrides` fix) | |
| Scarlet Witch (Justice) | Hall of Heroes gallery scan, `scw1.jpg` | Item 23 "Slipping Sanity x2" matches raw's own `quantity: 2` (FAQ, RRG 1.8 p. 61). |

**Two curation-side additions needed for this to work, both mine to make (schema files untouched):**

- **`StarterDeckCuration.secondaryAspects?: readonly CoreAspect[]`** (`curation/types.ts`) plus the matching
  `starter-decks.ts` normalizer change — Spider-Woman's precon draws from Aggression *and* Justice (her
  Double-Agent ability, FAQ RRG 1.8 p. 60), and the existing shape only ever supported one `aspect`. Additive;
  every other precon (17 of them, Core + wave 1 + the other five cycle 1 decks) is untouched and still passes
  `d.secondaryAspects ?? []` as empty.
- **`PackCuration.identityDeckbuilding?: Record<string, IdentityDeckbuilding>`** (`curation/types.ts`) plus a
  `heroes.ts` wiring — `HeroIdentityCard.deckbuilding` was never populated by the pipeline at all (grep confirms
  zero prior uses). Spider-Woman's `04031a` now carries `{ aspectCount: 2, equalCardsPerAspect: true }`, citing
  the FAQ directly. This is a rules-exception field, not a printed stat, so it's always hand-curated by design —
  wiring it through was the missing piece, not a data value that needed research.

### 5. Two real bugs found and fixed along the way (not asked for, but found while making the above work)

- **Ant-Man's and Wasp's own hero-kit cards pointed at the wrong identity code.** `context.ts`'s `heroBySet` map
  was built by overwriting on every `hero`-type record sharing a `card_set_code` — and a three-sided identity's
  extra face (Ant-Man's Giant, `12001c`; Wasp's Giant, `13001c`) is its *own* `hero`-type record in the same set.
  Whichever of the two records happened to sort last in the raw feed's order won the map, so **every one of
  Ant-Man's and Wasp's own hero-kit cards emitted `aspect: "hero:12001c"`/`"hero:13001c"` instead of
  `"hero:12001a"`/`"hero:13001a"`** — confirmed already present in the *previously committed* `ant`/`wsp` data
  (`git show HEAD:.../ant/cards.ts`), not something this pass introduced. This would have silently broken
  identity-set matching for both decks (their own signature cards wouldn't be recognized as belonging to their
  identity) the first time anything checked it — which nothing did, until this pass's precon work needed exact
  identity-code matching. Fixed generally: `heroBySet` now only accepts a record whose `linked_card` is type
  `alter_ego` (the real primary face), matching `normalizeHeroes`' own test for the same distinction.
  `ant`/`wsp` were regenerated; `core`/wave 1 are unaffected (none of them have a three-sided identity) and stay
  byte-identical.
- **The `Linked (Card Title).` keyword was never recognized at all.** `keywords.ts` already has the shape
  (`KeywordBase<"linked"> & { cardTitle?: string }`), but `parse-text.ts` never parsed the printed line, and a
  Linked card's near-always-missing `deck_limit`/cost failed ingestion with no exemption (unlike `separateDeck`
  or `specificTo` cards, which already had one). Found while curating `bp`'s Redemption (`51036`, "Linked (Show
  of Empathy). Victory 0.") — not a cycle 1 card, but a general parser gap, fixed generally in
  `parse-text.ts`/`normalize/player-cards.ts`. This alone unblocked **`falcon`** and **`magneto`** for free (they
  needed zero curation once the fix landed) and is very likely why `x23`'s error count also dropped (7 → 3, not
  independently investigated further).

### 6. Schema gaps found and reported, not fixed (schema is `game-rules-architect`'s)

Two real, confirmed-against-raw-data validation bugs, found while getting `WAVE2_CARDS`/`DATA_ONLY_CARDS` to pass
`validateCard()`. Neither is fixed here (`packages/content/src/schema/**` is out of my remit this pass); each is
named, evidenced, and excluded by id in the relevant test file rather than silently skipped, so the exclusion
itself is a visible TODO for whoever picks these up:

1. **Main scheme stage/aSide text is validated too strictly.** `validation.ts`'s villain stage text check (~L546)
   and side scheme text check (~L713) both use `isCardTextAllowEmpty` (a card can legitimately print no ability
   text — "a villain stage can be printed with no text", Rhino I). The main scheme stage/aSide text checks
   (~L687/L691) use the strict `isCardText` instead, with no such allowance. **Confirmed real, not a normalizer
   bug:** Attack on Mount Athena (`trors`, `04061a`) genuinely has a blank B side on stage 1 and blank A sides on
   stages 2/3 in MarvelCDB's own raw data (`text: ''` / `text: None`), matching the printed cards (a "Contents/
   Setup" stage 1A with no separate "when revealed" ability, and two stages whose only text is their B side's).
   **Suggested one-line fix:** use `isCardTextAllowEmpty` for `MainSchemeStage.text`/`.aSide.text` too. Excluded
   in `wave2.test.ts` as `KNOWN_SCHEMA_GAP_MAIN_SCHEME_BLANK_TEXT`.
2. **Minion boost icons are capped at 3, but real cards print more.** `validation.ts`'s `boostErrors` (~L270)
   hardcodes `boostIcons <= 3`. Confirmed against raw MarvelCDB data (not a normalizer bug): Joystick (`bp`,
   `51039`), Fixer (`falcon`, `53038`) and Blizzard (`winter`, `54034`) each print `boost: 4`. The cap is very
   likely an untested placeholder — every Core/wave 1/cycle 1 minion happens to print 3 or fewer, so nothing
   before this pass would have caught it. Excluded in `data-only.test.ts` as
   `KNOWN_SCHEMA_GAP_BOOST_ICON_CAP`.

---

## Part 2: the data-only pool (started, not finished)

**15 of the ~56 remaining packs emitted** as a new `DATA_ONLY_CARDS`/`DATA_ONLY_ENCOUNTER_SETS` pool
(`packages/content/src/data/index.ts`), separate from `WAVE1_CARDS`/`WAVE2_CARDS`/`CORE_CARDS` — the deck
builder can show these cards, but nothing marks them playable (no ability scripts exist for them yet; that's
`unscriptedCards` in `@mc/engine`, out of my remit). Tested in `packages/content/src/data/data-only.test.ts` (21
tests): every card validates (with the one named, reported exclusion above), no duplicate/colliding ids across
every pool, pack/cycle membership, cycle grouping cross-checked against Hall of Heroes' own card database
navigation (https://hallofheroeslcg.com/browse/), and encounter set registration.

**Which 15, and why these:** every pack that turned out to need **zero hand curation** once the schema-neutral
parser fixes (first pass) and this pass's `Linked` keyword fix landed — confirmed by re-running the survey with a
real curation file registered for each, not assumed from the earlier bare-curation count:

| Pack | Name | Cycle (per Hall of Heroes' `/browse/` navigation) | Release date |
|---|---|---|---|
| `bp` | Black Panther/Shuri | Cycle 9 | 2025-05-02 |
| `cyclops` | Cyclops | Cycle 6 | 2022-09-30 |
| `gambit` | Gambit | Cycle 6 | 2023-02-24 |
| `drax` | Drax | Cycle 3 | 2021-06-18 |
| `gam` | Gamora | Cycle 3 | 2021-05-14 |
| `stld` | Star-Lord | Cycle 3 | 2021-05-14 |
| `vnm` | Venom | Cycle 3 | 2021-07-16 |
| `nebu` | Nebula | Cycle 4 | 2021-09-17 |
| `warm` | War Machine | Cycle 4 | 2021-11-12 |
| `vision` | Vision | Cycle 4 | 2022-01-14 |
| `ncrawler` | Nightcrawler | Cycle 8 | 2024-09-20 |
| `magneto` | Magneto | Cycle 8 | 2024-11-15 |
| `winter` | Winter Soldier | Cycle 9 | 2025-06-20 |
| `falcon` | Falcon | Cycle 9 | 2025-06-20 |
| `ron` | Ronan the Accuser Print and Play modular set | **Not a numbered cycle** — a Gen Con Online 2020 promotional release, given its own `cycle.id: "promo"` rather than folded into one | 2020-08-02 |

**A naming note, flagged rather than silently changed:** Hall of Heroes' `/browse/` navigation calls what this
pipeline has been calling `cycle1` (`trors`/`toafk`/`ant`/`wsp`/`qsv`/`scw`, per docs/phase7-wave2.md's own
framing) something different in FFG's real numbering — "Cycle 1" there is wave 1 (Green Goblin, Captain America,
etc.), "The Rise of Red Skull" is its own Campaign Expansion tier, and "Cycle 2" is Kang/Ant-Man/Wasp/Quicksilver/
Scarlet Witch. I did **not** rename any already-emitted `cycleId` to match — `docs/phase7-wave2.md` explicitly
chose "cycle1" as this pipeline's own internal label for "wave 2" collectively (a PLAN.md content-pass grouping,
not FFG's product taxonomy), and renaming it now would touch six already-tested, already-committed packs for a
naming preference, not a data-correctness fix. For every *new* pack in this pass I used FFG's real cycle numbers
(confirmed from `/browse/`) rather than propagate the same ambiguity further. Worth a decision from whoever owns
the deck builder's cycle display before either naming reaches a player-facing screen.

**Not curated for these 15:** starter decks and scenario data (none of them are relevant here — Ronan is a
5-card modular set, and the other 14 are hero packs whose precons would each need their own Hall of Heroes photo,
same as cycle 1's did — left for a follow-up, not attempted this pass to keep Part 2 moving).

### The gap matrix for the other ~41 packs

Re-run at the end of this pass (`survey.ts`, no `--pack` filter, all 63):

```
Surveyed 63 packs — 30 normalize cleanly, 33 do not.
```

| Category | Count | Packs | (a) schema gap / (b) needs curation |
|---|---|---|---|
| no artwork reference for a printed face | 253 | 15 packs | **(b)** — mostly genuine first-printing gaps needing a second source per card, same as `qsv`'s (now solved via `imageOverrides`, which generalizes to these too once someone finds the sources). |
| MarvelCDB record never turned into a card | 125 | 17 packs | **mixed** — not re-triaged this pass; see the first pass's notes (some are `aoa`'s third villain face, schema-adjacent; some are `ignoredRecords`-shaped spurious duplicates). |
| attach rule shape not recognized by the parser | 86 | 22 packs | **mixed**, dominated by named schema gaps (non-permanent qualifier, OR-of-hosts, leader concept, extra superlative measures — first pass's §3 items 3/5/6/7/8, still unaddressed). |
| uncategorized | 83 | 12 packs | **needs individual triage**, unchanged from the first pass. |
| resource/event/support/upgrade cost shape | 41 | 18 packs | **(b)**, mostly the same `specialCost`/`specificTo` classification pattern already applied to `trors`/`bp` (down from 42/19 — one pack's worth resolved as a side effect of the `Linked` fix, not independently investigated). |
| unhandled MarvelCDB type_code | 37 | 5 packs | **(a)** — the `leader` card type (`cw`/`synthezoid`), Agents of SHIELD's evidence types, `aoa`'s third villain face, `spdr`'s dangling link. |
| deck_limit missing/invalid | 32 | 4 packs | **(b)**, mostly — down from 42/8 (`bp`/`falcon`/`magneto`/`x23` dropped off the list, from this pass's `Linked` and unique-scenario-card fixes). |
| hero card in a set with no identity | 24 | 5 packs | **mixed** — up from 13/4 this run because `spdr` moved onto it (see "What changed under me" — this is the `heroBySet` fix surfacing spdr's real, pre-existing structural problem more accurately, not a new one). |
| main scheme missing starting/target/acceleration threat | 21 | 4 packs | **(b)**, using the now-landed (and this pass, generalized-beyond-Kang) `dashedValues` shape — needs the card-image confirmation this pass gave `toafk`. |
| villain stage label is not a roman numeral | 12 | 3 packs | **(a)/(b)** — the Kang pattern (this pass's `villains.ts` generalization) may already resolve some of these; not individually re-checked. |
| ifAble attach host: one side didn't parse | 7 | 3 packs | **(a)** — leader concept, OR-of-two-targets. |
| villain set: stage names differ | 6 | 3 packs | **(a)/(b)** — same as "villain stage label", the `villains.ts` fix may help; not re-checked per pack. |
| ally missing atk/thw | 6 | 4 packs | **(b)** — `cardNotes` entries. |
| Requirement keyword needs more than one resource icon | 4 | 4 packs | **(a)**, unchanged. |
| main scheme stage not an NA/NB pair | 4 | 1 pack (`sm`) | needs individual triage. |
| Discount keyword needs a target-trait qualifier | 3 | 1 pack (`fne`) | **(a)**, unchanged. |
| aggregate record mismatch | 2 | 2 packs | **(b)** — inspect before dropping. |
| side scheme without starting threat | 2 | 1 pack (`synthezoid`) | **(b)** — `cardNotes`. |
| non-printed field present | 1 | `aos` | **(b)** — `ignoreFields`. |
| boost_star flag vs Boost ability text mismatch | 1 | `mts` | **(b)**. |
| minion ATK is X or invalid | 1 | `sm` | **(b)** — `cardNotes`. |
| hero without a linked alter-ego | 1 | `spdr` | **(a)/(b)** — needs its own look, still not investigated (SP//dr's link is dangling in a different shape than the three-sided-identity pattern; see below). |

`tt` still crashes (not investigated this pass either — likely a genuine parser crash, not an aggregated gap).

### What changed under me — `spdr`'s error count moved from 6 to 17

Not a regression: the `heroBySet` fix (Part 1, item 5) is *stricter* than before, correctly refusing to claim a
set for a hero record whose linked card isn't a real alter-ego. SP//dr's own identity record (`31001a`) has a
malformed link (its `linked_card`, `31001b`, isn't type `alter_ego` either — "unexpected linked card 31001b on a
hero"), so before this fix, `heroBySet` still accidentally got an entry for `spdr` (from the same
overwrite-on-every-hero-record bug that broke Ant-Man/Wasp), masking 11 "hero card in set spdr with no identity"
errors that are now surfaced correctly. `spdr` was never on the "clean" list before or after either way — this
is the same, already-documented, already-flagged gap (first pass's §3 item 10) showing up more completely, not a
new problem.

---

## Handoff

- **For `ability-scripting-engineer`:** cycle 1 (`WAVE2_CARDS`) is fully data-complete — every card, every
  errata, all six precons, Kang's full shape. Nothing here blocks starting scripting except the two reported
  schema gaps above, which only affect two specific cards' validation, not the whole pool.
- **For `game-rules-architect`:** the two schema gaps in "Schema gaps found and reported" (main scheme blank
  text, minion boost cap), plus the first pass's still-open §3 items (`leader` card type, OR-of-hosts,
  non-permanent qualifier, extra superlative measures, evidence-type cards, `aoa`'s third villain face,
  `spdr`'s dangling link) — none newly discovered this pass, all still blocking the packs listed against them
  above.
- **For whoever continues Part 2:** the pattern this pass used — register a real (even if empty) curation,
  re-run the survey with `--pack <code>`, only then trust "0 corrections needed" — caught two real bugs
  (Ant-Man/Wasp's wrong identity code, the missing `Linked` keyword) that a bare-curation-only survey pass
  wouldn't have. Worth repeating for the rest of the 30-clean-but-unemitted... **note: after this pass, 0 clean
  packs remain unemitted** — every pack that survey.ts currently reports as normalizing cleanly under
  `bareCuration` has now been given a real curation file and wired into a pool. The next opportunity is the
  56 (b)-heavy packs in the gap matrix above, starting with whichever schema items `game-rules-architect` picks
  up first (per the first pass's own priority order: Requirement/Discount are cheap and unblock keyword
  correctness broadly).
- **Files touched this pass**, beyond the first pass's list: `packages/content/scripts/marvelcdb/{parse-text,
  survey}.ts`, `packages/content/scripts/marvelcdb/normalize/{context,checks,flatten,heroes,main-schemes,
  player-cards,starter-decks,villains}.ts`, `packages/content/scripts/marvelcdb/curation/{types,ant,wsp,scw,
  trors,qsv,toafk,bp,cyclops,gambit,drax,gam,stld,vnm,nebu,warm,vision,ncrawler,magneto,winter,falcon,ron}.ts`,
  `packages/content/scripts/ingest-marvelcdb.ts`, `packages/content/src/data/index.ts`, `packages/content/src/
  data/wave2.test.ts` (new), `packages/content/src/data/data-only.test.ts` (new), and the new `packages/content/
  src/data/{qsv,toafk,bp,cyclops,gambit,drax,gam,stld,vnm,nebu,warm,vision,ncrawler,magneto,winter,falcon,ron}/`
  folders. No `packages/content/src/schema/**`, `packages/engine/**`, `packages/cards/**` or `packages/client/**`
  file was touched — those packages' own concurrent changes (visible in `git status` throughout this pass) are
  the other agents' work, not mine; root `pnpm typecheck`/`pnpm test` stayed green against them throughout.

---

## Part 3: cycle 1's two data gaps closed; nova/silk/spdr registered; six more data-only packs

**2026-09-19, third pass.** Picked up from checkpoint commit `919184b` ("Wave 2 data-only checkpoint: later-pack
parser mappings, nova/silk/spdr curations (not yet emitted)"), whose last words were "Now register these three
(nova, silk, spdr) in both survey.ts and ingest-marvelcdb.ts, then emit them." They were registered in
`survey.ts` but not `ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS` — the only place that actually controls
emission. This pass did that, then closed the two cycle 1 data gaps `ability-scripting-engineer` reported, then
extended the data-only pool by six more packs.

### 1. Cycle 1 data gap #1 — `WAVE2_SCENARIOS` was empty

Wired all six cycle 1 scenarios as real `Scenario` records, additively (no existing cycle 1 card id, ability ref,
set id or field renamed/removed):

- **`ScenarioCuration` grew six new optional fields** (`curation/types.ts`), each consumed by
  `normalize/scenarios.ts`, none changing any existing scenario's output (Core/wave 1's curations don't set them):
  `villainCardCode` (a direct villain-card override for a set `villainIdBySet` has no entry for — see next
  bullet), `additionalEncounterSetCodes` (required sets besides the villain's own — Crossbones needs Experimental
  Weapons, Taskmaster needs Hydra Patrol), `setAsideVillainCardCodes`, `expertVillains`, `victory`,
  `separateGameAreas`, and `separateDecks` (the curated, MarvelCDB-code form of `Scenario.separateDecks`).
- **`emit.ts`'s `KEY_BRANDS` gained `setAsideVillainCardIds: "cardId"`** — without it, the emitted TS literally
  typed `readonly CardId[]` fields as bare string arrays, which fails `pnpm typecheck` (branded types aren't
  string-assignable). Caught by regenerating and typechecking, not guessed.
- **`curation/trors.ts`**: five `ScenarioCuration` entries (Crossbones, Absorbing Man, Taskmaster, Zola, Red
  Skull), each citing the Red Skull rulebook page docs/phase7-wave2.md §2.2 already researched. Crossbones'
  `separateDecks` models the Experimental Weapons deck (§1.8); Red Skull's models the side-scheme deck (§1.8,
  errata #128A, already applied to 04128a's text in Part 1).
- **`curation/toafk.ts`**: one entry (Kang), using `villainCardCode: "11001"` because `villainIdBySet` has *no*
  entry for the "kang" set — `normalize/villains.ts` deliberately leaves it unset when a set's stage numbers
  collide (Kang (I)/(II)×4/(III) are six single-stage villains, not one sequence; see Part 1 §1). `victory:
  "cardAbility"`, `setAsideVillainCardCodes`, `expertVillains` and `separateGameAreas` all transcribed from the
  Kang insert and RRG 1.8 FAQ p. 60, cited in the curation file itself.
- **Regenerated only `trors`/`toafk` (`--offline`), and confirmed by `git status` that only their `scenarios.ts`
  changed** — no other file in either pack's output differs from what was already committed. (A first attempt at
  regenerating *every* already-registered pack, to double-check the later `flatten.ts` change below, surfaced
  that Core and six wave 1 packs' generated files are already stale against the current normalizer for unrelated
  reasons predating this pass — see "What I found and reverted" below. `trors`/`toafk` were not affected by that
  staleness.)
- `packages/content/src/data/index.ts` now exports `WAVE2_SCENARIOS = [...TRORS_SCENARIOS, ...TOAFK_SCENARIOS]`
  instead of `[]`. `wave2.test.ts` gained a "cycle 1 scenarios" describe block: six scenario ids, `validateScenario`/
  `validateScenarioEncounterSets` (the latter against `[...CORE_ENCOUNTER_SETS, ...WAVE2_ENCOUNTER_SETS]` — see
  next section for why Core's own sets need to be in scope), villain/main scheme id resolution, and fixture
  assertions for Crossbones' modular sets, Kang's set-aside/expert villains, and both `separateDecks`.

### 2. Cycle 1 data gap #2 — "Legions of Hydra" looked missing from `trors`

**Not a gap.** Attack on Mount Athena's 1A ("Three modular sets: Hydra Assault, Weapon Master, and Legions of
Hydra") names a set that genuinely has no `legions_of_hydra` `card_set_code` anywhere in `trors.json` — because
**Legions of Hydra is one of Core Set's own modular encounter sets** (`packages/content/raw/marvelcdb/core.json`;
already registered as `EncounterSet { id: "legions_of_hydra", packCodes: ["core"] }` in
`packages/content/src/data/core/encounterSets.ts`, unmodified). The Rise of Red Skull just happens to call for a
Core modular set alongside two of its own — the same cross-pack pattern wave 1's own Green Goblin scenarios
already use for "standard"/"expert" (both Core sets), via `normalize/scenarios.ts`'s `CORE_ENCOUNTER_SET_CODES`
fallback. Crossbones' `ScenarioCuration.recommendedModularSetCodes` now lists `["hydra_assault", "weap_master",
"legions_of_hydra"]` (`modularSetCount: 3`), which resolves cleanly through that existing mechanism with zero
normalizer changes. `wave2.test.ts` pins this with a dedicated test (`legions_of_hydra` present in
`CORE_ENCOUNTER_SETS`, absent from `WAVE2_ENCOUNTER_SETS`, and referenced by the Crossbones scenario) so the
distinction stays visible rather than silently working.

### 3. What I found and reverted — Core/wave 1's generated files are already stale, not because of this pass

While double-checking the `flatten.ts` change below couldn't affect Core/wave 1, I regenerated *every*
already-registered pack (`--offline`) and diffed against `git status`. `trors`/`toafk` (this pass's intentional
scenario changes) and every already-clean pack from Part 1/Part 2 (`scw`, `ant`, `wsp`, `qsv`, `bp`, `cyclops`,
…) came back byte-identical except the intended files. **Core and six wave 1 packs (`bkw`, `cap`, `drs`, `gob`,
`hlk`, `msm`, `thor`) did not** — regenerating them against the *current* normalizer produces a real, unrelated
diff (a `duplicateOfCardId` provenance field on basic-card records that the currently-committed files don't have,
and on `gob` a restructured ability-ref pair on Hostile Takeover's 1A/1B). This predates this pass entirely: it
reflects normalizer work from an earlier pipeline pass that was never regenerated back into Core/wave 1's
committed output. **Reverted with `git checkout`, not committed** — my mandate this pass is additive to cycle 1
and otherwise `don't change the emitted data of the six cycle 1 packs, Core or wave 1`, and this drift is neither
mine nor in scope to resolve here. Flagged for whoever owns Core/wave 1 regeneration next: `pnpm --filter
@mc/content ingest -- --pack core --offline` (and the six wave 1 packs) will currently produce a diff against
`main`; decide whether that diff is wanted before running it for real.

### 4. `nova`, `silk`, `spdr` registered and emitted (the checkpoint's own unfinished step)

Registered in `ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS` (`survey.ts` already had them from the checkpoint).
All three still normalize with zero further hand corrections (`survey.ts --pack nova --pack silk --pack spdr`),
confirming the checkpoint's own curation files were correct. Emitted, wired into `DATA_ONLY_CARDS`/
`DATA_ONLY_ENCOUNTER_SETS`/`data-only.test.ts`. `spdr`'s separated-identity mechanism (Peni Parker, 31002,
sourced from a second gallery — see `curation/spdr.ts`) works as designed; no further issues found.

### 5. Six more data-only packs: `nova`, `silk`, `spdr`, `rogue`, `wolv`, `hood`

Following Part 2's own discipline — register a real curation, re-run `survey.ts --pack <code>`, only then trust
"0 corrections needed", and only then wire into the pool and run the full test suite before moving on:

- **`rogue`, `wolv`** (Cycle 6): each needed exactly one `Correction` — their signature weapon upgrade (Touched
  38002; Wolverine's Claws 35002) prints a dash cost (a Permanent card exhausted for its own Hero Action, not
  paid for), and MarvelCDB sends no `cost` field at all. Confirmed per-card from each card's own MarvelCDB
  listing ("Cost: —"), the same evidence standard as trors' Hydra Campaign upgrades.
- **`phoenix`** (Cycle 6) — **curated but deliberately NOT registered/emitted.** Its one cost gap (Phoenix Force,
  34002a) is the same confirmed dash-cost pattern as `rogue`/`wolv`. But Burning Hunger (34028, Phoenix's
  obligation) has **no `text`/`real_text` field on MarvelCDB at all** — not blank, absent — and MarvelCDB's own
  card page doesn't display any either; a web search surfaces only a third-party paraphrase of the effect (summon
  Dark Phoenix), not the verbatim printed wording. `validateCard()` rejects an obligation with empty text, and
  this pipeline's discipline is to never fabricate card text. Caught only because `data-only.test.ts`'s
  pool-wide `validateCard()` check runs *after* emission — `survey.ts`'s `normalizePack` never calls
  `validateCard`, so a pack can "survey clean" and still fail this way; worth remembering for whoever next trusts
  a bare survey pass. `curation/phoenix.ts` documents the block in full; `ingest-marvelcdb.ts`'s
  `REGISTERED_CURATIONS` has a comment explaining why it's absent rather than a silent gap. **Blocked on: a
  second source (card scan) with 34028's exact printed text.**
- **`hood`** (Cycle 4, a villain/scenario expansion with no hero pack — 3 villain, 6 main_scheme, 11 attachment,
  20 minion, 10 side_scheme, 18 treachery, 6 environment records, zero `hero`/`hero_identity`) — needed a real,
  general normalizer fix, not a curated correction: **`normalize/flatten.ts`'s aggregate-quantity check summed
  both faces of a double-sided card as if they were two independent printed copies.** Formidable Foe (an
  environment, 24049a/24049b) is one physical double-sided card; MarvelCDB's bare aggregate record `24049`
  (`quantity: 1`, correctly meaning "one physical card") was being compared against `24049a.quantity +
  24049b.quantity` (1 + 1 = 2) instead of either face's own quantity. Fixed structurally (detects "exactly two
  variants, mutually linked", not by card name or type), mirroring the `main_scheme` branch just above it in the
  same function, which already special-cases its own A/B pair for the same reason. **Also unblocks the identical
  shape in `mts`** (Mutant Genesis' `21100a/21100b`, confirmed in the gap matrix, error count 39→38) — `mts` stays
  blocked on its other, unrelated issues (villain stage labels, attach-rule shapes, missing images), not
  registered this pass.
- `nova`, `silk`, `spdr` — see §4 above; listed here again only because they're new to `DATA_ONLY_CARDS` this
  pass, not because anything further was found for them.

**Not attempted / re-triaged this pass:** every pack in the gap matrix below with more than one remaining issue —
fixing one issue in a still-blocked pack doesn't unlock its emission (a pack only emits once `normalizePack`
raises zero errors *and* every emitted card passes `validateCard()`), so partial corrections to packs I'm not
finishing this pass would sit unverified in an unregistered curation file with no benefit over just reporting the
finding here. Findings from cards I did look at (`iceman`, `x23`, `wonder_man`, `spiderham`, `valk`, `deadpool`,
`psylocke`, `hercules`, `mts`, `mut_gen`, `sm`, `storm`, `aos`, `gmw`, `jj`, `aoa`, `next_evol`), gathered while
triaging what a quick win might look like:
  - **The exact same dash-cost pattern** (a Permanent/Setup signature upgrade or support with no paid cost,
    confirmed via MarvelCDB's own "Cost: —" listing on a representative sample) also explains every "upgrade/
    support/ally without a cost" entry currently in the gap matrix: `hercules` 59005–59007, `mts` 21002–21004,
    `mut_gen` 32031a, `sm` 27182a–27189a (all eight of the "gadget kit" choose-one-at-setup upgrades), `storm`
    36002–36005, `aos` 50035a, `gmw` 16142, `jj` 61002, `wonder_man` 58002/58031, `aoa` 45171a, plus the "ally
    without a cost" Captive/Rescued-style allies `aos` 50091, `mojo` 39071, `next_evol` 40079/40130, and
    `next_evol`'s six flip-side player side schemes 40190a–40195a. None of these packs is otherwise close to
    clean (13–86 other issues each), so no `Correction` was written for them — the pattern is recorded here so
    whoever curates these packs next doesn't have to re-derive it.
  - **Confirmed schema gaps, not curatable** (each needs a shape `AttachmentHost`/`SuperlativeHostPool`/
    `HostMeasure` doesn't have yet — `packages/content/src/schema/cards/attachment-host.ts` is
    `game-rules-architect`'s):
    - `valk` 25031 / `deadpool` 44041 ("Beguiled"/"'Pool-ized"): "Attach to the ally with the highest **cost**
      without [this] attached" — `SuperlativeHostPool` has no `"ally"`, and `HostMeasure` has no `"cost"`.
    - `wonder_man` 58032 ("Coordinated Effort"): "Attach to an encounter card in play" — no host kind for "any
      encounter card", as opposed to a specific category (`enemy`/`sideScheme`/etc.).
    - `spiderham` 30029 / `x23` 43012: "a character with 'Spider' in its title" (substring name match, not a
      trait) and "an enemy that X-23 or Honey Badger attacked this turn" (a temporal condition, not a static
      qualifier) — neither fits `qualified`'s trait-based `HostQualifiers`.
  - **`iceman` 46002 (Frostbite)**: a hero-kit upgrade filed under its own `card_set_code`
    (`iceman_frostbite`) distinct from Iceman's identity set (`iceman`) — the same shape flagged in the gap
    matrix for `fne`/`hercules`/`storm` too ("hero card in a set with no identity"). Structurally different from
    Ant-Man/Wasp's three-sided-identity extra face (Part 1 §5): this isn't a face of the identity card, just a
    signature card MarvelCDB happens to group under a different set code. Not attempted — unclear whether this
    needs a curation-level set-code alias or is evidence of a real mechanic (a chosen "form" set, like Ant-Man's
    Giant) that `game-rules-architect` should weigh in on before a workaround is picked.
  - `iceman` 46003 (Snow Clone, ally with no printed THW) is a plain `cardNotes` fix, not attempted only because
    `iceman` is blocked on 46002 regardless.

### 6. Verification

`pnpm typecheck` and `pnpm test` from the repo root: `@mc/content` (387 tests), `@mc/engine` (651 tests) and
`@mc/client` all pass; `@mc/cards` has 2 pre-existing failures (`legal-actions.test.ts`, `klaw.test.ts`, both
about a `wild` key appearing in a payment-requirement object) from the `ability-scripting-engineer`/
`game-rules-architect` agents' own concurrent uncommitted work in `packages/cards`/`packages/engine` — outside my
remit per this task's own instructions ("if their in-progress edits briefly break a typecheck outside your
packages, ignore it"); not touched, and unrelated to any file this pass edited (grep-confirmed: neither failing
test file nor the `wild` key appears in this pass's diff).

### Progress / next up

- **Done:** `WAVE2_SCENARIOS` (6 scenarios), the Legions of Hydra cross-pack reference confirmed working, `nova`/
  `silk`/`spdr` registered and emitted (finishing the checkpoint), `rogue`/`wolv`/`hood` newly curated and
  emitted, the `flatten.ts` double-sided-aggregate fix (general, unblocks `mts` too though `mts` isn't
  registered).
- **`DATA_ONLY_CARDS`: 21 packs** (15 from Part 2 + `nova`, `silk`, `spdr`, `rogue`, `wolv`, `hood`).
- **Blocked, documented, not worked around:** `phoenix` (curated, survey-clean, but withheld — needs a second
  source for 34028's exact text before it can emit).
- **Next opportunity, roughly in order of leverage:**
  1. The dash-cost pattern write-up in §5 above is ready to apply to `hercules`/`mts`/`mut_gen`/`sm`/`storm`/
     `aos`/`gmw`/`jj`/`aoa`/`next_evol`/`mojo` the moment each pack's *other* issues are also resolved — it alone
     won't unlock any of them.
  2. `game-rules-architect` schema decisions this data now has concrete evidence for: `SuperlativeHostPool`
     `"ally"` + `HostMeasure` `"cost"` (unblocks `valk`, `deadpool`, contributes to `next_evol`/`aos` cost-shape
     packs too), an "any encounter card" attach host (`wonder_man`), a substring/name-based host or temporal
     "attacked this turn" qualifier (`spiderham`, `x23`).
  3. `iceman`'s "hero card in a different card_set_code" shape needs a decision (curation alias vs. a real
     mechanic) before `iceman`/`fne`/`hercules`/`storm` can progress.
  4. The 274 "no artwork reference" issues across 16 packs are `qsv`'s `imageOverrides` mechanism applied
     per-card — real research (a second source per face), not a parser change; the highest-volume remaining
     category but also the most labor-intensive per pack.
  5. Core/wave 1's generated-file staleness (§3 above) is worth a deliberate decision (regenerate and diff for
     real, or leave as-is) from whoever owns that regeneration next — it's not something this pass should decide
     unilaterally given the "don't touch Core/wave 1" mandate.

---

## Part 4: two more data-only packs emitted, ten more curated-but-blocked, schema requests consolidated

**2026-09-19, fourth pass.** Picked up after commit `8ac0b24` (Part 3 committed: `WAVE2_SCENARIOS`, Legions of
Hydra, `nova`/`silk`/`spdr`/`rogue`/`wolv`/`hood` emitted). Continued Task B: item 3's "hero card in a different
card_set_code" shape turned out to be a real, general mechanism (§2 below) — resolved for `iceman` (now emitted)
and used again for `storm`/`hercules`/`fne`. Worked through the gap matrix in ascending issue-count order.

### 1. Two more packs fully emitted

- **`ironheart`** (Cycle 5). Not a three-sided identity (Ant-Man/Wasp's shape) — **three separate, complete
  hero/alter-ego identity pairs** (Version 1/2/3, a "Level Up! swap to a stronger form" mechanic), which already
  normalized fine structurally. The only gap was artwork: MarvelCDB has no `imagesrc` for Version 2/3's four
  faces. Found and confirmed a second source — Hall of Heroes' own Ironheart release-page gallery (`i0a`–`i0f`,
  six images) — by downloading each candidate image to the scratchpad, **viewing it directly with the Read tool**
  (title, printed text, hand size/hit points, and the corner collector mark all cross-checked against the raw
  record), then deleting the local copy; only the URL is stored (`imageOverrides`, CLAUDE.md "Content & IP
  boundaries" — a reference, never bytes). `emit.ts`'s `KEY_BRANDS` needed no change (already covers `image`).
- **`iceman`** (Cycle 8). Needed the `auxiliaryHeroSetCodes` mechanism (§2) plus one confirmed dash-cost
  correction (Frostbite, 46002) and one `cardNotes` entry (Snow Clone, 46003, printed THW is a real dash,
  confirmed from MarvelCDB's own stat listing).

### 2. New general mechanism: `PackCuration.auxiliaryHeroSetCodes`

Several packs file a hero-kit card under its own themed sub-`card_set_code` instead of the identity's own set —
Storm's four-card Weather Deck (`storm_weather_deck`), Hercules' three-card Gift Deck (`hercules_gift_deck`),
Iceman's Frostbite (`iceman_frostbite`), Daredevil's five-card Sense Deck (`daredevil_sense_deck`, `fne`) — which
`heroBySet`'s plain `card_set_code` lookup couldn't resolve ("hero card in a set with no identity"). Added
`PackCuration.auxiliaryHeroSetCodes?: Readonly<Record<string, string>>` (auxiliary code → the pack's primary hero
`card_set_code`), consumed by `normalize/context.ts`'s `heroBySet` construction: after the primary map is built,
every auxiliary code is aliased to whatever hero record its primary code already resolved to. A primary code with
no real hero record behind it (a typo) simply doesn't alias anything — the auxiliary set's own cards then still
fail the ordinary check, not silently wrong. Confirmed working on four independent packs (`storm`, `iceman`,
`hercules`, `fne`) with zero regression risk to any pack that doesn't set it (additive, opt-in per pack).

### 3. Two more general normalizer fixes (same "wave 1 assumption doesn't hold everywhere" class as Part 3's `flatten.ts` fix)

- **`main-schemes.ts`'s B-side image lookup only ever consulted the dropped bare aggregate record's own
  `imagesrc`** (`ctx.aggregateImage`), which is how wave 1's main schemes happen to be shaped — but several later
  packs' main schemes have **no bare aggregate record at all**, even though the B-side's own *linked* record
  carries a perfectly good `imagesrc` MarvelCDB just never routed through the (nonexistent) aggregate. Added a
  fallback to the B-side record's own image, mirroring the A-side's existing `rb.imagesrc ?? ra.imagesrc`
  fallback. Confirmed fixing `mojo` (3 main scheme images, unblocking that pack down to one remaining card) with
  no change to any pack whose aggregate lookup already succeeds (wave 1's own output, byte-diffed — see §5).
  **Also silently helped `sm`** (36 → 30 issues) as a side effect, not independently investigated further.
- **`player-cards.ts`'s missing-`deck_limit` fallback only defaulted to 1 for a *specific* (scenario/campaign)
  unique card**, leaving a plain identity-specific unique card with no printed `deck_limit` (Hercules' Gift Deck,
  `is_unique: true`, no `specificTo`) falling through to 0 and failing `validateCard`'s "must be a positive
  integer" check. RRG's uniqueness rule caps *any* unique card at one copy in a deck regardless of why it's
  unique, so the same reasoning that justified defaulting a unique specific card to 1 applies unconditionally —
  simplified the condition from `specificTo !== undefined && r.is_unique` to just `r.is_unique`. Fixed
  `hercules`' three Gift Deck cards' `deck_limit` errors (10 → 7 issues); left a **non-unique** identity card with
  no printed `deck_limit` (`fne`'s Sense Deck, 5 cards) alone, since RRG's uniqueness-cap reasoning doesn't apply
  there and no comparable evidence justifies a different default — reported, not guessed at (§4).

### 4. Ten more packs curated, not all fully unblocked

Following the same "register a real curation, re-run `survey.ts --pack <code>`, only trust what it reports"
discipline as every earlier pass. Each pack below is registered in `survey.ts` (so its real state is visible and
tested) but **NOT** in `ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS` (so nothing can accidentally emit invalid
data) unless noted as "emitted" in §1:

| Pack | Cycle | Issues before → after curation | What's left |
|---|---|---|---|
| `mojo` | 6 | 6 → 2 (both the same card) | Bandolier of Stakes' only attach info is inside its own `When Revealed` ability body, not a standalone preamble sentence — a parser-architecture gap (§5.1), confirmed the only instance of this shape in the whole 63-pack corpus. |
| `storm` | 6 | 10 → 2 | Possessed needs `SuperlativeHostPool "ally"` + `HostMeasure "thw"` (schema gap, §5.2). |
| `hercules` | 10 | 10 → 7 | The Labor Deck (59002–59004+) is a hero-owned, encounter-shaped card mechanic with no schema shape yet (§5.3). |
| `fne` | 10 | 13 → 8 | `deck_limit` gap on 5 non-unique Sense Deck cards (no evidence-backed default found, §5.4); Photographic Reflexes' triple MarvelCDB record (60040a/b/c) is genuinely ambiguous without a second source (§5.5); 3 missing images. A brand-new pack (July 2026) with more open questions than usual. |
| `gmw` | 3 | 15 (originally) → 4 | The Collector's standard/expert flip-side shape is the same schema gap as `mts`'s Hela (§5.2) — now confirmed on two independent packs. |
| `wonder_man` | 10 | 3 → 1 | Coordinated Effort needs an "any encounter card in play" attach host (schema gap, §5.6). |
| `x23` | 7 | 2 → 1 | 43012 needs a temporal "attacked this turn" qualifier (schema gap, §5.7). |
| `psylocke` | 7 | 2 → 1 | Psi-Knife (41002a) still has no artwork reference — no second source found/confirmed this pass. |
| `valk` | 4 | 2 (unchanged) | Beguiled needs the same `SuperlativeHostPool "ally"` + `HostMeasure "cost"` gap as `deadpool`/`jubilee` (§5.2). |
| `deadpool` | 7 | 2 (unchanged) | 'Pool-ized — identical shape to `valk`'s Beguiled. |
| `spiderham` | 5 | 1 (unchanged) | Warrior of the Great Web needs a substring/title-contains host (schema gap, §5.8). |

`jubilee` (Cycle 8, 11 issues) was investigated but not curated: "Lost" Child (47027) is the same `SuperlativeHostPool
"ally"`/`HostMeasure "cost"` shape as `valk`/`deadpool` (§5.2); its other 9 issues are missing artwork for three
different `a`/`b`/`c`-suffixed event/resource records (Firecracker, Flash of Light, Plasmoid Energy) — real second-
source research for 9 images, not attempted this pass to keep moving through the gap matrix.

### 5. Schema requests for `game-rules-architect`

**Status as of Part 5 (2026-09-19, fifth pass): six of the nine items below landed** in
`packages/content/src/schema/**`, `docs/phase7-wave2.md` §7 (2026-09-19), each exactly as requested. The pipeline
implemented the matching parser mappings the same pass (§7.7's table) — see Part 5 §1–§2. **Three items are
still open after §7**, marked below; each is re-stated precisely (unchanged from when first reported, since §7
didn't touch them) so it stays a single source of truth rather than being re-derived from two places.

1. ~~Attach rule inside a triggered ability's body, not the preamble~~ — **not a schema item, but resolved by the
   pipeline itself in Part 5 §2** (a `parse-text.ts` change, not a schema request). Originally reported only
   against Bandolier of Stakes (`mojo`, 39048); turned out to be the same root cause blocking Beguiled/
   'Pool-ized/"Lost" Child too (see item 2). **`mojo`'s own card is still blocked** — its phrasing ("You may
   spend 1 resource of any type to **attach this card to** your identity. Otherwise, discard this card.") isn't
   a leading "Attach to X." sentence the way the other four are, so the fix (which only recognizes that exact
   leading-sentence shape inside an ability body) doesn't reach it. Left as a documented, narrower residual gap
   — see Part 5 §2.
2. ~~`SuperlativeHostPool "ally"` / `HostMeasure "printedCost"`~~ — **landed** (docs/phase7-wave2.md §7.1,
   exactly as requested, named `printedCost` not `cost`). Combined with item 1's parser fix, this closed
   Beguiled (`valk` 25031), 'Pool-ized (`deadpool` 44041) and "Lost" Child (`jubilee` 47027) — all three parse
   correctly now (`valk`/`deadpool` fully emitted; `jubilee` still blocked on unrelated missing artwork). **The
   `"thw"` measure `storm`'s Possessed needs was NOT part of this request and did not land — still open**, see
   item 2b below.
   - **2b, still open after §7: `HostMeasure` needs `"thw"`** (a card's printed THW, the `thw` counterpart of the
     now-landed `printedCost`/existing `printedAtk`/`printedHp`). Possessed (`storm`, 36038): `"Attach to the
     ally with the lowest THW without Possessed attached."` Same `SuperlativeHostPool "ally"` (now available),
     same "attach rule inside a When Revealed body" shape (now parseable) — the *only* missing piece is this one
     measure value. The narrowest possible remaining ask.
3. **Still open after §7: The Collector (`gmw`, 16080/16081) and Hela (`mts`, 21136/21137) — a villain stage
   with a flip-side back face, not a second numbered stage.** Re-stated exactly as first reported (§7 doesn't
   mention it): MarvelCDB's `stage` field reads "A1"/"A2" (standard) and "B1"/"B2" (expert) instead of a roman
   numeral. Each mode (A/standard, B/expert — confirmed for Hela via a web search of the printed card's own
   flavor: "Hela is a double-sided villain that has a Standard and an Expert version") is a genuine
   **single-stage** villain (Hela A1 health 8 / B1 health 9; Collector A1 health 8 / B1 health 10 — a
   standard-vs-expert HP difference, not stage growth) whose ONE stage has a front face and a "cannot be
   defeated" back face, flipped by a Forced Response ("After a side scheme is defeated, flip Hela to her mystic
   side" / Collector's analogous text). `VillainCard`/`VillainStage` has no `flipSide` field — only encounter
   cards and player cards have one (`EncounterCardFlipSide`/`CardFlipSide`, docs/phase7-wave2.md §1.5). Proposed
   shape: `VillainStage.flipSide?: { name: string; text: CardText; traits: readonly Trait[]; keywords:
   readonly KeywordInstance[]; abilities: readonly AbilityReference[]; hp?: ScalingValue }` (hp optional/absent
   when the flip side, like both of these, prints no separate HP — "cannot be defeated" makes HP moot), and the
   standard/expert split modeled as two ordinary single-stage `VillainCard`s (not two sides of one) the way
   `toafk`'s Kang/exp_kang split already is. Also likely relevant to `aos`/`tt`'s own "villain stage label is not
   a roman numeral" entries (22 total across `aos`/`gmw`/`mts`/`tt`) — not individually re-checked against this
   shape yet.
4. **Still open after §7: Hercules' Labor Deck (59002 Defeat the Hydra, 59003 Embody Pathos, 59004 Protect
   Humanity, and likely more unsurveyed `hercules_labor_deck` codes) — a hero-owned, encounter-shaped card.**
   Re-stated exactly as first reported. Each prints `faction_code: "hero"` (identity-specific, like the Gift
   Deck) but is typed `attachment`/`obligation` and behaves like an *encounter* card: `"Victory 0."`, a `When
   Revealed:` trigger that searches for and attaches/plays itself, no resource cost, no deck slot.
   `AttachmentCard`/`ObligationCard` (`schema/cards/encounter-cards.ts`) assume `faction_code: "encounter"`. No
   shape proposed here — needs a real design decision (closest existing precedent is
   `PlayerCardCommon.separateDeck`/`IdentitySeparateDeck`, but those are ordinary player cards, not
   encounter-shaped ones).

**Closed, landed exactly as requested (§7.2/§7.3/§7.4, all confirmed working end to end this pass — Part 5 §1):**
`AttachmentHost { kind: "encounterCard" }` (Coordinated Effort, `wonder_man` 58032 — now emitted);
`HostQualifiers.titleContains` (Warrior of the Great Web, `spiderham` 30029 — now emitted);
`HostQualifiers.attackedThisTurnBy`, **data only exactly as the architect specified** (Puncture Wound, `x23`
43012 — emitted, but flagged in `cardNotes` as not-yet-playable per §7.4's own note that the engine records no
per-turn attack history).

**Not schema items — pipeline-level, resolved without a request:**
- `fne`'s Sense Deck `deck_limit` gap and Photographic Reflexes' triple record are curation/evidence questions,
  not schema gaps — restated in Part 4 §5 items 5–6, unchanged, not re-litigated here.

### Progress / next up

- **Done this pass:** `ironheart`, `iceman` emitted (23 packs in `DATA_ONLY_CARDS` now). `auxiliaryHeroSetCodes`
  (new, general) and two more general normalizer fixes (`main-schemes.ts` B-side image fallback,
  `player-cards.ts` unique-card `deck_limit` default). Ten more packs curated with real findings
  (`mojo`/`storm`/`hercules`/`fne`/`gmw`/`wonder_man`/`x23`/`psylocke`/`valk`/`deadpool`/`spiderham`), all
  registered in `survey.ts`, none emitting invalid data. Nine schema/parser-architecture gaps consolidated above.
  `phoenix` stays withheld exactly as decided in Part 3 — not revisited this pass.
  Survey: **40 of 63 packs normalize cleanly** (up from 34 before Part 3, 38 after Part 3's commit).
- **Verified: root `pnpm typecheck`/`pnpm test` clean.** `@mc/content` 389 tests (was 388 after Part 3's commit,
  +1 net from `iceman`'s emission — `ironheart` landed mid-pass before the tally, both counted in the 388→389
  delta together with the pack-count assertion bumps). `@mc/cards`'s 2 pre-existing failures from concurrent
  work in that package are unrelated (confirmed unrelated file paths) and outside this remit.
- **Regenerated all already-registered packs again this pass to check the two new general normalizer fixes for
  regressions** (same discipline as Part 3 §3): only the intended files changed for every pack except Core and
  the same six wave 1 packs (`bkw`/`cap`/`drs`/`gob`/`hlk`/`msm`/`thor`), which reproduced the *exact same*
  pre-existing, pre-this-agent staleness Part 3 already found and reverted (`git checkout`, not committed —
  still not this pass's to resolve).
- **Next opportunity, in rough order of leverage:**
  1. `game-rules-architect`: the nine schema/parser requests above, roughly by how many packs each unblocks —
     `SuperlativeHostPool "ally"`/`HostMeasure "cost"`/`"thw"` (4 packs: `valk`, `deadpool`, `jubilee`, `storm`),
     `VillainStage.flipSide` (2 packs: `gmw`, `mts`, likely more once `aos`/`tt` — both also flagged "villain
     stage label is not a roman numeral" — are checked against this same shape).
  2. `jubilee`'s three missing-artwork records (9 images) and `psylocke`'s Psi-Knife (1 image) are ready for the
     `imageOverrides` treatment the moment someone does the second-source research (same recipe as `ironheart`
     §1: download to scratchpad, view with Read, delete, cite the URL).
  3. The big packs (`next_evol` 86, `aos` 76, `cw`/`tt` 57, `aoa` 56, `mts` 38, `jj`/`mut_gen` 37, `sm` 30,
     `luke_cage` 26, `synthezoid` 22) are each a mix of several of the above categories plus more not yet
     individually triaged — worth a fresh pass once the schema items land, since several of their issues will
     likely resolve for free the way `sm`'s did this pass.
  4. Core/wave 1's generated-file staleness (Part 3 §3) is still just reverted, not resolved — still not this
     pass's call.

---

## Part 5: `game-rules-architect`'s §7 landed; five more packs emitted; the "attach rule inside an ability body" gap generalized

**2026-09-19, fifth pass.** Picked up after commit `c061906` (Part 4 committed: `ironheart`/`iceman` emitted, 23
data-only packs, ten packs curated-but-withheld, nine schema/parser requests). `game-rules-architect` landed six
of those nine requests the same day (docs/phase7-wave2.md §7, "Schema requests from the data pipeline"). This
pass: (1) implemented every §7.7 parser mapping and emitted the packs they unblocked, (2) found and fixed one
more general parser gap along the way, (3) re-stated the three items §7 didn't cover as still open (§5 above,
in place — not duplicated in a second list), (4) surveyed the rest of the gap matrix for further movement.

### 1. §7's parser mappings implemented, one at a time

All six landed shapes wired into `parse-text.ts`, each exactly as §7.7's table specifies:

- `Attach to an encounter card in play.` → `{ kind: "encounterCard" }` (added to `parseAttach`'s `simple` map).
- `Max N per encounter card.` → `playRestrictions.maxPerHost` (extended the existing `Max N per <category>.`
  regex in `parseRestriction`).
- `Attach to a character with "X" in its title.` → `{ kind: "qualified", category: "character", titleContains:
  "X" }` (new pattern, tried before the generic `qualified`/superlative checks so it can't be swallowed by
  either).
- `Attach to an enemy that A or B attacked this turn.` → `{ kind: "qualified", category: "enemy",
  attackedThisTurnBy: ["A", "B"] }` (new pattern; still emits real, correct data even though the field is data
  only per §7.4 — the pipeline's job is correct data, not deciding playability).
- `the ally with the highest cost` → `SuperlativeHostPool "ally"` added to the existing `supCore` regex's pool
  alternation; `cost` → `measure: "printedCost"` added to the existing descriptor ternary (not `"cost"` — the
  architect's own naming decision, §7.1, matched exactly).
- `Prerequisite (T).` / `Prerequisite (T1 or T2).` → `{ name: "prerequisite", traits: [...] }`, spelled like the
  existing `discount` keyword parser; the unconfirmed "form" half (`Prerequisite (hero form).`) is also
  recognized on the strength of the rulebook's own "form or trait" phrasing, since no emitted card prints it yet
  to test against.
- `Starting.` (with its reminder text) → `{ name: "starting" }`, added to `SIMPLE_KEYWORDS` (the same table
  `permanent`/`toughness`/etc. already use, so the existing reminder-text-stripping logic covers it for free).

Verified against `packages/content/src/schema/wave2-data-requests.test.ts` (14 tests, `game-rules-architect`'s
own fixtures) and `wave1.test.ts`/`wave2*.test.ts` — all pass unchanged; `pnpm --filter @mc/content typecheck`
clean after every mapping.

### 2. One more general parser fix, found while wiring §7.1 in: attach rules inside a triggered ability's body

Landing `SuperlativeHostPool "ally"`/`HostMeasure "printedCost"` alone didn't unblock Beguiled (`valk`) or
'Pool-ized (`deadpool`) — both still failed with "attachment without an attach rule". Their printed text is:

```
When Revealed: Attach to the ally with the highest cost without Beguiled attached. Attached ally engages
its controller. Otherwise, this card gains surge.
```

The "Attach to X." sentence is the **`When Revealed:` ability's own opening sentence**, not a separate preamble
line — `parseCardText` only ever scanned the preamble (the text before any trigger header) for an attach rule,
by design, since every other attachment in the 63-pack corpus prints its attach rule as a standalone preamble
sentence. This is the *general* shape behind what Part 4 §4 reported narrowly as "Bandolier of Stakes' own
gap" (`mojo` 39048) — it turned out not to be a one-card idiom at all, just under-sampled: **four** confirmed
cards (Beguiled `valk` 25031, 'Pool-ized `deadpool` 44041, "Lost" Child `jubilee` 47027, Possessed `storm`
36038) share the exact shape "a `When Revealed:` ability whose own first sentence is a plain `Attach to X.`
line". Fixed generally in `parse-text.ts`: when no preamble attach rule was found, each triggered ability's own
first sentence (immediately after its trigger header) is tried against the same `parseAttach` function used for
the preamble — first header to match wins (mirroring the preamble's own "first wins, a second is reported"
rule), and **nothing is stripped from the ability's own text**, unlike a preamble attach rule (which the
existing code does remove) — this sentence is also load-bearing game text (the "Otherwise, this card gains
surge." branch reads on it), so `ability-scripting-engineer` still needs to see it verbatim.

**`mojo`'s Bandolier of Stakes (39048) stays blocked** — its own phrasing is structurally different ("You may
spend 1 resource of any type to **attach this card to** your identity. Otherwise, discard this card." — "attach"
is mid-sentence, not the sentence's own leading verb), so this fix correctly doesn't reach it. Re-confirmed by
survey: `mojo` unchanged at 2 issues (1 card, both error lines about it).

**Verified no regression:** regenerated every already-registered pack (`--offline`) after this fix; only the
already-known, pre-existing Core/wave 1 staleness (Part 3 §3) reproduced, reverted the same way as every prior
pass — nothing new.

### 3. Five more packs fully emitted

`wonder_man`, `x23`, `valk`, `deadpool`, `spiderham` — all confirmed clean via `survey.ts` before registering in
`ingest-marvelcdb.ts`'s `REGISTERED_CURATIONS`, emitted and wired into `DATA_ONLY_CARDS`/`DATA_ONLY_ENCOUNTER_SETS`/
`data-only.test.ts` one at a time. Spot-checked the emitted data directly against the new shapes (all four match
§7's proposed shapes exactly):

```ts
// Beguiled (valk, 25031)
attachesTo: { kind: "superlative", among: "ally", order: "highest", measure: "printedCost", withoutAttachmentNamed: "Beguiled" }
// Warrior of the Great Web (spiderham, 30029)
attachesTo: { kind: "qualified", category: "character", titleContains: "Spider" }
// Coordinated Effort (wonder_man, 58032)
attachesTo: { kind: "encounterCard" }
// Puncture Wound (x23, 43012)
attachesTo: { kind: "qualified", category: "enemy", attackedThisTurnBy: ["X-23", "Honey Badger"] }
```

Puncture Wound's `cardNotes` records the data-only status §7.4 specifies, for whoever scripts X-23 next.
`DATA_ONLY_CARDS` is now **28 packs** (up from 23).

### 4. Gap matrix re-surveyed

`jubilee`'s "Lost" Child (47027) resolved for free from §2's fix (11 → 9 issues) — **not emitted**, though: its
remaining 9 issues are unrelated missing artwork for three `a`/`b`/`c`-suffixed records (Firecracker, Flash of
Light, Plasmoid Energy), unchanged from Part 4's finding, not re-attempted this pass (real second-source
research, not a parser fix). `mts` dropped 38 → 36 (two records' attach rules resolved by §2's fix, structurally
similar to the four confirmed cards but not individually re-verified). No other pack's blocker changed —
`storm`/`hercules`/`fne`/`gmw`/`psylocke` remain exactly as Part 4 described (§5 above has the up-to-date,
single-source-of-truth status for each). Full survey: **45 of 63 packs normalize cleanly** (up from 40 at the
start of this pass).

Looked at the largest still-blocked packs (`luke_cage`, `synthezoid`) for further quick wins: `luke_cage` (26
issues) is almost entirely missing artwork (25 of 26 records) — a brand-new pack with little second-source
material yet, not attempted. `synthezoid` (22 issues) has a mix of a competitive-mode-only attach idiom ("Attach
to a minion of the enemy team's choice" — this project builds cooperative play only, RRG 1.8 p. 4) and a
"side scheme without starting threat" gap needing individual card-image confirmation; not attempted this pass to
keep the report accurate rather than partially guessed at.

### Progress / next up

- **Done this pass:** all six landed §7 schema shapes wired into the parser; one more general parser fix (attach
  rules inside a triggered ability's body); five more packs emitted (`wonder_man`, `x23`, `valk`, `deadpool`,
  `spiderham` — `DATA_ONLY_CARDS` now 28 packs). The nine-item schema request list (§5 above) is now current:
  six closed, three restated as "still open after §7" (the `thw` measure, `VillainStage.flipSide`, Hercules'
  Labor Deck shape).
- **Survey: 45 of 63 packs normalize cleanly** (up from 40 at the start of this pass, 34 before Part 3).
- **Verified: root `pnpm --filter @mc/content typecheck`/`test` clean** (408 tests; the schema package's own new
  `wave2-data-requests.test.ts`, `game-rules-architect`'s, is part of that count and not this pipeline's to
  maintain). Regenerated and diffed every registered pack again — only the known pre-existing Core/wave 1
  staleness reproduced, reverted as always.
- **Still withheld, unchanged from Part 4 except where noted:** `phoenix` (needs 34028's exact text), `mojo`
  (Bandolier of Stakes' distinct phrasing, §2), `storm` (needs the `thw` measure only — the narrowest remaining
  gap of the three), `hercules` (Labor Deck), `fne` (deck_limit + Photographic Reflexes triplication + images),
  `gmw` (needs `VillainStage.flipSide`), `psylocke` (one missing image, not sourced), `jubilee` (nine missing
  images, not sourced).
- **Next opportunity, in rough order of leverage:**
  1. `game-rules-architect`: the `thw` measure alone (item 2b) fully unblocks `storm` — the cheapest remaining
     schema ask. `VillainStage.flipSide` unblocks `gmw` and likely contributes to `mts`/`aos`/`tt`'s own "villain
     stage label is not a roman numeral" entries (22 total, not yet individually re-checked against this shape).
  2. Second-source image research: `jubilee` (9 images), `psylocke` (1 image), `luke_cage` (25 images, a whole
     pack) — same recipe as `ironheart` (Part 4 §1): download to scratchpad, view with Read, delete, cite the
     URL.
  3. `fne` needs either a confirmed `deck_limit` value for its Sense Deck or a `game-rules-architect` decision on
     whether non-unique identity cards default the same way unique ones do (Part 4 §5 item 5), plus a decision on
     Photographic Reflexes (item 6).
  4. The remaining big packs (`next_evol` 86, `aos` 74, `cw`/`tt` 57, `aoa` 56, `jj`/`mut_gen` 37, `sm` 30,
     `luke_cage` 26, `synthezoid` 22) still need individual triage — several will likely resolve partially for
     free once the `thw` measure and `VillainStage.flipSide` land, the way `jubilee`/`mts` did this pass.
  5. Core/wave 1's generated-file staleness (Part 3 §3) is still just reverted every pass, never resolved —
     still not this pipeline pass's call to make unilaterally.
