# Phase 7 wave 2: cycle 1 finished, data-only pool started (`card-data-pipeline`)

Scope: PLAN.md Phase 7 "Wave 2 scope decided (2026-09-18)". This file now covers two passes:

1. **2026-09-18, first pass:** the schema-neutral parser sweep across all 62 non-Core packs, then curating and
   emitting `scw`, `ant`, `wsp`, `trors` (cycle 1). `docs/phase7-wave2.md` is `game-rules-architect`'s parallel
   spec for cycle 1's schema and engine primitives — cited throughout by section.
2. **2026-09-18, second pass (this one):** finished cycle 1 (`qsv`, `toafk`), applied every remaining §5
   curation/image check, wired `WAVE2_CARDS` with tests, curated all six cycle 1 starter decks, and made a start
   on Part 2 — 15 more packs (`bp` plus 14 packs that needed no curation at all) wired into a new, separate,
   explicitly-not-playable `DATA_ONLY_CARDS` pool.

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
- **Verification:** root `pnpm typecheck` and `pnpm test` are clean at the end of this pass: content 374,
  engine 607, cards 441, client 1271 — 2,893 tests, zero failures. `src/data/core` and the eight wave 1 pack
  folders are confirmed git-unmodified (`git status`) — byte-identical, as required. (I regenerated all nine at
  one point to sanity-check my normalizer edits against them; the only diff was the raw cache's `fetchedAt`
  header stamp, not card data — reverted with `git checkout`, not committed.)

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
