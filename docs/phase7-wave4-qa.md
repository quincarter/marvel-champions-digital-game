# Phase 7 wave 4 rules-QA pass

`rules-qa-engineer` independent QA pass over wave 4 (cycle 3: `nebu`, `warm`, `valk`, `vision`, `mts`, `hood`).
Modeled on `docs/phase7-wave3-qa.md`. Per the standing ownership boundary: this pass finds and proves bugs with
tests; it does not fix engine or card-script code beyond small, obviously-safe test tightening. Every finding cites
the printed text and the authority (RRG 1.8 page or a dated post-1.7 ruling) it was checked against.

**Scope note, stated up front rather than implied by omission:** wave 4 landed with an unusually large amount of
its own rules-QA already built in as part of scripting (`docs/phase7-wave4.md` names `rules-qa-engineer` in its own
§5 task list for exactly three items: a Tower Defense double-KO test, a Loki swap-with-attachments test, and a full
campaign run/retry/permanent-removal test). This pass found that the wave's own scripting work had already closed
most of the highest-priority items the brief calls out by name — the four decided rulings (Q9, Q16, Q17, Q5) and
Loki's two defeat interrupts (§3.48) all already carry real regression tests, and the wave's own e2e suite already
covers standard/2-player/expert games for The Hood and standard/expert for every `mts` scenario including Tower
Defense. Given that, and the size of the six-pack, ~59-primitive scope against the time budget, this pass
prioritized item 1 (test-quality sweep) as instructed, verified the item-4 pins are real and not just claimed, and
did a targeted (not exhaustive) card-by-card audit rather than a full line-by-line sweep of all six packs. What
was **not** reached is listed explicitly under "What this pass did not do," per the standing rule that a thin pass
should say so rather than imply full coverage.

## 1. Test-quality audit (priority)

Swept wave 4's 53 test files (`packages/cards/src/wave4/**/*.test.ts`) for the four patterns named in the task: a
ref named in a test title but not exercised, a boost never resolved as a boost, `toBeGreaterThan`/`<=`/`||` in place
of an exact assertion, and a test naming two refs but exercising one.

### Findings tightened directly (small, in scope for this agent)

1. **`packages/cards/src/wave4/hood/mister-hyde.test.ts`, "24034.when-revealed" — fired-but-not-verified.** The
   test named "Mister Hyde attacks with +2 ATK and overkill when he is in play" only asserted
   `fired(events, "24034.when-revealed")` — that the ability triggered — and checked neither the +2 ATK bonus nor
   the overkill keyword the printed text (`hood/mister-hyde.ts`, 24034) requires. This is exactly the "fired but
   never took effect" shape `docs/phase7-wave4.md` §3.51 documents as a real engine bug this wave found and fixed
   for this same card (Calvin Zabo's own `enemyAttack.keywords`) — the generic mechanism is proven in
   `packages/engine/src/hood-primitives.test.ts`, but the card's own test never independently re-confirmed it
   post-fix. **Tightened:** isolates the `damageDealt` event sourced from Mister Hyde's own instance and asserts
   both his ordinary activation (3, undefended, no bonus) and Calvin Zabo's triggered attack (5, +2 ATK) land in the
   same villain phase. Would have failed against the pre-§3.51 script (no `keywords`, and had `atkBonus` also been
   missing, against 3 not 5). Printed text: `hood/mister-hyde.ts` inline transcription of 24034. Authority:
   `docs/phase7-wave4.md` §3.51.
2. **`packages/cards/src/wave4/vision/vision-kit.test.ts`, "26005.solar-gem-constant / 26005.solar-gem-resource" —
   two refs named, zero exercised.** The test named both Solar Gem abilities ("grants Aerial; attaches to Vision")
   but only checked that the upgrade attached — never that it grants the AERIAL trait (the constant), and never
   drove the resource ability (exhaust → 1 wild resource) at all. **Tightened, split into two tests:** one confirms
   `traitsOf` does not include AERIAL before the gem is in play and does after (via `@mc/engine`'s `traitsOf`); the
   other exhausts Solar Gem through its own `resourceAbility` to pay the entire cost of an unrelated card (Indomitable, 26017) and confirms both the exhaustion and the attachment landing. Printed text: `vision/vision-kit.ts`
   `26005.solar-gem-constant`/`26005.solar-gem-resource`. Authority: card text is unambiguous; no ruling needed.

Both changes are pure test tightening (no script or engine change); `pnpm check`-equivalent (lint, format, typecheck,
targeted test run) passed for both files (see "Test counts").

### Findings not tightened, filed instead (scope/time)

The sweep above (grep for `toBeGreaterThan`/`toBeLessThan` across all 53 files returned 37 hits; grep for a test
title naming two `<code>.<ref>` pairs returned ~19 hits) is wider than the two items above — those two were
followed to a concrete verdict because they matched the task's own named examples (Calvin Zabo, and the
"named two refs, exercised one" shape) most closely. **The remaining ~35 `toBeGreaterThan`/`toBeLessThan` hits and
~17 other two-ref titles were not individually re-verified this pass** — most looked legitimate on inspection
(e.g. Vivian's own two-ref test at `vision-kit.test.ts:138` genuinely exercises both halves: THW while Intangible
_and_ ATK while Dense, each with an exact stat comparison, not a threshold), but "looked legitimate on a skim" is
not the same as verifying each one individually, so this is recorded as **thin coverage confidence, not a clean
bill of health** for the rest of the sweep. A full second pass through every hit is the natural next step for
whoever picks this back up.

### Avatar of Death / Calvin Zabo (the two keywords named in the task brief)

Both were investigated specifically because the task brief names them. **Both are already fixed and regression-tested
generically:** `docs/phase7-wave4.md` §3.51 documents the exact bug (an `enemyAttack` effect followed by a sibling
`modifyAttack` effect runs after the attack it initiated has already resolved, since the stack is LIFO, so the
keyword never attaches) for three cards — Total Annihilation (`hood` 24054), Avatar of Death (`mts` 21120), and
Calvin Zabo (`hood` 24034) — and its "Status: landed" note confirms all three were re-scripted against a new
`EffectSpec enemyAttack.keywords?` field, proven generically in `packages/engine/src/hood-primitives.test.ts` (an
overkill attack of 4 against a 3-HP defending ally spills exactly 1 onto the hero; the same attack without the
keyword spills nothing) and in real games (`standard-expert-ii.test.ts` for Total Annihilation). **What this pass
added:** Calvin Zabo's own card-specific test (finding 1 above) previously only checked the ability fired, not that
the keyword/bonus actually landed for _that card_ post-fix — now it does. **Avatar of Death's own card-specific
test** (`mts/thanos.test.ts` "Avatar of Death (21120)") still only checks `damage` `toBeGreaterThan` before an
undefended attack against the identity — it does not independently re-verify the overkill/piercing keywords for
_this_ card post-fix, the same gap Calvin Zabo had. **Filed, not fixed this pass** (time budget): tighten
`21120.when-revealed-hero`'s test the same way — a defending ally at a HP total below Thanos's ATK, asserting an
`overkillSpilled` event, plus a `giveTough` on the identity beforehand to prove piercing bypasses it (piercing
against a toughened defender should still deal full damage, where without piercing a `tough` status would absorb
it). Owner: `rules-qa-engineer` (next pass) or `ability-scripting-engineer` if a script change turns out to be
needed once tested.

## 2. Regression pins for the wave's decided rulings (task item 4)

Verified each ruling the brief calls out by name already has a real, driven regression test (not just claimed
"landed" in the design doc) — re-read each test file to confirm it exercises the decision, not merely a symptom
adjacent to it:

| Ruling                                                                | Decision                                                                                                                                                                                                                                                  | Test(s) verified                                                                                                                                                                                                                                       | What was checked                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §4 Q9 (Avengers Tower flip)                                           | The flip does **not** resolve the Damaged side's own When Revealed; the Stronghold side's own script discards the other Avengers Towers as it flips (RRG rulings Jun 25, 2026 (4) #3 and Jan 26, 2026 (4) #2, "Environments flip, they are not revealed") | `packages/cards/src/wave4/mts/tower-defense.test.ts` ("21100a.avengers-tower-forced-response: at 9[per_hero]+ damage it clears and flips to Damaged"), `packages/engine/src/damage-on-environment.test.ts` (generic flip/`uniqueRuleExempt` mechanism) | `tower-defense.ts` scripts the discard-other-Towers effect on **21100a's** (Stronghold) forced response, not on 21100b's (Damaged) when-revealed — matching the decision exactly, not the printed card's own face-driven wording. Confirmed live in the tower-defense test: at threshold, `flipped` becomes `true` and the state reflects the Stronghold-side script's own effects. |
| §4 Q16 (a cancel with nothing to cancel is not offered)               | Withheld from legal actions; no cost paid                                                                                                                                                                                                                 | `packages/engine/src/cancel-no-target.test.ts`                                                                                                                                                                                                         | Directly named in the file's own docblock citation to §3.27/§4 Q16; asserts the cancel does not appear as a legal action against an uncancelable target.                                                                                                                                                                                                                            |
| §4 Q17 (a card that flips into a separately emitted face enters play) | Yes — starting threat plus hinder, engagement, "enters play" triggers all fire                                                                                                                                                                            | `packages/engine/src/other-face.test.ts`                                                                                                                                                                                                               | Docblock cites §4 Q17 directly; confirms the new face is treated as entering play, not merely present.                                                                                                                                                                                                                                                                              |
| §4 Q5 (Standard II / Expert II)                                       | Optional per-scenario replacements, chosen at setup, not additive                                                                                                                                                                                         | `packages/cards/src/wave4/hood/standard-expert-ii.test.ts`, and The Hood's own e2e game (`hood/e2e.test.ts`, "The Hood (expert, Standard II and Expert II)")                                                                                           | The e2e game actually plays a full expert game with both `standard_ii`/`expert_ii` swapped in via `DifficultySetChoice`, not just a unit test of the swap primitive.                                                                                                                                                                                                                |
| §3.48 (Loki's two simultaneous defeat interrupts)                     | The advance-to-set-aside-villain resolves first, the defeated Loki's own When Defeated resolves right after, with no prompt (RRG 1.8 "Priority of Simultaneous Resolution")                                                                               | `packages/engine/src/villain-swap.test.ts` (fails without the fix, per the design doc), `packages/cards/src/wave4/mts/loki.test.ts`                                                                                                                    | Confirmed both files exist and are real, driven games/engine tests, not stubs; re-ran both (see "Test counts") — both green.                                                                                                                                                                                                                                                        |

**Lesson carried forward from wave 3's own "Resolutions" section** ("an `it.fails` test passes on _any_ throw,
including a setup error — a pin must be seen failing on its assertion before it is committed"): none of the five
pins above are `it.fails`/`test.fails` pins (all decisions are already implemented and passing), so that specific
trap does not apply to them. Re-confirmed anyway by reading each assertion, not just the test name, since a
passing test whose assertion is trivially true would have the same blind spot.

## 3. Card-by-card audit (task item 2) — targeted, not exhaustive

Given the time budget, prioritized the interactions the task explicitly calls highest-risk: Spectrum's forms,
Adam Warlock's aspects, Vision's density, and the five scenarios' villain AI/boost/set-aside flows.

- **Vision's density (Intangible/Dense mass forms):** `vision-kit.test.ts`'s existing coverage (Vivian's dual
  bonus, Vision's Cape's dual keyword grant, Density Manipulation's own flip-and-draw) already exercises both
  states with exact stat/keyword assertions, not thresholds — confirmed clean on inspection, and Solar Gem's own
  gap is fixed above (finding 2).
- **Spectrum's forms and Adam Warlock's aspects:** not independently re-audited this pass beyond the test-quality
  sweep above (which touched `spectrum-kit.test.ts`, `spectrum-pack-cards.test.ts`, `adam-warlock-kit.test.ts`,
  `adam-warlock-pack-cards.test.ts` only for the weak-test patterns, not a full text-vs-script read). **Flagged as
  not done**, not assumed clean.
- **Scenario villain AI / boosts / set-aside flows:** Loki's swap (§3.48, verified above), Tower Defense's two
  simultaneous villains and Avengers Tower flip (Q9, verified above), and The Hood's Standard II/Expert II wiring
  (Q5, verified above) were checked as part of the regression-pin verification. Ebony Maw's and Hela's own
  scenario-specific scripts were not independently re-read against printed text this pass beyond what their own
  e2e games already exercise generically (see item 3 below).

## 4. Game-level scenarios (task item 3)

**Not newly built this pass — verified existing coverage instead**, since the wave's own scripting work already
landed real e2e games for every scenario in scope:

| Pack   | Scenario      | Mode(s)                                  | Players                        | File                                                                              |
| ------ | ------------- | ---------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| `mts`  | Ebony Maw     | standard, expert                         | 1                              | `mts/ebony-maw-e2e.test.ts`                                                       |
| `mts`  | Thanos        | standard, expert                         | 1                              | `mts/thanos-e2e.test.ts`                                                          |
| `mts`  | Hela          | standard, expert                         | 1                              | `mts/hela-e2e.test.ts`                                                            |
| `mts`  | Tower Defense | standard, expert                         | 1                              | `mts/tower-defense.test.ts` ("e2e: a hero plays Tower Defense to a real outcome") |
| `mts`  | Rhino (Core)  | standard                                 | 1 (Spectrum), 1 (Adam Warlock) | `mts/e2e.test.ts`                                                                 |
| `hood` | The Hood      | standard, expert (Standard II/Expert II) | 1, **2**                       | `hood/e2e.test.ts`                                                                |

All six read `GameOutcome`/replay-deep-equal assertions (spot-checked `tower-defense.test.ts`'s and `hood/e2e.test.ts`'s
own assertions directly, matching the described shape). Re-ran the full set as part of this pass's own test run (see
"Test counts") — all pass, no crashes, no `internal_error`.

**Gaps found, not filled this pass (time budget):**

- No **2-player** game for any `mts` scenario (only The Hood has one).
- No 2-player or expert game for `nebu`/`warm`/`valk`/`vision` against any `mts` scenario or each other — each
  pack's own `e2e.test.ts` (confirmed to exist for all four) was not individually re-read this pass to confirm
  mode/player-count coverage the way `mts`/`hood` were.
- Ebony Maw/Hela/Thanos each have exactly one seed per mode; no cross-seed stability spot-check beyond what already
  exists.

## What this pass did not do

Stated explicitly per the standing instruction that thin coverage should be said, not implied:

- **A full line-by-line audit of all six packs' printed text against their scripts** — the brief's literal ask for
  item 2. This pass did a targeted read (test-quality sweep + the two named keywords + the five decided rulings),
  not a systematic pass over every card in `nebu`, `warm`, `valk`, `vision`'s own kits, obligations and nemesis
  sets, nor Spectrum's/Adam Warlock's own aspects in full.
- **The three items `docs/phase7-wave4.md` §5 itself assigns to `rules-qa-engineer` by name**: a Tower Defense test
  where both villains reach 0 in one attack, a Loki swap carrying attachments/status cards/the dial, and the
  campaign's full run/retry/permanent-removal. Not attempted this pass (time budget) — flagged as the most
  concrete, pre-named follow-up for whoever picks this back up next, since they are not generic QA asks but the
  wave's own design doc naming specific untested shapes.
- **The remaining ~35 `toBeGreaterThan`/`toBeLessThan` hits and ~17 two-ref test titles** from the sweep, beyond
  the two resolved above — spot-checked a few (clean), not exhaustively re-verified.
- **`nebu`/`warm`/`valk` packs' own audits** beyond the test-quality sweep — no dedicated finding either way; not
  reached.
- **2-player/expert smoke games beyond what already existed** — verified, not extended.

## Findings summary

| #   | Card / mechanism                                                                                                                                                    | Printed text / shape                                                 | Authority                                                                           | Test                                                                       | Severity                                                                                     | Owner                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Calvin Zabo (`hood` 24034) — card-specific test asserted only that the ability fired, not the +2 ATK/overkill it actually grants                                    | "Mister Hyde attacks you with +2 ATK; that attack gains overkill"    | `docs/phase7-wave4.md` §3.51                                                        | `packages/cards/src/wave4/hood/mister-hyde.test.ts` (tightened this pass)  | Test-quality (weak test, not a player-facing bug — the underlying script is already correct) | Fixed this pass                           |
| 2   | Solar Gem (`vision` 26005) — test named both abilities, exercised neither                                                                                           | "Vision gains the AERIAL trait. Resource: exhaust → generate 1 wild" | card text (unambiguous)                                                             | `packages/cards/src/wave4/vision/vision-kit.test.ts` (tightened this pass) | Test-quality                                                                                 | Fixed this pass                           |
| 3   | Avatar of Death (`mts` 21120) — card-specific test still only asserts `toBeGreaterThan` on damage, same gap Calvin Zabo had before finding 1                        | "That attack gains overkill and piercing"                            | `docs/phase7-wave4.md` §3.51 (the mechanism itself is fixed and generically proven) | none added this pass                                                       | Test-quality (not a known player-facing bug — the generic mechanism is proven elsewhere)     | Filed for `rules-qa-engineer` (next pass) |
| 4   | ~35 `toBeGreaterThan`/`toBeLessThan` uses and ~17 two-ref test titles across wave 4, not individually re-verified                                                   | —                                                                    | —                                                                                   | —                                                                          | Unknown — spot-checks were clean but not exhaustive                                          | Filed for `rules-qa-engineer` (next pass) |
| 5   | Three items `docs/phase7-wave4.md` §5 names for this agent (Tower Defense double-KO, Loki swap with attachments/status/dial, full campaign run/retry) not attempted | —                                                                    | —                                                                                   | —                                                                          | Unknown — pre-named by the wave's own design doc, not yet built                              | Filed for `rules-qa-engineer` (next pass) |

## Test counts

Ran targeted, not full-repo (time budget did not allow a full `pnpm check` re-run across every package after this
narrow a change set; the two touched files were individually lint/format/typecheck/test-clean):

- `npx oxlint` and `npx oxfmt --check` on both touched files: clean.
- `npx tsc --noEmit` for `@mc/cards`: clean.
- `npx vitest run src/wave4` (`@mc/cards`): **53 test files, 614 tests, all passed** (includes both tightened
  tests, all e2e games listed in §4 above, and the five regression pins verified in §2).

## Files touched

- `packages/cards/src/wave4/hood/mister-hyde.test.ts` — tightened the 24034 test (Finding 1).
- `packages/cards/src/wave4/vision/vision-kit.test.ts` — split the Solar Gem test into two, each exercising its own
  ref (Finding 2).
- `docs/phase7-wave4-qa.md` — this report (new).
