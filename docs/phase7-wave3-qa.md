# Phase 7 wave 3 rules-QA pass

`rules-qa-engineer` independent QA pass over wave 3 (cycle 2: `gmw`, `stld`, `gam`, `drax`, `vnm`, `ron`). Modeled
on `docs/phase7-wave2-qa.md`. Per the standing ownership boundary: this pass finds and proves bugs with tests; it
does not fix engine or card-script code. Every finding cites the printed text and the authority (RRG 1.8 page or a
dated post-1.7 ruling) it was checked against.

## Coverage

### Smoke games (task item 1)

Before this pass, every wave 3 scenario's own `e2e.test.ts`/`*-e2e.test.ts` was Groot (Protection), solo, standard
only — Rocket Raccoon had no game at all, and Escape the Museum and Nebula had none either. This pass adds
`packages/cards/src/wave3/gmw/qa.test.ts` (10 new games) and `packages/engine/src/wave3-q1-…`/`…-q4-…`/`…-q17-…`
(synthetic engine-level pins, not smoke games — see "Open questions" below).

| Pack          | Hero(es)               | Scenario(s)                                                                    | Mode       | Players | Outcome reached? | File                                                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------------ | ---------- | ------- | ---------------- | ----------------------------------------------------------------- |
| `gmw`         | Groot                  | Rhino (Core)                                                                   | standard   | 1       | yes              | `gmw/e2e.test.ts` (pre-existing)                                  |
| `gmw`         | Groot                  | Brotherhood of Badoon                                                          | standard   | 1       | yes              | `gmw/brotherhood-of-badoon-e2e.test.ts` (existing)                |
| `gmw`         | Groot                  | Infiltrate the Museum                                                          | standard   | 1       | yes              | `gmw/infiltrate-the-museum-e2e.test.ts` (existing)                |
| `gmw`         | Groot                  | Ronan the Accuser                                                              | standard   | 1       | yes              | `gmw/ronan-e2e.test.ts` (existing)                                |
| `gmw`         | Rocket Raccoon         | Brotherhood of Badoon                                                          | standard   | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Groot + Rocket Raccoon | Brotherhood of Badoon (Team-Up: Flora and Fauna)                               | standard   | **2**   | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Groot                  | Brotherhood of Badoon                                                          | **expert** | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Rocket Raccoon         | Infiltrate the Museum                                                          | **expert** | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Groot                  | Escape the Museum (no game existed before this pass)                           | standard   | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Rocket Raccoon         | Escape the Museum — the ∞-hit-point Collector B2 face                          | **expert** | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Groot                  | Nebula (no game existed before this pass)                                      | standard   | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Rocket Raccoon         | Nebula                                                                         | **expert** | 1       | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw`         | Groot + Rocket Raccoon | Ronan the Accuser                                                              | standard   | **2**   | yes              | `gmw/qa.test.ts` (new)                                            |
| `gmw` + `ron` | Groot                  | Brotherhood of Badoon, with `ron`'s Kree Fanatic swapped in for Band of Badoon | standard   | 1       | yes              | `gmw/qa.test.ts` (new) — the `ron` modular inside a real scenario |
| `stld`        | Star-Lord (Leadership) | Rhino (Core)                                                                   | standard   | 1       | yes              | `stld/e2e.test.ts` (pre-existing)                                 |
| `gam`         | Gamora                 | Rhino (Core)                                                                   | standard   | 1       | yes              | `gam/e2e.test.ts` (pre-existing)                                  |
| `drax`        | Drax                   | Rhino (Core)                                                                   | standard   | 1       | yes              | `drax/e2e.test.ts` (pre-existing)                                 |
| `vnm`         | Venom                  | Rhino (Core)                                                                   | standard   | 1       | yes              | `vnm/e2e.test.ts` (pre-existing)                                  |

Every game above asserts a real `GameOutcome` (win or loss, none of the driven games happened to win — the greedy
driver is not a strong player, the same as wave 2's own pass), no stuck `PendingChoice`, and a deep-equal replay of
the session log. None crashed, none produced an `internal_error`.

**Not reached this pass**, flagged rather than assumed clean: `stld`/`gam`/`drax`/`vnm` each still have only the
one pre-existing Rhino-solo game (no game against a `gmw` scenario, no 2-player game, no expert game) — `wave3Scenario`
only carries `GMW_SCENARIOS`; there is no `stld`/`gam`/`drax`/`vnm`-native scenario to seat them against yet (that's
the box's own campaign scenario, not built this wave per docs/phase7-wave3.md's own scope). A multi-player game
mixing `gmw` heroes with `stld`/`gam`/`drax`/`vnm` heroes against a `gmw` villain was not attempted (time budget);
it would be a reasonable follow-up smoke test (nothing in the four hero packs' own kits should be `gmw`-specific,
but that is an assumption, not something this pass checked).

### Card text vs. script audits (task item 2)

**Tooling gap found first, before any audit could lean on it:** `pnpm card`, `pnpm dsl` and `pnpm refs`
(`packages/cards/tools/*.test.ts`) build their lookup registry from `CORE_ABILITIES`/`WAVE1_ABILITIES`/
`WAVE2_ABILITIES` only — none of them imports `WAVE3_ABILITIES`. Every wave 3 ability, including ones fully
scripted and tested, reports `✗ … ← not scripted` from `pnpm card`. Confirmed directly: `MC_CARD=16110 pnpm card`
shows `16110.fanaticism-forced-interrupt` as unscripted, though `gmw/ronan.ts:185` scripts it and
`gmw/ronan.test.ts` exercises it. This is a real gap in the "cheap lookups" the brief and
`docs/phase7-wave3-scripting.md` §1 both point every wave 3 agent at — it makes `pnpm refs`'s own `KNOWN_SKIPPED`
regeneration instructions (`docs/phase7-wave3-scripting.md` §1: "Regenerate `KNOWN_SKIPPED` with `MC_REFS_PACKS=gmw
pnpm refs`") silently useless for telling scripted from unscripted wave 3 refs, and it undercuts this very audit
step (a card-by-card `pnpm card` sweep across six packs was the planned approach; abandoned in favor of manual
`docs/cards/by_pack/*.md` reads once this was found). **Reported, not fixed** (out of this agent's remit — a
`packages/cards/tools/*.ts` change belongs to whichever agent owns the shared dev tooling, most likely
`ability-scripting-engineer` alongside the next pack they touch). Severity: cosmetic/tooling — no player-facing
behavior is wrong, but it is a real drift between the tooling's claim and reality, and it slowed every subsequent
step of this pass.

Given that, the audit fell back to reading `docs/cards/by_pack/{gmw,stld,gam,drax,vnm,ron}.md` (the printed-text
transcription) directly against each pack's own `.ts` source. Spot-checked, all clean (target, "you" vs. "each
player", may/must, timing word, cost vs. effect, keyword):

- **Fanaticism (16110)**, **Single-Minded Fury (16114)**, **Kree Physiology (16115)**, **"You Stand Accused!"
  (16116)** — `gmw/ronan.ts`. All four match the transcribed text exactly, including the Alter-Ego/Hero split on
  16116 and the "already attached" ordering on 16113/16115's own When Revealed bodies.
- **Escape the Museum's "if this stage is completed, the players lose the game"** (16082b/16083b, 1B/2B) —
  `docs/phase7-wave3-scripting.md` §7's own table flagged this as a **known unfixed correctness gap** as of an
  earlier checkpoint ("a real villain phase that reaches stage 1/2's ordinary target threat currently advances
  instead of losing"). Re-checked directly against `packages/content/src/data/gmw/cards.ts`: both stages now carry
  `completionLoses: true` (§3.37, `MainSchemeStage.completionLoses`), and `packages/engine/src/resolve/defeat.ts:114`
  reads it (`if (next === null || mainSchemeStageOf(...).completionLoses === true)`). **This gap is closed** — the
  scripting doc's own table entry describing it as still-open is now stale and should be updated by whoever next
  touches that file.
- **Regroup (`drax` 19032)** and **Collector's discard redirect** — read individually against their printed text,
  both clean (see the Q17 pin below for the _combined_ case, which is genuinely undecided).

**Not exhaustively audited** (time budget, see "what could not be checked"): a full line-by-line sweep of every
`gmw` card (the brief's literal ask — "Audit every hero kit, obligation and nemesis set, and every villain, main
scheme and side scheme in `gmw`") was not completed; this pass spot-checked the highest-risk-looking cards (new
primitives, multi-clause text boxes, "already attached/already has" ordering) rather than every card in the pack.

### Cross-cutting engine changes (task item 3)

| Change (commit)                                               | Regression test                                                                                                                                                                                                                                                                                                                                                   | Earlier-wave card exercised                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Turn-start interrupt window / `uncontrolledYouOf` (`06de1d6`) | Not additionally pinned this pass — the commit's own scripted target (The Poison, `gmw` 16125) already has a test in `gmw/galactic-artifacts.test.ts`; no earlier-wave card was found using a turn-start interrupt to double-check against (flagged under "not checked").                                                                                         | —                                                                                                                                         |
| Immediate player-deck reset (`8129545`)                       | `packages/engine/src/player-deck-reset.test.ts` (pre-existing, 7 tests) already exercises this generically, plus the three e2e seeds the commit itself updated (`gob`, `twc`). Re-run clean this pass.                                                                                                                                                            | `gob` Mutagen Formula/Risky Business, `twc` Breakout (wave 1)                                                                             |
| Identity defeats carrying their source (`c113885`)            | Not independently re-pinned — `packages/engine/src/identity-defeat-from-attack.test.ts` (pre-existing) covers it; re-run clean.                                                                                                                                                                                                                                   | (pre-existing test coverage, not re-verified against a _new_ earlier-wave card this pass)                                                 |
| Defeat-destination redirects (`0d46e78`)                      | **New**: `packages/engine/src/wave3-q17-regroup-collector.test.ts` — combines Regroup (`drax`) with a Collector-shaped `discardFromPlayDestination` constant on the _same_ defeated ally, which `defeat-destination.test.ts` and `scenario-area.test.ts` each test in isolation but never together.                                                               | synthetic (both cards are wave 3's own; no earlier-wave "Time Portal"-style redirect was combined this way — flagged under "not checked") |
| Consequential damage carrying attack results (`04f0317`)      | Not re-pinned this pass — `packages/engine/src/consequential-cancel.test.ts` and Martyr's own test (`drax`) already cover the mechanism; no additional earlier-wave interaction found.                                                                                                                                                                            | —                                                                                                                                         |
| Either/or, same-type and deck-discard costs                   | Not re-pinned — each has its own landed test file (`variable-counter-cost.test.ts`, `deck-discard-cost.test.ts`, `wave3-primitives-2.test.ts`'s same-type coverage); not independently re-combined with an earlier-wave card this pass.                                                                                                                           | —                                                                                                                                         |
| `completionLoses` (`14f7ef6`, `5185968`)                      | Confirmed landed and wired for Escape the Museum's 1B/2B (see the audit above) and for three other `completionLoses: true` stages found by `grep` in `packages/content/src/data/gmw/cards.ts` (2013, 2042, 2070, 2276, 2641 — six total occurrences, not just the two the scripting doc names). Not independently re-driven end to end for all six (time budget). | —                                                                                                                                         |

**Most valuable new cross-cutting finding this pass, not on the original list:** the `trors` (wave 2) "after
resolving step one of the villain phase" bug that `docs/phase7-wave3.md` §3.2's own docblock flags as found "on the
way" while building `villainStepResolved` — **confirmed still live, still unfixed**, and pinned:

- **`packages/cards/src/wave2/trors/qa.test.ts`**, `test.fails(...)`: None Shall Pass 1B (`04079b`), Hunting Down
  Heroes (`04096b`), The Mad Doctor 2B (`04113b`) are all still wired to `on.threatPlaced(query("mainScheme"))`
  (fires on _every_ threat placement on the main scheme, any source, any step) instead of
  `on.villainStepResolved("placeThreat")` (the primitive `docs/phase7-wave3.md` §3.2 built and landed specifically
  for this wording, commit `6ebb61f`). Printed text: Red Skull rulebook (spoiler edition) p. 10, Hunting Down
  Heroes. Authority: RRG 1.8 "Round Overview" p. 4 (step one is a single event per villain phase), "Forced" p. 20.
  Hunting Down Heroes is the worst of the three — its own "Place 1 threat here" branch places threat on itself,
  which re-fires its own Forced Response with the same choice, for as long as that branch keeps getting chosen.
  **Severity: breaks a game** (an unbounded or near-unbounded retrigger loop, in ordinary play, the same shape as
  wave 2's own already-fixed Finding 1 for Hydra Jet-Trooper). Owner: `ability-scripting-engineer`.
  - **Caveat on this test's own construction**, documented in its own docblock: it pins the ability definitions'
    trigger shape (`def.trigger.on.on === "villainStepResolved"`), not a live-driven retrigger. A live repro was
    attempted first (driving Taskmaster's own Hunting Down Heroes scenario with the `firstLegal` picker, which
    always takes a mandatory choice's first option — exactly the "place 1 threat" branch) but the exact interaction
    between the driver, `firstLegal`, and the forced-response chooseOne's own resolution turned out not to pause on
    a `pendingChoice` the way expected in the time available to untangle it; the structural check is unambiguous
    and cheap, and is exactly what needs to change, so it was used instead. Flagged as a live-repro gap under "what
    could not be checked."

## Open questions (task item 4): §4 Q1, Q4, Q12–Q18

Each pinned with a test named for the question, reusing wave 3's own stub scaffolding (`gameAtFirstTurn`,
`stubAbility`, `stubVillain`, etc. — `packages/engine/src/testing/wave3.ts`, `testing/fixtures.ts`) so a later
ruling shows up as one test change.

| Q   | Question                                                                                           | Test                                                                                                                                                                                                                                                                                                                                                                                                                                     | What the engine does today                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Most likely to be wrong?                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | A deferred villain defeat and a simultaneous last-player elimination                               | `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts` (new)                                                                                                                                                                                                                                                                                                                                                                         | **Contradicts docs/phase7-wave3.md §3.1's own docblock.** For a single `dealDamage` effect hitting both the villain (1 HP, its defeat heard/deferred) and the sole player's identity (lethal) at once, `each`'s target loop processes the villain first and ends the game as a **win** before the identity is ever damaged — not the "elimination happens first, loss" the docblock describes. See "cross-cutting" note below — this is a doc/implementation mismatch, not just an open rules question. | **Yes — flag this one specifically.** Either the docblock's own claim was never re-verified after it was written, or a later engine change (plausibly `8129545`/`06de1d6`'s neighbors, all landing the same week) altered target-iteration order without anyone re-checking this specific claim. Either way, one of the two (the doc or the code) is wrong today, independent of what a future FFG ruling says.                                         |
| Q4  | A defeated minion leaves play before its own When Defeated resolves                                | `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts` (new)                                                                                                                                                                                                                                                                                                                                                                    | Confirmed: `cardMoved` (to the encounter discard pile) fires before `abilityResolved` for the minion's own When Defeated — the opposite order from a defeated side scheme (`victory-keyword.test.ts`'s own "goes there after its When Defeated resolves"). Matches the doc's own description.                                                                                                                                                                                                           | No — this one matches the code, only whether the Jan 11, 2026 ruling (which is explicitly about a side scheme) should be read to also cover minions is genuinely open, and RRG text doesn't say either way.                                                                                                                                                                                                                                             |
| Q12 | Is Moondragon's "that minion attacks another enemy" an activation?                                 | `packages/cards/src/wave3/drax/qa.test.ts`, `test.skip(...)`                                                                                                                                                                                                                                                                                                                                                                             | Nothing — no primitive exists (`19013.moondragon-action` stays `KNOWN_SKIPPED`; confirmed via `pnpm dsl`/`pnpm refs` that no `enemyAttacksEnemy`-shaped `EffectSpec` exists).                                                                                                                                                                                                                                                                                                                           | N/A — there's no implementation to be wrong yet.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Q13 | A Team-Up name written "Hero/Alter-ego" (Heart of the Panther)                                     | Already pinned: `packages/engine/src/team-up-names.test.ts`, describe block "§3.34 'Hero/Alter-ego' names one identity by both sides"                                                                                                                                                                                                                                                                                                    | Matches one identity by both faces' names, whichever side is up.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Low — a strict RRG p. 23 reading would instead require the hero side specifically to be up; the doc itself flags this as a reading, but the practical difference is narrow (only matters mid-alter-ego-form).                                                                                                                                                                                                                                           |
| Q14 | Is a card revealed by `EffectSpec revealEncounterCard` still on top of the deck while it resolves? | Already pinned, deliberately undecided: `packages/engine/src/player-superlative.test.ts`'s own `start()` docblock ("whether or not the revealed Drang has left the deck by then") — written to pass either way.                                                                                                                                                                                                                          | Still on top (confirmed by reading `apply-effect.ts`: `drawEncounterCard` returns the card without removing it; a revealed treachery only leaves the deck in the reveal frame's `finish` stage).                                                                                                                                                                                                                                                                                                        | Medium — every _other_ reveal path (villain phase deal, surge) deals the card out of the deck first; this one path being the odd one out looks more like an oversight than an intentional reading, but "found, not fixed" is honest until someone checks the other three usages (`core/modular/standard.ts`, `core/aspects/protection.ts`, `wave1/bkw/pack-cards.ts`) for whether they rely on the current behavior.                                    |
| Q16 | Can an effect's "up to N" (Agile Flight) choose none?                                              | Already pinned: `packages/engine/src/divide-up-to.test.ts`, "may divide none: nothing is removed and the event still resolves"                                                                                                                                                                                                                                                                                                           | Yes, 0 is allowed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Low — the card's own text has nothing that would make 0 matter either way; a `chooseTarget.optional` precedent already exists.                                                                                                                                                                                                                                                                                                                          |
| Q17 | Regroup vs. the Collector's discard redirect on the same defeated ally                             | `packages/engine/src/wave3-q17-regroup-collector.test.ts` (new)                                                                                                                                                                                                                                                                                                                                                                          | Regroup's own interrupt wins (the ally returns to hand); the Collector's redirect, modeled as a constant applied when the card actually leaves play, never gets a chance to race it.                                                                                                                                                                                                                                                                                                                    | **Yes, second most likely to be wrong.** RRG 1.8 Appendix III would favor a _forced_ interrupt (the Collector's) over an _optional_ one (Regroup's) if both answered the same triggering event — the doc's own §3.45 flags this exact tension. The engine's modeling choice (constant redirect vs. a second interrupt) is what decides the outcome here, not a timing-priority rule the engine actually applies, so this is more fragile than it looks. |
| Q18 | A card bound by "discard until" that was the deck's last card                                      | Not independently re-pinned this pass — `packages/engine/src/player-deck-reset.test.ts` already covers the general "discard from deck stops at a reset" mechanism (§4 Q15's own test file); the specific Teen Spirit-shaped "the matched card was the deck's last card" case named in Q18 was not separately reproduced with a wave 3 card (no wave 3 card was found with the same "discard until X, then add that card to hand" shape). | The engine still moves the matched card from the new (reshuffled) deck to the hand, per the doc's own description of `moveCards` reading a bound slot by instance id.                                                                                                                                                                                                                                                                                                                                   | Low-medium — `msm`'s Teen Spirit is the only known example, and it's wave 1, not wave 3; flagged as a coverage gap rather than re-verified.                                                                                                                                                                                                                                                                                                             |

**Ranking, most likely wrong first:** Q1 (a doc/code contradiction, not just an unanswered rules question — someone
should read `resolve/apply-effect.ts`'s `each`-target loop and either fix the doc's claim or reorder/batch the
targets), then Q17 (RRG's own general forced-before-optional rule looks like it should apply but the engine's
specific modeling sidesteps it), then Q14 (looks like an oversight in one reveal path, not a considered reading).
Q4, Q13, Q16, Q18 all look like reasonable, low-risk readings as implemented.

## What came out clean

- Fanaticism, Single-Minded Fury, Kree Physiology, "You Stand Accused!" (`gmw/ronan.ts`) — printed text vs. script,
  exact matches.
- Escape the Museum's `completionLoses` gap (1B/2B) — closed since the scripting doc's own table entry was written;
  confirmed via `packages/content/src/data/gmw/cards.ts` and `packages/engine/src/resolve/defeat.ts:114`.
- Ten `gmw` smoke games (Rocket solo, 2-player Groot+Rocket, four expert-mode games, Escape the Museum, Nebula, and
  the `ron` modular inside a real scenario) — all reach a real outcome, no stuck choice, replay deep-equal.
- Q4, Q13, Q16 — implemented as documented, low risk.
- The `ron`/Kree Fanatic modular set plays inside a real `gmw` scenario (Brotherhood of Badoon, swapped in for Band
  of Badoon) without incident.

## Findings summary

| #   | Card / mechanism                                                                                                 | Printed text                                                | Authority                                        | Test                                                            | Severity                                                                                                              | Owner                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `trors` None Shall Pass / Hunting Down Heroes / The Mad Doctor — "after resolving step one of the villain phase" | Red Skull rulebook p. 10 (Hunting Down Heroes)              | RRG 1.8 p. 4, p. 20                              | `packages/cards/src/wave2/trors/qa.test.ts`, `test.fails`       | **Breaks a game** (unbounded retrigger loop)                                                                          | `ability-scripting-engineer`                                             |
| 2   | §4 Q1: deferred villain defeat vs. simultaneous last-player elimination                                          | — (open question)                                           | RRG 1.8 "Winning the Game" p. 48 (silent)        | `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts`      | **Doc/code contradiction** — flag for re-check, not a player-facing bug (no printed card builds this exact shape yet) | `game-rules-architect` (to reconcile the doc and the code)               |
| 3   | §4 Q4: minion leaves play before When Defeated                                                                   | — (open question, no card reads the difference yet)         | ruling Jan 11, 2026 (1); RRG 1.8 "Defeat" p. 15  | `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts` | Cosmetic today (pin for the future)                                                                                   | —                                                                        |
| 4   | §4 Q17: Regroup vs. the Collector's discard redirect                                                             | Regroup (`drax` 19032), Collector I–III (`gmw` 16070–16072) | RRG 1.8 Appendix III; docs/phase7-wave3.md §3.45 | `packages/engine/src/wave3-q17-regroup-collector.test.ts`       | **Wrong result risk** if a future ruling favors the Collector — currently undecided by FFG                            | needs an FFG answer                                                      |
| 5   | Tooling: `pnpm card`/`pnpm dsl`/`pnpm refs` don't know about `WAVE3_ABILITIES`                                   | —                                                           | —                                                | manual repro (`MC_CARD=16110 pnpm card`), not a test            | Cosmetic (dev tooling only)                                                                                           | `ability-scripting-engineer` or whoever owns `packages/cards/tools/*.ts` |

## What could not be checked (time budget)

- **A full line-by-line `pnpm card`-vs-script audit of every `gmw` card** (the brief's literal item 2 ask) — not
  completed; the tooling gap above cost real time, and the remaining budget went to spot-checking the
  highest-risk-looking cards instead of an exhaustive sweep.
- **`stld`, `gam`, `drax`, `vnm` card-text audits** — none beyond the Regroup/Collector pair read for Q17; no
  line-by-line pass on any of the four hero kits, obligations or nemesis sets.
- **2-player and expert-mode games for `stld`/`gam`/`drax`/`vnm`** — solo standard Rhino only, same gap wave 2's own
  pass left for its own late-audited kits.
- **A live (not structural) repro of the `trors` step-one retrigger bug** — attempted, not completed; see Finding 1's
  own caveat above.
- **A full read of `marvel-champions-rulings-post-rrg-1-7.md`** — grepped by name for wave 3 hero/villain/pack
  terms (as the wave 3 spec's own §0 did), not read end to end; a ruling bearing on a shared keyword without naming
  a wave 3 card by name could have been missed, the same caveat wave 2's pass recorded.
- **The five other `completionLoses: true` stages** found by `grep` beyond Escape the Museum's own two (line
  numbers 2013, 2042, 2070, 2276, 2641 in `packages/content/src/data/gmw/cards.ts`) — not individually re-driven to
  confirm each actually loses the game when completed, only confirmed the field is present and the engine reads it
  generically.
- **The turn-start interrupt window (`06de1d6`) and consequential-damage (`04f0317`) cross-cutting changes** — no
  _new_ earlier-wave regression test added; relied on each change's own landed test file rather than combining with
  an unrelated earlier-wave card.
- **A multiplayer game mixing a `gmw` hero with a `stld`/`gam`/`drax`/`vnm` hero** — not attempted.

## Test counts

- `pnpm check` (lint, format, typecheck, test, build across every package): **fully green.**
- `packages/engine` — 123 test files, 1056 tests, all passed.
- `packages/cards` — 139 test files (138 passed, 1 skipped: the Q12 Moondragon placeholder), 1272 tests (1270
  passed, 1 expected fail: the `trors` step-one retrigger finding, 1 skipped: Q12).
- `packages/content` — 20 files, 461 tests, all passed (untouched by this pass).
- `packages/client` — 134 files, 1624 tests, all passed (untouched by this pass).

## Files touched this pass

- `packages/cards/src/wave2/trors/qa.test.ts` — new `test.fails` pinning the still-live step-one retrigger bug
  (Finding 1).
- `packages/cards/src/wave3/gmw/qa.test.ts` — new: 10 smoke games (Rocket solo, 2-player, expert mode ×4, Escape
  the Museum, Nebula, the `ron` modular inside a real scenario).
- `packages/cards/src/wave3/drax/qa.test.ts` — new: `test.skip` recording Q12 as genuinely unimplemented.
- `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts` — new: Q1 pin (and the doc/code contradiction finding).
- `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts` — new: Q4 pin.
- `packages/engine/src/wave3-q17-regroup-collector.test.ts` — new: Q17 pin.
- `docs/phase7-wave3-qa.md` — this report (new).
