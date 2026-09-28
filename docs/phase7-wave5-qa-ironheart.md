# Phase 7 wave 5 rules-QA pass — Ironheart pack

`rules-qa-engineer` independent QA pass over the Ironheart pack only (docs/wave-definition-of-done.md §4), modeled
on `docs/phase7-wave5-qa-nova.md`. Scope: `packages/content/src/data/ironheart/cards.ts` (29001a/b–29040, 3 identity
pairs + 37 other cards) and `packages/cards/src/wave5/ironheart/*.ts` (identity, events, allies, support-upgrades,
obligation-nemesis, zzzax).

## 0. §0's Nova-pass blocker (`wave4/reprints.ts` false-positive alias) is fixed as of this pass

Nova's own QA pass (docs/phase7-wave5-qa-nova.md §0) found `ability <id> is defined twice` blocking every wave 5
test file. Re-checked at the start of this pass: `pnpm --filter @mc/cards exec vitest run src/wave5` — **86 files,
944 tests, all green**; `pnpm --filter @mc/cards exec vitest run src/wave5/ironheart` — 9 files, 120 tests, all
green before this pass's own additions. Not this pass's fix (no commit history checked for who fixed it); noted
here only so a reader of both docs isn't left thinking the blocker is still open.

## 1. Card-by-card audit

All 40 Ironheart cards (29001a/b–29040) read against `packages/content/src/data/ironheart/cards.ts`'s printed
text, the card scans under `assets/card-art/bundles/cards/`, RRG 1.8, and
`marvel-champions-rulings-post-rrg-1-7.md` (grepped for "Ironheart", "Riri", "Haywire", "Bombshell", "Go for
Champions!", "Snowguard", and every other card name in the pack).

**Every card's own script (`identity.ts`, `events.ts`, `allies.ts`, `support-upgrades.ts`,
`obligation-nemesis.ts`, `zzzax.ts`) already carries a docblock that ties its reading line-by-line to the printed
text, cites the exact RRG page or ruling for every non-obvious call, and names the precedent card whose shape it
reuses** — the same standard `docs/phase7-wave5-qa-nova.md` found for Nova's own scripts. Spot-checked against the
card scans directly (not just the ingested `text.printed`/`text.current` fields) for the pack's trickiest cards:
Political Retribution (29032, three independent `if` clauses, not if/else-if — scan matches the ingested text
verbatim), Haywire (29038, scan matches verbatim), Snowguard (29023, exact tiered thresholds, scan matches
verbatim), Cyborg Tech (29031), Lucia von Bardas (29030) — all match. No wording drift found between any scan and
its `text.printed`.

Every ability id named in a card record's own `abilities` array is exercised by at least one test in the matching
`*.test.ts` file (confirmed by reading all nine: `identity.test.ts`, `events.test.ts`, `allies.test.ts`,
`support-upgrades.test.ts`, `obligation-nemesis.test.ts`, `zzzax.test.ts`, `cross-hero.test.ts`,
`custom-deck.test.ts`, `e2e.test.ts`), asserting the exact printed effect rather than "something happened" — e.g.
`29030.lucia-von-bardas-constant`'s own test checks both SCH and ATK are +0 without a tough status card and +1/+1
with one, not just "gets some bonus"; `29023.snowguard-response`'s own tests check the tier is read as _exactly_
equal to the shift-counter count (not "at least"), matching the printed "(X)" reading, via three separate
`valueEquals` constants rather than one `counterAtLeast`.

Three things worth calling out precisely:

- **The "Progressing Identity" mechanic (29001a/29002a/29003a) is a same-instance `swapIdentity`, not a flip or a
  hero-form change** — RRG 1.8 "Swap" p. 42's "neither card … enters or leaves play" is exercised by real play in
  `e2e.test.ts`'s own scripted game (both `29001a.level-up`/`29002a.level-up` calls, back to back, in one round),
  confirming damage, exhaustion, and hand size all carry correctly across both swaps. `identity.test.ts`'s own
  unit tests additionally prove the dial's damage persists (RRG 1.8 p. 42) and that hit points stay the printed
  10 across all three versions even though ATK/THW/DEF differ per version.
- **"Go for Champions!" (29025) content-data finding, not a script bug (see §4).** The script correctly implements
  the errata'd text (RRG 1.8 p. 68, confirmed against the scan for the _current_ rules text and against the
  January 26, 2026 (1) ruling's own footnote: "Go for Champions! now removes itself from the game"). But
  `text.printed` in `packages/content/src/data/ironheart/cards.ts` is **identical** to `text.current` — both
  include the errata'd "Remove … from the game →" clause — while the physical card scan
  (`assets/card-art/bundles/cards/29025.png`) has **no such clause at all**, only "Hero Action: Each Champion
  character in play cannot take damage until the end of the round." Traced to source: MarvelCDB's own raw API
  record for this card (`packages/content/raw/marvelcdb/ironheart.json`, code `29025`) carries an `errata` field
  ("Added 'Remove... from the game →'. (RRG 1.5)") but its own `text`/`real_text` fields are _already_ the
  post-errata text — MarvelCDB's API doesn't preserve pre-errata card text at all for this card, unlike several
  other packs' own erratad cards, where `printed` and `current` genuinely differ in this same file format
  (confirmed: `bkw`, `core` (M.O.D.O.K.), `mts`, `nebu`, `sm`, `spdr`, `trors`, `wsp` all have at least one card
  where `text.printed !== text.current` in this codebase, so the schema and pipeline both already support this
  distinction — this pack's own `29025` record just didn't get a hand-curated `printed` override reconstructing
  the pre-errata line from the scan). **Gameplay is correct** (the engine implements the current, errata'd rule);
  this is a display/provenance-accuracy gap only. Reported to `card-data-pipeline` in §4 rather than fixed here
  (their file, `packages/content/src/data/ironheart/cards.ts`, a generated file, plus a curation override in
  `packages/content/scripts/marvelcdb/curation/ironheart.ts`).
- **Political Retribution's (29032) three clauses are independent, not if/else-if — the pack's own docblock says
  so explicitly, but before this pass no test proved the case where both named cards are in play at once** (see
  §2, this pass's #3).

## 2. New tests added this pass

All three run against the real `WAVE5_DEPS` (no diagnostic harness needed this pass — §0's blocker is already
resolved) and pass.

1. **`packages/cards/src/wave5/ironheart/e2e.test.ts`, "Rhino (expert), solo: Ironheart"** — the wave definition of
   done's own "one expert game… to an outcome, replay deep-equal" requirement (this pack had a solo standard game,
   a hand-scripted standard game, and a 2-player standard game, but no expert game, before this pass). Modeled
   directly on `../nova/e2e.test.ts`'s own "Rhino (expert), solo: Nova" (itself modeled on
   `wave4/hood/e2e.test.ts`'s own "(expert)" test): `ironheartScenario("rhino", { seed: SEED, difficulty:
"expert" })`, played to a real outcome by the card-name-agnostic greedy driver, replayed and asserted
   deep-equal against the live session state. Confirmed passing directly against `WAVE5_DEPS`.
2. **`packages/cards/src/wave5/ironheart/zzzax.test.ts`, "retypes a card's printed resource without collapsing its
   icon count — a [physical][physical] card (Strength, 01090) still counts as 2"** — a regression test for the
   April 30, 2026 (Ruling 3, #6) ruling (`marvel-champions-rulings-post-rrg-1-7.md` line 778/787): "With Haywire
   attached, does the Energy resource card count as 1 or 2 energy icons? … Haywire does not affect resource icons;
   Energy still provides 2 icons." Before this pass, `29038.haywire-constant`'s own test only proved the retype
   itself, using hand cards each worth exactly 1 printed icon (`29013` Propulsion Jets, `[physical]` x1) — it could
   pass even if a wrong implementation collapsed every retyped card's icon count to 1 regardless of how many icons
   it actually printed. This test adds Core's "Strength" resource (01090, `[physical][physical]`, basic aspect,
   deckLimit 1 — carried in as an `ironheartScenarioWithExtras` extra code, deck legality off) to the hand under
   Haywire and asserts Zzzap!'s own reveal (29040, "take indirect damage equal to the total number of [energy]
   resources in your hand") counts it as 2, not 1 — proving the engine's own `printedResourcesOf`
   (`packages/engine/src/select.ts`) correctly sums a card's printed icons _before_ retyping them
   (`total = physical+mental+energy+wild`), matching the ruling, rather than collapsing to a flat 1-per-card.
   Confirmed: the engine already implements this correctly and generically (this test is proof of that, not a fix
   for a bug); `packages/engine/src/printed-resource-as.test.ts`'s own synthetic fixtures never exercised a
   2-icon card either, so this closes a real coverage gap at both the engine-primitive and the pack level.
3. **`packages/cards/src/wave5/ironheart/obligation-nemesis.test.ts`, "with both Lucia von Bardas and Rule by
   Force in play, she schemes AND 3 threat is placed on it (independent clauses, not if/else-if), and no
   surge"** — Political Retribution's (29032) own printed text is three separate conditional clauses that can
   overlap ("If Lucia von Bardas is in play, she schemes. If Rule by Force is in play, place 3 threat on it. If
   neither is in play, this card gains surge."), and `obligation-nemesis.ts`'s own docblock says exactly this
   ("three independent conditional clauses, not an if/else-if chain — the first two … can both be true at once").
   Before this pass, the three existing tests each isolated a single card in play (Lucia only; Rule by Force only;
   neither), so an accidental if/else-if implementation (only the first true branch firing) would have passed all
   three without ever exercising the case the docblock calls out as the reason for the design. This test puts
   both Lucia von Bardas and Rule by Force in play at once and asserts both effects fire in the same reveal, with
   no surge — this is the highest-risk untested interaction point in the pack (two card-vs-card conditions
   overlapping on one treachery), per this project's own stated priority for card-vs-card interaction coverage
   over isolated-card coverage. Passed on the first run against the existing `29032.when-revealed` script — no
   bug found, but the coverage gap was real.

## 3. What this pass did not do

- **Did not re-audit Nova, Ghost-Spider, Spider-Man (Miles Morales), Spider-Ham, or SP//dr** — out of this pass's
  stated scope (Ironheart pack only).
- **Did not survey the rest of the pool for other `wave4/reprints.ts`-class false positives** (§0's blocker,
  already resolved for Ironheart specifically — `29022.agent-13-response` is a deliberate hand-alias to `sm`
  27046, not an auto-alias collision, confirmed by reading `allies.ts`'s own docblock and the direct object
  reference in `allies.ts`, not `wave4/reprints.ts`'s scan).
- **Did not open a diagnostic/throwaway harness** — unlike Nova's pass, §0's blocker was already resolved, so
  every claim and test in this pass ran directly against real `WAVE5_DEPS`.

## 4. Findings routed elsewhere

1. **`card-data-pipeline`: "Go for Champions!" (`ironheart` 29025) `text.printed` should be hand-curated to the
   pre-errata line the physical card actually shows** (scan: `assets/card-art/bundles/cards/29025.png`, no
   "Remove … from the game →" clause), instead of duplicating `text.current`'s already-errata'd text — MarvelCDB's
   own raw API record for this card provides no pre-errata text of its own (only an `errata` field describing the
   change), unlike this same file format's convention elsewhere in the pool (`bkw`, `core`, `mts`, `nebu`, `sm`,
   `spdr`, `trors`, `wsp` all correctly diverge `printed`/`current` on at least one card). Not a gameplay bug — the
   engine already implements the current, errata'd rule correctly (`packages/cards/src/wave5/ironheart/events.ts`
   `29025.go-for-champions-action`) — a content-accuracy/provenance gap only, in a generated file
   (`packages/content/src/data/ironheart/cards.ts`) plus its curation source
   (`packages/content/scripts/marvelcdb/curation/ironheart.ts`, currently `errata: []` for this pack).

No engine or ability-scripting bugs found this pass. No `it.fails`/rules questions for the user this pass — every
finding above either already worked correctly (proven by new tests) or is a data-pipeline accuracy gap with no
gameplay impact.
