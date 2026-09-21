# What scripting a card actually entails

Written 2026-09-20, after wave 2 (cycle 1) finished scripting, to answer a fair question: _the card text is
now available as clean Markdown — why didn't that make scripting go faster?_

Short answer: **reading the printed text was never the slow part.** It is maybe 5% of the work. This document
says where the other 95% goes, so the next round of tooling gets aimed at something that matters.

---

## 1. The unit of work is an ability ref, not a card

A card in `@mc/content` carries zero or more **ability refs** — stable string ids like `15023.obligation` or
`14009.friction-resistance-response`. `@mc/cards` maps each ref to an `AbilityDefinition`: plain data the engine
interprets. The engine never names a card.

```
printed text  →  ability ref (content)  →  AbilityDefinition (cards)  →  engine interprets
```

So "scripting Scarlet Witch" means resolving ~34 refs, not writing one file. Current pool-wide state
(`pnpm refs`):

|                      |       |
| -------------------- | ----- |
| Packs with card data | 48    |
| Ability refs total   | 2,873 |
| Refs resolving today | ~39%  |
| Packs fully scripted | 12    |
| Packs not started    | 33    |

Wave 2 alone was **436 refs**.

## 2. The six steps for one ref

1. **Read the printed text.** Source of truth is `@mc/content`; `docs/cards/by_pack/*.md` is a fast
   transcription for reading, never an authority. _Fast — minutes at most._
2. **Decide what the text means in rules terms.** Often the hard part. "Cannot ready until your next turn ends"
   — does "next turn" mean the current one if it's your turn? The RRG doesn't say. This step ends in an RRG
   citation, an FFG ruling, or a documented design choice.
3. **Find the primitives that express it.** 266 DSL builders over the engine's `EffectSpec` / `ValueSpec` /
   `TargetQuery` / `RuleSpec` vocabulary. Knowing that "up to X characters in play" is `chooseTarget` with
   `count` + `optional` rather than `chooseCards.max` is the skill, and it isn't in the card text.
4. **If no primitive fits, stop.** Record the gap, skip the ref, and hand it to `game-rules-architect`. Do not
   approximate — an approximated card is a rules bug that ships.
5. **Write a behavioral test that drives real commands.** Not `toBeDefined()`. Set up a real game, reach the
   state where the ability can fire, fire it, assert on resulting game state. **This is the expensive step.**
6. **Recompute `KNOWN_SKIPPED`** so the coverage test still pins reality. Now `pnpm refs`.

## 3. Where the time actually goes

### Step 5 dominates, and not for the reason you'd guess

Line counts put ability modules and their tests at roughly 1:1. That undersells it badly — the test lines are
far more expensive per line, because a test has to _navigate a real game_ to the point where the card can act.

To test one obligation you may need: a two-player game, a specific scenario, the right hero, the encounter deck
stacked so your card is revealed rather than something else, the villain phase advanced without the game
ending, and a deterministic assertion point before the scenario resolves itself.

Concrete failures from this cycle:

- **The `stackSetAside` trap.** Staging a card on top of the encounter deck doesn't reveal it — the villain
  phase runs `enemyActivations` before `revealEncounterCards`, and a villain's boost draw is unconditional, so
  the villain eats your staged card as a boost. Two Sniper Shot tests were green for months while **never
  revealing the card under test**; their loose `toBeGreaterThanOrEqual` assertions were satisfied by Rhino's
  own independent activation. Fixed with `stackSetAsideBehindBoost` — a filler card to absorb the boost draw.
- **The two-player Avalanche test that was attempted and dropped.** With two enemies active, the scenario
  raced to a loss before a deterministic assertion point could be reached.
- **The last session's final hours** went into whether a `cannotAttack` rule on one player's obligation also
  blocks the _other_ player's attacks. That is a rules-scoping question answered by building a two-player game
  and looking — no amount of card text helps.

### Step 2 and step 4 are research, not typing

Wave 2 required **25 numbered engine-primitive sections** in `docs/phase7-wave2.md`. Each is a rules question
first and code second: what does the RRG say, is there a later FFG ruling, and if both are silent, which
reading terminates and doesn't depend on evaluation order?

### The bookkeeping decays silently

Two measured examples:

- **`KNOWN_SKIPPED` drifted.** Of 15 refs recorded as blocked on a missing primitive, **four were never
  blocked** — the gap had since landed, or the original note named the wrong primitive. Work was being deferred
  against stale notes.
- **`abilityRefIds` had ten copies with six different implementations.** Some handled only `hero_identity`;
  others missed `additionalHeroForms` or `flipSide`. Those copies _under-count_ refs, so an unscripted
  flip-side ability would pass its own coverage assertion. Consolidated 2026-09-20 into
  `packages/cards/src/ability-refs.ts`; no test changed result, so nothing was being hidden that day — but the
  hazard was real and is now structurally impossible.

## 4. So what did the card-text Markdown actually buy?

It genuinely helps step 1, and it helps a human read a pack quickly. It does not touch steps 2–6, which is
where the hours are. It is a convenience, correctly labelled as not authoritative.

**The corollary for tooling: aim at test scaffolding and at bookkeeping, not at card text.**

## 5. Tooling that exists

### `pnpm refs`

Which ability refs resolve, per pack. This replaces a throwaway test that `coverage.test.ts` explicitly
instructed each session to re-write, and which had already caused one drift incident.

```bash
pnpm refs                          # every pack, summary table
MC_REFS_PACKS=scw pnpm refs        # one pack + a paste-ready KNOWN_SKIPPED array
MC_REFS_PACKS="scw qsv" pnpm refs  # several
```

Lives in `packages/cards/tools/`, outside the `src/**/*.test.ts` glob, under its own vitest config — so a
report can never fail the suite, and `coverage.test.ts` stays the only thing asserting what _should_ be
unresolved.

### `packages/cards/src/ability-refs.ts`

One implementation of "every ability ref id a card carries", imported by all ten coverage tests and by
`pnpm refs`.

### `packages/cards/src/testing/staging.ts`

Shared scenario-reach helpers (§6 #1, built 2026-09-20): `withDamage`, `withForm`, `withActive`, `moveToDiscard`,
`stackSetAside`, `stackSetAsideBehindBoost`, `stageNemesisCardForReveal` are deps-agnostic pure state surgery,
importable directly by any pack test. `playFromHand`, `revealFromEncounterDeck`, `driveEvents`, `defeatWithAttack`
take an explicit leading `deps: EngineDeps` (the same convention `../testing/harness.ts`'s `runWith` uses);
`../wave1/testing.ts` and `../wave2/testing.ts` re-export `WAVE1_DEPS`/`WAVE2_DEPS`-bound wrappers of those under
the same names, so a pack's tests read exactly as they did before this file existed. Collapsed what were 7 copies
of `playFromHand`, 6 of `withDamage`, 3 each of `stageNemesisCardForReveal`/`revealFromEncounterDeck`/`withForm`/
`moveToDiscard`/`driveEvents`, and 2–3 each of `withActive`/`defeatWithAttack` (all previously byte-identical or
differing only in a parameter default) onto one implementation apiece. `stackSetAsideBehindBoost`'s docblock
carries the single most expensive lesson in the file (below, and §7): bare `stackSetAside` silently loses the
reveal to the villain's own unconditional boost draw.

### `packages/cards/src/testing/trace.ts`

`traceAbilities(deps)` wraps `EngineDeps.abilities` in a `Proxy` and returns `{ deps, trace }`: pass `deps`
anywhere a test would have passed the real one, then `expectResolved(trace, abilityId)` /
`expectNotResolved(trace, abilityId)` assert whether the engine actually handed that ability's `.effects` to the
effect runner — not merely that it was looked up while enumerating legal actions (`trace.considered()`), and not
that the resulting state merely looks consistent with it having fired. Built to answer §6 #2 and retro-fitted onto
`wave2/trors/hawkeye.test.ts`'s two Sniper Shot tests, whose `toBeGreaterThanOrEqual` assertions were tightened to
exact values in the process: both totals turn out to be pinned-seed-deterministic composites (the villain phase's
own base threat placement / Rhino's own attack-or-scheme numbers, plus Sniper Shot's own printed effect), not
floors.

### `pnpm card` — one card, everything needed to script it

```bash
MC_CARD=15023 pnpm card
MC_CARD="11020 11049" pnpm card
```

Printed text, type, pack, traits, keywords, cost, `boostIcons`, `starIcon`, every ability ref with whether it
resolves and which module defines it, and the pack's transcription path. Replaces the five-or-so file reads a
scripter otherwise does per card, which cost tokens and are easy to get subtly wrong.

Two things it surfaces that are cheap to miss by eye and expensive to miss in a script:

- **Errata.** When `text.current` differs from `text.printed` it prints a loud `!! ERRATA — script THIS`. 51
  cards in the pool carry errata; Marked for Death (04028) is one, and its errata'd wording ("tucks her faceup
  beneath" rather than "places her faceup beneath") is exactly the kind of difference a scripter reading the
  printed text alone would get wrong.
- **`starIcon`,** flagged with the reminder that it is not `boostIcons`.

### `pnpm dsl` — what can the DSL express, and what is it called

```bash
pnpm dsl                        # all 266 builders, grouped by module
MC_DSL=trait pnpm dsl           # name, signature or doc mentions "trait"
MC_DSL="ready exhaust" pnpm dsl
```

Step 3 of §2 is "find the primitive that expresses this sentence", and by hand that is grep-the-engine-and-hope:
expensive in tokens and non-deterministic, because what you find depends on which word you happened to guess.
Searching names _and_ doc comments turns it into a lookup. Generated from source on every run, so unlike a
checked-in index it cannot go stale.

## 6. Tooling that would plausibly pay for itself

Ranked by measured pain, not by how nice they'd be:

1. ~~**Scenario-reach helpers for tests.**~~ Built 2026-09-20 — see §5's `testing/staging.ts`.
2. ~~**A vacuous-assertion check.**~~ Built 2026-09-20 — see §5's `testing/trace.ts`.
3. ~~**A DSL index.**~~ Built 2026-09-20 — see §5's `pnpm dsl`.
4. ~~**A card brief command.**~~ Built 2026-09-20 — see §5's `pnpm card`.
5. **A primitive-gap ledger with staleness checking** — `KNOWN_SKIPPED` entries carry the doc section claiming
   the gap; a check that re-reads those sections and flags ones now marked landed would have caught all four
   stale skips automatically.

6. **A scenario-reach cookbook** — the helpers in `testing/staging.ts` solve the mechanics, but _which_ setup
   reaches a given situation is still per-card reasoning. A short table ("to test a nemesis reveal, use X; to
   reach the villain phase with one enemy, use Y") would cut the remaining guesswork.

Explicitly _not_ worth building: more card-text extraction. That problem is solved.

### A note on token cost and determinism

Every tool above replaces something an agent otherwise does by reading files and guessing. That matters twice
over: fewer tokens per card, and — more importantly — the _same_ answer every time. `pnpm refs`, `pnpm card` and
`pnpm dsl` are all generated from the current source, so two sessions asking the same question get the same
answer, which is the property that stops `KNOWN_SKIPPED`-style drift from recurring.

## 7. Standing traps

- **Bare `stackSetAside` does not reveal the card.** Use `stackSetAsideBehindBoost` (`testing/staging.ts`, §5).
- **`starIcons` and `boostIcons` are different counts.** Of 159 starred cards only 43 also print pips, so a
  typo between them passes on any pile where they happen to agree. Test on a pile where they differ.
- **Loose assertions hide non-firing abilities.** Prefer an exact expected value over `toBeGreaterThanOrEqual`.
- **A recorded primitive gap may have landed since.** Re-verify against engine source before working around it
  (`docs/phase7-wave2-scripting.md` §4.1).
- **Never `git add -A`** in the shared working tree — it sweeps up whatever else is in flight.
