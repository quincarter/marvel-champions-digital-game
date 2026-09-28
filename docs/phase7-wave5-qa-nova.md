# Phase 7 wave 5 rules-QA pass — Nova pack

`rules-qa-engineer` independent QA pass over the Nova pack only (docs/wave-definition-of-done.md §4), modeled on
`docs/phase7-wave4-qa.md`. Scope: `packages/content/src/data/nova/cards.ts` (28001a/b–28032, 32 cards) and
`packages/cards/src/wave5/nova/*.ts` (identity, events, support-upgrades-allies, obligation-nemesis, armadillo).

## 0. Blocking finding (found this pass, not Nova's own bug — reported first because it currently blocks every
Nova test, and every wave 5 test)

**`ability <id> is defined twice` at `packages/cards/src/wave4/reprints.ts`'s auto-alias mechanism, triggered by
commit `1367fa03` ("content: wire wave 5 (cycle 4) into the playable card pool").** Confirmed present at HEAD as of
this pass; **`pnpm --filter @mc/cards exec vitest run` currently fails 79 of 305 test files, 1 of 2547 tests**
(the rest of `@mc/cards`, not just Nova). Repro: `WAVE5_DEPS` (`packages/cards/src/wave5/index.ts`) throws
`ability 27013.bait-and-switch-action is defined twice` building `mergeRegistries(WAVE4_ABILITIES, SM_ABILITIES,
…)` — every Nova test file fails at import time with this same error (all 7 Nova test files, 98 tests, none of
which ran this pass because of it).

**Root cause, traced by hand (not guessed):** `wave4/reprints.ts` programmatically finds "reprint" pairs — same
printed name, type, and ability shape — between `WAVE4_CARDS` (its own scan pool) and an "earlier" pool fixed to
`WAVE1_CARDS ∪ WAVE2_CARDS ∪ WAVE3_CARDS`, then auto-aliases the later id straight to the earlier
`AbilityDefinition`. `WAVE4_CARDS` (`wave4/cards.ts`) is `@mc/content`'s own `PLAYABLE_CARDS`. Before `1367fa03`,
`PLAYABLE_CARDS` topped out at cycle 3, so this scan never saw a wave 5 card. `1367fa03` wired cycle 4 (`sm`,
`nova`, `ironheart`, `spiderham`, `spdr`) directly into `PLAYABLE_CARDS` — which `wave4/reprints.ts` now also scans,
with no guard against it. Two confirmed false positives (there are certainly more; this pass only had reason to
find these two):
- **Ghost-Spider's "Bait and Switch" (`sm` 27013, event)** vs. **Nefarious Nefarious/S.C.W.'s own "Bait and
  Switch" (`scw` 15030, wave 2, also an event)** — same name, same type, and both compile to a single
  `<id>.bait-and-switch-action` ref, satisfying `wave4/reprints.ts`'s own "same slug and count" shape check.
- **Nova's own "Chase Them Down" (`nova` 28011, event)** vs. **Core's own "Chase Them Down" (`01052`/reprints,
  already a reprint chain through wave 3's `gmw` and `thor`)** — confirmed directly: `mergeRegistries(WAVE4_ABILITIES,
  NOVA_ABILITIES)` alone (no `sm` involved at all) throws `ability 28011.chase-them-down-response is defined
  twice`, so this is not limited to the `sm`/Ghost-Spider pair — it hits Nova's own pack too.

`wave4/reprints.ts`'s own docblock already documents exactly this class of hazard ("the pool this file actually
loops over … carries cards it shouldn't") and its own fix for it (`PACK_OWN_ABILITIES`, "a pack whose own module
already defines a ref wins outright") — but that guard list only names wave 4's own packs (`nebu`, `warm`,
`vision`, `mts`, `valk`, `hood`); no wave 5 pack (`sm`, `nova`, `ironheart`, `spiderham`, `spdr`) is in it, so the
guard does not apply to any of the newly-exposed collisions.

**Not fixed by this pass** (per rules-qa-engineer's own boundary — verify, don't patch engine/content wiring code):
either bound `wave4/reprints.ts`'s scan back to ≤cycle 3 cards specifically (not the ever-growing
`PLAYABLE_CARDS`/`WAVE4_CARDS` alias), or add every wave 5 pack's own `*_ABILITIES` to its `PACK_OWN_ABILITIES`
guard list. **While this pass was running, another concurrent agent landed an uncommitted edit to
`packages/cards/src/wave5/cards.ts`** (also observed, not touched) that stops `WAVE5_CARDS` from double-appending
cycle 4 cards on top of `PLAYABLE_CARDS` — a related but different bug (duplicate card instances, not duplicate
ability ids) that does **not** fix this one: retested after that edit landed and the same `27013.bait-and-switch-
action is defined twice` error still reproduces. `game-rules-architect` or `card-data-pipeline` should own the
actual fix (it's `packages/cards/src/wave4/reprints.ts`, a cross-pack ability-registry wiring file, not Nova's).

**How this pass verified its own findings despite the blocker:** every claim below about Nova's own scripts was
checked by reading the source against the printed text/RRG/rulings, and the two new tests added this pass (§2) were
additionally confirmed to pass logically by rebuilding `EngineDeps` from `WAVE3_ABILITIES` plus each wave 4 pack's
own module directly (bypassing `wave4/reprints.ts`'s broken merge) — a throwaway, uncommitted diagnostic harness,
deleted before this pass's own commit. **Nova's own 98 pre-existing tests could not be re-run to a green result
this pass** because of the blocker above; they last ran green (7 files, 98 tests passed) at the very start of this
pass, before commit `1367fa03` landed mid-session.

## 1. Card-by-card audit

All 32 Nova cards (28001a/b–28032) read against `packages/content/src/data/nova/cards.ts`'s printed text, the card
scans under `assets/card-art/bundles/cards/`, RRG 1.8 (no errata for this pack, pp. 67–68), and
`marvel-champions-rulings-post-rrg-1-7.md` (grepped for "Nova", "Sam Alexander", "Supernova", "Warbringer",
"Armadillo", "wild resource", "printed resource").

**28001a/b Nova / Sam Alexander (identity), 28002 Ms. Marvel, 28003 Forcefield Projection, 28004 Lightspeed Flight,
28005 Pot Shot, 28006 Unleash Nova Force, 28007 Connection to the Worldmind, 28008 Jesse Alexander, 28009 Supernova
Helmet, 28010 The Locust, 28011 Chase Them Down, 28012 Pitchback, 28013 No Quarter, 28014 One by One, 28015 The
Power of Aggression, 28016 Fluid Motion, 28017 Honed Technique, 28018 Moon Girl, 28019 Everyday Hero, 28020
Champions Mobile Bunker, 28021 Weight of the World, 28022 "Bring the War!", 28023 Warbringer, 28024 War Delivery,
28025 "The War's Been Brought", 28026 Yaw and Roll, 28027 Height Advantage, 28028 Armored Assault, 28029 Armadillo,
28030 Rollin', Rollin', 28031 Tough and Tumble, 28032 Tough It Out: OK.** Every one of the 32 cards' own
`packages/cards/src/wave5/nova/*.ts` docblock already ties its script to the printed text line-by-line, and every
ability id named in the card record's own `abilities` array is exercised by at least one existing test in the
matching `*.test.ts` file (confirmed by reading `identity.test.ts`, `events.test.ts`, `support-upgrades-
allies.test.ts`, `obligation-nemesis.test.ts`, `armadillo.test.ts`, `cross-hero.test.ts` — 98 tests total, all
asserting the exact printed effect, not just that an ability fired: e.g. `28013.no-quarter-action`'s own test
checks the excess-damage mill amount and the Aggression-only filter, not just that damage was dealt).

Two things worth calling out precisely, both already correctly resolved rather than silently assumed by the
original scripting pass (`wave5/nova/*.ts` docblocks), re-verified this pass against the primary source:

- **"Bring the War!" (28022) and "The War's Been Brought" (28025): "a printed [wild] resource" is the card's own
  bottom-left icon, never an ability-generated resource.** Directly the January 11, 2026 (3) ruling
  (`marvel-champions-rulings-post-rrg-1-7.md` line 235–238), named as the primary source in both
  `obligation-nemesis.ts`'s docblock and used correctly: `anyPrintedResource`/`totalPrintedResources`, never
  `paidWith`. Correct.
- **No Quarter (28013): "excess damage dealt to that enemy by this attack"** reads `strike.excessDealt` — damage
  *dealt*, not damage *taken*. This is the exact distinction January 26, 2026 (3) draws (excess damage stays
  defined as damage dealt beyond remaining hit points, independent of Overkill's "taken" wording) — No Quarter's
  own printed text says "dealt", removing any ambiguity Into the Fray's shorter wording could have. Correct.

**One open reading, not a bug, flagged by the original scripting pass and independently re-checked this pass (not
resolved — a `game-rules-architect` call, not this pass's or the original scripting agent's to make):**
`obligation-nemesis.ts`'s own docblock (lines 121–137) asks whether a `resource`-type card's own face icon
(`producesIcons` — Connection to the Worldmind 28007, The Power of Aggression 28015, Everyday Hero 28019) counts as
"printed" for "The War's Been Brought"'s own X. The January 11, 2026 (3) ruling's own example is about ability
*text* mentioning "[wild]" (Sam Alexander's own Action), not a Resource card's own face icon — this pass agrees the
ruling doesn't directly settle the Resource-card case, and agrees with the original scripting pass's own conclusion
not to special-case it against the engine's one shared `printedResources` primitive (used unconditionally by every
other `anyPrintedResource` caller in the pool since wave 1). Restating this as an open rules question rather than
re-deciding it.

## 2. New tests added this pass

Both added to Nova's own existing test files (no new file), both logically verified to pass via a diagnostic
`EngineDeps` built from `WAVE3_ABILITIES` + each wave 4 pack's own module + `NOVA_ABILITIES` (+ `IRONHEART_ABILITIES`
for the second) directly — bypassing the broken `wave4/reprints.ts` merge (§0) — since `WAVE5_DEPS` itself
currently cannot build. **Both must be re-run against real `WAVE5_DEPS` once §0 is fixed**, which this pass could
not do.

1. **`packages/cards/src/wave5/nova/e2e.test.ts`, "Rhino (expert), solo: Nova"** — the wave definition of done's
   own "one expert game… to an outcome, replay deep-equal" requirement (this pack had a 2-player standard game and
   a solo standard game, but no expert game, before this pass). `novaScenario("rhino", { seed: SEED, difficulty:
   "expert" })`, played to a real outcome by the card-name-agnostic greedy driver (`playToOutcome`), replayed and
   asserted `deep-equal` against the live session state — `wave4/hood/e2e.test.ts`'s own `"(expert)"` test is the
   direct precedent for the shape. Confirmed passing (diagnostic harness) before the §0 blocker made re-running it
   against real `WAVE5_DEPS` impossible mid-pass.
2. **`packages/cards/src/wave5/nova/support-upgrades-allies.test.ts`, "her own cost still exhausts her and returns
   the event even while she cannot take damage (Jan 26, 2026 ruling 1)"** — a regression test for the
   January 26, 2026 (1) ruling (`marvel-champions-rulings-post-rrg-1-7.md` line 329–337), whose own named example
   *is* Ms. Marvel (`nova` 28002): "Because Ms. Marvel's ability cost both deals damage **and** exhausts her,
   damage is not the *only* effect on her. She remains a valid target for her cost even when *Go for Champions!*
   prevents her from taking damage." Before this pass, Ms. Marvel had two tests (fires normally; does not fire for
   a non-event play) but none proving this specific, FFG-named interaction. The new test plays "Go for Champions!"
   (`ironheart` 29025, in the same wave 5 pool, `basic` aspect so legally includable in Nova's own deck, its own
   `playRestrictions.requiresIdentityTrait: CHAMPION` satisfied since both Nova and Ms. Marvel carry the CHAMPION
   trait) to grant "each champion character in play cannot take damage until the end of the round," then plays an
   event and accepts Ms. Marvel's own response, and asserts: the ability's own effect still resolves (the event
   returns to hand), the cost's exhaust half still lands (`exhausted: true`), and the cost's damage half is
   prevented to 0 (`damage: 0`) rather than the ability being refused outright. Traced (not just tested) against the
   engine's own cost-legality code while writing this: `packages/engine/src/actions.ts`'s `damageThisCard` cost
   branch never gates initiation on `cannotTakeDamage` (only `AbilityCost.damageCards`/`indirectDamage` do, via
   `canTakeCostDamage`/`indirectDamageCapacity`), and `packages/engine/src/resolve/target-validity.ts`'s
   `abilityLacksValidTarget` only scans `definition.effects`, never `definition.cost` — so the engine already
   implements this ruling correctly and generically, with no Nova-specific special-casing needed. This test is
   proof of that, not a fix for a bug.

## 3. What this pass did not do

- **Could not re-run Nova's own 98 pre-existing tests, or the new two, to a green result against real `WAVE5_DEPS`**
  because of §0. They last ran green (7 files, 98 tests) at the very start of this pass.
- **Did not survey the rest of the newly-exposed `wave4/reprints.ts` false-positive class** beyond the two
  confirmed instances in §0 (Ghost-Spider's Bait and Switch, Nova's own Chase Them Down) — there is likely at least
  one more per wave 5 pack whose own card happens to share name/type/shape with something in Core through cycle 3;
  finding every one is `card-data-pipeline`/`game-rules-architect`-level triage on the actual fix, not this pass's
  scope.
- **Did not re-audit Ghost-Spider, Spider-Man (Miles Morales), Ironheart, Spider-Ham, or SP//dr** — out of this
  pass's stated scope (Nova pack only).

## 4. Rules questions for the user (report per §0, §1)

1. **§0 (blocking): should `game-rules-architect`/`card-data-pipeline` be routed the `wave4/reprints.ts` false-
   positive-alias regression now**, given it currently fails 79 of 305 `@mc/cards` test files (not just Nova's)?
   Recommended default: yes, treat as urgent — it blocks every wave 5 pack's own tests, not only Nova's.
2. **§1 (not blocking): does a Resource-type card's own face icon (`producesIcons`) count as a "printed [wild]
   resource" for "The War's Been Brought"'s (28025) own X-count**, the same way it already does, unconditionally,
   for every other `anyPrintedResource` caller in the pool? Recommended default: leave as-is (current behavior,
   matching every other card's own reading of the same primitive) unless a future ruling specifically narrows
   "printed" to exclude a Resource card's own face.
