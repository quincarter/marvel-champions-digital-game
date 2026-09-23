# Phase 7 wave 3 rules-QA pass

`rules-qa-engineer` independent QA pass over wave 3 (cycle 2: `gmw`, `stld`, `gam`, `drax`, `vnm`, `ron`). Modeled
on `docs/phase7-wave2-qa.md`. Per the standing ownership boundary: this pass finds and proves bugs with tests; it
does not fix engine or card-script code. Every finding cites the printed text and the authority (RRG 1.8 page or a
dated post-1.7 ruling) it was checked against.

**Two checkpoints.** Checkpoint 1 (below, through "Test counts" as it stood) covered items 1/3/4 partially and
flagged items 1's full `gmw` sweep, `stld`/`gam`/`drax`/`vnm` audits, more 2-player/expert games and a rulings
skim as not done. Checkpoint 2 (§"Checkpoint 2" near the bottom) does those: full `stld`/`gam`/`drax`/`vnm`
line-by-line audits, the rest of `gmw` (Groot/Rocket kits, obligations/nemeses, Badoon, Museum, Escape the Museum,
Nebula, every modular set), six more smoke games, and a targeted rulings skim. Read both; the findings summary and
test counts near the bottom are the current totals across both.

## Coverage

### Smoke games (task item 1)

Before this pass, every wave 3 scenario's own `e2e.test.ts`/`*-e2e.test.ts` was Groot (Protection), solo, standard
only — Rocket Raccoon had no game at all, and Escape the Museum and Nebula had none either. This pass adds
`packages/cards/src/wave3/gmw/qa.test.ts` (10 new games) and `packages/engine/src/wave3-q1-…`/`…-q4-…` and the Q17 pin (now `regroup-wins-over-collector.test.ts`)
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
| Defeat-destination redirects (`0d46e78`)                      | **New**: `packages/engine/src/regroup-wins-over-collector.test.ts` (was `wave3-q17-regroup-collector.test.ts`) — combines Regroup (`drax`) with a Collector-shaped `discardFromPlayDestination` constant on the _same_ defeated ally, which `defeat-destination.test.ts` and `scenario-area.test.ts` each test in isolation but never together.                   | synthetic (both cards are wave 3's own; no earlier-wave "Time Portal"-style redirect was combined this way — flagged under "not checked") |
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

| Q   | Question                                                                                                                                                           | Test                                                                                                                                                                                                            | What the engine does today                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Most likely to be wrong?                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | A deferred villain defeat and a simultaneous last-player elimination                                                                                               | `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts` (new)                                                                                                                                                | **Contradicts docs/phase7-wave3.md §3.1's own docblock.** For a single `dealDamage` effect hitting both the villain (1 HP, its defeat heard/deferred) and the sole player's identity (lethal) at once, `each`'s target loop processes the villain first and ends the game as a **win** before the identity is ever damaged — not the "elimination happens first, loss" the docblock describes. See "cross-cutting" note below — this is a doc/implementation mismatch, not just an open rules question. | **Yes — flag this one specifically.** Either the docblock's own claim was never re-verified after it was written, or a later engine change (plausibly `8129545`/`06de1d6`'s neighbors, all landing the same week) altered target-iteration order without anyone re-checking this specific claim. Either way, one of the two (the doc or the code) is wrong today, independent of what a future FFG ruling says.      |
| Q4  | A defeated minion leaves play before its own When Defeated resolves                                                                                                | `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts` (new)                                                                                                                                           | Confirmed: `cardMoved` (to the encounter discard pile) fires before `abilityResolved` for the minion's own When Defeated — the opposite order from a defeated side scheme (`victory-keyword.test.ts`'s own "goes there after its When Defeated resolves"). Matches the doc's own description.                                                                                                                                                                                                           | No — this one matches the code, only whether the Jan 11, 2026 ruling (which is explicitly about a side scheme) should be read to also cover minions is genuinely open, and RRG text doesn't say either way.                                                                                                                                                                                                          |
| Q12 | Is Moondragon's "that minion attacks another enemy" an activation? **Decided by the user, 2026-09-23: an attack, not an activation** (docs/phase7-wave3.md §3.23). | `packages/cards/src/wave3/drax/qa.test.ts` — the former `test.skip`, now two real tests                                                                                                                         | A villainous minion made to attack gets no boost card; Tiger Shark's "After Tiger Shark attacks" does not fire.                                                                                                                                                                                                                                                                                                                                                                                         | Built as `EffectSpec enemyAttacksEnemy`; `19013.moondragon-action` is scripted and out of `KNOWN_SKIPPED`.                                                                                                                                                                                                                                                                                                           |
| Q13 | A Team-Up name written "Hero/Alter-ego" (Heart of the Panther)                                                                                                     | Already pinned: `packages/engine/src/team-up-names.test.ts`, describe block "§3.34 'Hero/Alter-ego' names one identity by both sides"                                                                           | Matches one identity by both faces' names, whichever side is up.                                                                                                                                                                                                                                                                                                                                                                                                                                        | Low — a strict RRG p. 23 reading would instead require the hero side specifically to be up; the doc itself flags this as a reading, but the practical difference is narrow (only matters mid-alter-ego-form).                                                                                                                                                                                                        |
| Q14 | Is a card revealed by `EffectSpec revealEncounterCard` still on top of the deck while it resolves?                                                                 | Already pinned, deliberately undecided: `packages/engine/src/player-superlative.test.ts`'s own `start()` docblock ("whether or not the revealed Drang has left the deck by then") — written to pass either way. | Still on top (confirmed by reading `apply-effect.ts`: `drawEncounterCard` returns the card without removing it; a revealed treachery only leaves the deck in the reveal frame's `finish` stage).                                                                                                                                                                                                                                                                                                        | Medium — every _other_ reveal path (villain phase deal, surge) deals the card out of the deck first; this one path being the odd one out looks more like an oversight than an intentional reading, but "found, not fixed" is honest until someone checks the other three usages (`core/modular/standard.ts`, `core/aspects/protection.ts`, `wave1/bkw/pack-cards.ts`) for whether they rely on the current behavior. |
| Q16 | Can an effect's "up to N" (Agile Flight) choose none? **Decided by the user, 2026-09-23: no — at least 1 when possible** (docs/phase7-wave3.md §4 Q16).            | `packages/engine/src/divide-up-to.test.ts` ("refuses 0 while threat can be removed"), `packages/cards/src/wave3/stld/star-lord-kit.test.ts` (Agile Flight, three Q16 tests)                                     | 0 is refused whenever a valid target exists; with none, nothing is asked.                                                                                                                                                                                                                                                                                                                                                                                                                               | Behaviour changed from "0 allowed"; `chooseTarget.upTo` and the "up to" `chooseCards` scripts follow the same rule.                                                                                                                                                                                                                                                                                                  |
| Q17 | Regroup vs. the Collector's discard redirect on the same defeated ally. **Decided by the user, 2026-09-23: Regroup wins** (docs/phase7-wave3.md §4 Q17).           | `packages/engine/src/regroup-wins-over-collector.test.ts` (renamed from `wave3-q17-regroup-collector.test.ts`)                                                                                                  | Regroup's own interrupt wins (the ally returns to hand); the Collector's redirect never happens for it.                                                                                                                                                                                                                                                                                                                                                                                                 | No longer a risk: the engine's behaviour is the decided rule. Regroup triggers on the defeat, before any discard, so the Collector never triggers.                                                                                                                                                                                                                                                                   |
| Q18 | A card bound by "discard until" that was the deck's last card. **Decided by the user, 2026-09-23: it still goes to hand** (docs/phase7-wave3.md §4 Q18).           | `packages/cards/src/wave1/msm/ms-marvel.test.ts`, "Teen Spirit (§4 Q18)" (new)                                                                                                                                  | Red Dagger, the deck's last card, is discarded, the deck resets at once, and Red Dagger still goes to hand; everything else is in the new deck.                                                                                                                                                                                                                                                                                                                                                         | Resolved: the engine's behaviour is the decided rule.                                                                                                                                                                                                                                                                                                                                                                |

**Ranking, most likely wrong first:** Q1 (a doc/code contradiction, not just an unanswered rules question — someone
should read `resolve/apply-effect.ts`'s `each`-target loop and either fix the doc's claim or reorder/batch the
targets), then Q17 (RRG's own general forced-before-optional rule looks like it should apply but the engine's
specific modeling sidesteps it), then Q14 (looks like an oversight in one reveal path, not a considered reading).
Q4, Q13, Q16, Q18 all look like reasonable, low-risk readings as implemented.

## What came out clean

- Fanaticism, Single-Minded Fury, Kree Physiology, "You Stand Accused!" (`gmw/ronan.ts`) — printed text vs. script,
  exact matches.
- Escape the Museum's `completionLoses` gap (1B/2B) — **re-checked in checkpoint 2 with a real driven test, not
  just a data grep** (checkpoint 1 only confirmed the field's presence): `escape-the-museum.test.ts` now proves a
  stage reaching its target threat the ordinary way loses the game, not just a stage whose last threat is removed.
  `escape-the-museum.ts`'s own module docblock still calls this an open gap and should be corrected.
- Ten `gmw` smoke games from checkpoint 1 (Rocket solo, 2-player Groot+Rocket, four expert-mode games, Escape the
  Museum, Nebula, the `ron` modular inside a real scenario), plus six more from checkpoint 2 (Gamora + Star-Lord
  2p, Drax + Venom 2p, and one expert game each for Star-Lord/Gamora/Drax/Venom) — all sixteen reach a real
  outcome, no stuck choice, replay deep-equal.
- Q4, Q13, Q16 — implemented as documented, low risk.
- The `ron`/Kree Fanatic modular set plays inside a real `gmw` scenario (Brotherhood of Badoon, swapped in for Band
  of Badoon) without incident.
- **Full line-by-line audits, checkpoint 2** (`stld` kit/obligation/nemesis, `gam` kit/obligation/nemesis except the
  one finding below, `drax` kit/obligation/nemesis/pack-cards, `vnm` kit/obligation/nemesis, and the rest of `gmw`:
  Groot kit/obligation/nemesis, Rocket kit/obligation/nemesis, Badoon + Band of Badoon, Museum + Menagerie Medley,
  Escape the Museum, Nebula + Space Pirates + Power Stone, Ship Command, Galactic Artifacts, Badoon Headhunter,
  Ruthless) — every card read against `pnpm card`/`docs/cards/by_pack/*.md`, checked for target, "you" vs. "each
  player", may/must, timing word, cost vs. effect, keyword, and the "already X" ordering pattern. All clean except
  the Waylay finding below.

## Findings summary

| #   | Card / mechanism                                                                                                 | Printed text                                                                                               | Authority                                                                                                                                                      | Test                                                                         | Severity                                                                                                                                                                                                 | Owner                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `trors` None Shall Pass / Hunting Down Heroes / The Mad Doctor — "after resolving step one of the villain phase" | Red Skull rulebook p. 10 (Hunting Down Heroes)                                                             | RRG 1.8 p. 4, p. 20                                                                                                                                            | `packages/cards/src/wave2/trors/qa.test.ts`, `test.fails`                    | **Breaks a game** (unbounded retrigger loop)                                                                                                                                                             | `ability-scripting-engineer`                                                                                                                                                                                 |
| 2   | §4 Q1: deferred villain defeat vs. simultaneous last-player elimination                                          | — (open question)                                                                                          | RRG 1.8 "Winning the Game" p. 48 (silent)                                                                                                                      | `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts`                   | **Doc/code contradiction** — flag for re-check, not a player-facing bug (no printed card builds this exact shape yet)                                                                                    | `game-rules-architect` (to reconcile the doc and the code)                                                                                                                                                   |
| 3   | §4 Q4: minion leaves play before When Defeated                                                                   | — (open question, no card reads the difference yet)                                                        | ruling Jan 11, 2026 (1); RRG 1.8 "Defeat" p. 15                                                                                                                | `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts`              | Cosmetic today (pin for the future)                                                                                                                                                                      | —                                                                                                                                                                                                            |
| 4   | §4 Q17: Regroup vs. the Collector's discard redirect                                                             | Regroup (`drax` 19032), Collector I–III (`gmw` 16070–16072)                                                | docs/phase7-wave3.md §4 Q17 (decided by the user, 2026-09-23); §3.45                                                                                           | `packages/engine/src/regroup-wins-over-collector.test.ts`                    | Resolved: Regroup wins                                                                                                                                                                                   | none                                                                                                                                                                                                         |
| 5   | Tooling: `pnpm card`/`pnpm dsl`/`pnpm refs` don't know about `WAVE3_ABILITIES`                                   | —                                                                                                          | —                                                                                                                                                              | manual repro (`MC_CARD=16110 pnpm card`), not a test                         | Cosmetic (dev tooling only)                                                                                                                                                                              | **Fixed during this pass** (commit `821aa2b`)                                                                                                                                                                |
| 6   | **Waylay (`gam` 18028): stuns/confuses whoever reveals it, not "Gamora"** — checkpoint 2's own finding           | "When Revealed: Stun and confuse Gamora. If Gamora is already stunned or confused, this card gains surge." | RRG 1.8 "You, Your" p. 49 (a named character overrides the generic "you" reveal-default); ruling June 25, 2026 (4) #1 ("Nemesis sets belong to that identity") | `packages/cards/src/wave3/gam/gamora-obligation-nemesis.test.ts`, `it.fails` | **Wrong result** — invisible in every solo test (the revealer is always Gamora there); in any 2+ player game where someone else reveals it, the wrong player is stunned/confused and Gamora is untouched | `ability-scripting-engineer` (`gam/gamora-obligation-nemesis.ts`, `18028.when-revealed`; swap `yourIdentity` for the `GAMORA_PLAYER` binding `18025`'s own abilities in the same file already use correctly) |
| 7   | Escape the Museum's `completionLoses` docblock is stale — checkpoint 2's own finding                             | "If this stage is completed, the players lose the game" (16082b/16083b)                                    | RRG 1.8 "Villain Defeat" p. 47; docs/phase7-wave3.md §3.37                                                                                                     | `packages/cards/src/wave3/gmw/escape-the-museum.test.ts` (new passing test)  | **Not a bug** — documentation drift only; the game behaves correctly, the comment describing it as broken does not                                                                                       | `ability-scripting-engineer` (correct the docblock in `escape-the-museum.ts`)                                                                                                                                |

## What could not be checked (time budget)

- **A live (not structural) repro of the `trors` step-one retrigger bug** — attempted, not completed; see Finding 1's
  own caveat above.
- **The five other `completionLoses: true` stages** found by `grep` beyond Escape the Museum's own two (line
  numbers 2013, 2042, 2070, 2276, 2641 in `packages/content/src/data/gmw/cards.ts`) — not individually re-driven to
  confirm each actually loses the game when completed, only confirmed the field is present and the engine reads it
  generically (Escape the Museum's own two now are — see the finding above).
- **The turn-start interrupt window (`06de1d6`) and consequential-damage (`04f0317`) cross-cutting changes** — no
  new earlier-wave regression test added; relied on each change's own landed test file rather than combining with
  an unrelated earlier-wave card.
- **A multiplayer game mixing a `gmw` hero with a `stld`/`gam`/`drax`/`vnm` hero** — not attempted (the checkpoint-2
  2-player games pair two of the four hero packs together, or one hero pack with `gmw`'s own precons, but no game
  seats a `gmw` hero and a `stld`/`gam`/`drax`/`vnm` hero at the same table).
- **The Dec 17, 2025 Ruling 3 "after [enemy] attacks you" / ally-attacked exception** — spot-checked against
  Drax's own Payback (19007, the ruling's own named example): the shared `on.villainAttacks({ againstYou: true })`
  primitive (`playerIs: "controller", usesAttackedPlayer: true`) reads the attack's target player, not a specific
  character, which looks correct for the ruling's own reading, and this is a pre-existing wave 1/2 primitive, not
  something new this wave. Not independently pinned with a new test (an ally being attacked directly, rather than
  defending the villain's attack on the player, needs state the existing `toDeclareDefender` helper doesn't build)
  — flagged as checked-but-not-proven rather than assumed correct.
- **The Apr 30, 2026 Ruling 2 "does a Guard/Patrol engage during cost payment fizzle the effect" reading** —
  several `gmw`/`stld` cards use the "deal yourself 1 facedown encounter card → effect" shape (Daring Escape,
  Library Labyrinth, Universal Weapon, Star-Lord's "What could go wrong?"); whether a minion revealed by that cost
  and engaging the player mid-payment correctly blocks a same-turn attack effect the ruling describes was not
  tested — this is existing, general step-5/step-6 engine sequencing, not wave-3-specific, so it was treated as
  out of scope for a targeted skim rather than exhaustively re-verified.
- **The Aug 3, 2026 Ruling 6 "exactly defeat" definition** — no wave 3 card prints "exactly defeat" (confirmed by
  grepping all six packs' printed-text transcriptions), so nothing in this wave exercises it; not pursued further.

## Test counts

- `pnpm check` (lint, format, typecheck, test, build across every package): **fully green**, both checkpoints.
- `packages/engine` — 123 test files, 1056 tests, all passed.
- `packages/cards` — 141 test files (all passed), 1280 tests (1277 passed, 2 expected fail: the `trors` step-one
  retrigger finding and the Waylay finding, 1 skipped: Q12).
- `packages/content` — 20 files, 461 tests, all passed (untouched by this pass).
- `packages/client` — 134 files, 1624 tests, all passed (untouched by this pass).

## Files touched, checkpoint 1

- `packages/cards/src/wave2/trors/qa.test.ts` — new `test.fails` pinning the still-live step-one retrigger bug
  (Finding 1).
- `packages/cards/src/wave3/gmw/qa.test.ts` — new: 10 smoke games (Rocket solo, 2-player, expert mode ×4, Escape
  the Museum, Nebula, the `ron` modular inside a real scenario).
- `packages/cards/src/wave3/drax/qa.test.ts` — new: `test.skip` recording Q12 as genuinely unimplemented.
- `packages/engine/src/wave3-q1-simultaneous-defeat.test.ts` — new: Q1 pin (and the doc/code contradiction finding).
- `packages/engine/src/wave3-q4-minion-leaves-play-order.test.ts` — new: Q4 pin.
- `packages/engine/src/regroup-wins-over-collector.test.ts` (was `wave3-q17-regroup-collector.test.ts`) — new: Q17 pin.
- `docs/phase7-wave3-qa.md` — this report (new).

## Checkpoint 2

Addressed everything checkpoint 1 listed as not checked, in the order the coordinator asked for: full `stld`/
`gam`/`drax`/`vnm` line-by-line audits, the rest of `gmw`, six more smoke games, and a targeted rulings skim. Two
new findings (Waylay, #6; Escape the Museum's stale docblock, #7 — a "clean" result, not a bug) are folded into
the findings/clean sections above rather than repeated here.

### Line-by-line audits

Method: `pnpm card` (fixed mid-pass to see `WAVE3_ABILITIES`, commit `821aa2b`) dumped every card's printed text
next to its script location; each ability's DSL composition was then read against that text for target, "you" vs.
"each player", may/must, the timing word, cost vs. effect, and keywords, watching specifically for an
approximation (a trigger broader than printed) or a half-scripted text box (one clause silently missing) — the two
patterns earlier passes found. `docs/cards/by_pack/*.md` filled in the handful of multi-stage villain/main-scheme
texts `pnpm card`'s own tool doesn't print per-stage.

- **`stld`**: Star-Lord's identity (17001a/b), full kit (17002–17023, 17028–17030), obligation (Banishment,
  17024), nemesis set (Budding Crime Syndicate, Mister Knife, Spartoi Cunning). All clean.
- **`gam`**: Gamora's identity (18001a/b), full kit (18002–18020, 18029–18031), obligation (Unfulfilled Destiny,
  18024), nemesis set (Sibling Rivalry, Nebula the minion, In a Bind, Waylay). Clean except Waylay (Finding 6).
- **`drax`**: Drax's identity (19001a/b), full kit (19002–19018), obligation (Memories of Another Life, 19025),
  nemesis set (Cull the Weak, Yotat the Destroyer, Challenge Accepted, "I Will Destroy You!"), the aspect filler
  cards bundled in the pack ("Bring It!", "Think Fast!", Regroup). All clean.
- **`vnm`**: Venom/Flash Thompson's identity (20001a/b), full kit (20002–20029), obligation (Struggle for Control,
  20023), nemesis set (Klyntar Frenzy, Enraged Symbiote). All clean.
- **`gmw` remainder**: Groot's kit/obligation/nemesis (16002–16028), Rocket Raccoon's kit/obligation/nemesis
  (16029–16057), Brotherhood of Badoon (Drang I–III, Terrestrial Invasion/Protect the Planet, Badoon Ship, Drang's
  Spear, Badoon Engineer, the four side schemes) plus Band of Badoon, Infiltrate the Museum (Collector I–III, The
  Grand Collection, Biogram Image, Inconspicuous Box, View the Cosmos, Stay Awhile) plus Menagerie Medley, Escape
  the Museum (the ∞-face Collector pair, the three-stage main scheme, Library Labyrinth/Museum Ship, the two
  treacheries), Nebula (Nebula I–III, the main scheme, Nebula's Ship, the five Techniques, Lethal Intent, Barrel
  Roll, Combat Ready) plus Space Pirates and the Power Stone, Ship Command, Galactic Artifacts, Badoon Headhunter,
  and Ruthless. All clean; Ronan's own set was already audited in checkpoint 1.

### Six more smoke games

| Pack(s)        | Hero(es)                        | Scenario     | Mode     | Players | Outcome? | File                                                 |
| -------------- | ------------------------------- | ------------ | -------- | ------- | -------- | ---------------------------------------------------- |
| `gam` + `stld` | Gamora + Star-Lord (Leadership) | Rhino (Core) | standard | 2       | yes      | `gam/qa.test.ts`                                     |
| `gam`          | Gamora                          | Rhino (Core) | expert   | 1       | yes      | `gam/qa.test.ts`                                     |
| `drax` + `vnm` | Drax + Venom                    | Rhino (Core) | standard | 2       | yes      | `drax/qa.test.ts`                                    |
| `drax`         | Drax                            | Rhino (Core) | expert   | 1       | yes      | `drax/qa.test.ts`                                    |
| `vnm`          | Venom                           | Rhino (Core) | expert   | 1       | yes      | `drax/qa.test.ts` (Venom has no natural home either) |
| `stld`         | Star-Lord (Leadership)          | Rhino (Core) | expert   | 1       | yes      | `stld/qa.test.ts`                                    |

All six reach a real outcome, no stuck `PendingChoice`, replay deep-equal. Cross-pack 2-player pairings (Gamora +
Star-Lord, Drax + Venom) live in whichever pack's folder was more natural, since neither pack "owns" the other.

### Rulings skim

Grepped `marvel-champions-rulings-post-rrg-1-7.md` (1139 lines) for every wave 3 hero/villain/pack/keyword name
(35 hits across the file), read each hit's full ruling. Findings folded in above (Waylay, cross-checked against
June 25, 2026 (4) #1's "nemesis sets belong to that identity"). Confirmed already correct, no new test needed:

- **Jan 26, 2026 (3)** — Rocket Raccoon's "Murdered You!" (16029a) reads excess damage dealt, not taken;
  `on.attacks("self", { excessDamage: true })` already does this (matches checkpoint 1's own citation of the same
  ruling for Follow Through).
- **Aug 3, 2026 (4) #4** — Drax retains vengeance counters above 3; `addCounters("vengeance", 1, ..., { upTo: 3 })`
  caps the placement, not the total, so a counter added by another source (Captain Americat, unscripted this
  wave) isn't capped. Already confirmed in the drax-kit.ts audit above.
- **March 19, 2026 (3)** — Power Stone on an eliminated player's identity resolves its "attach to" text rather
  than being discarded; docs/phase7-wave3.md §3.19 already implements this (`eliminatePlayer`'s permanent-card
  handling), pre-existing from checkpoint-1-adjacent engine work, re-confirmed by reading the ruling against the
  spec doc's own citation.

Not chased further (see "what could not be checked" above): the Dec 17, 2025 (3) ally-attacked exception
(spot-checked, not newly pinned), the Apr 30, 2026 (2) Guard/Patrol cost-fizzle reading (generic engine
sequencing, not wave-3-specific), and the Aug 3, 2026 (6) "exactly defeat" definition (no wave 3 card uses the
term).

## Files touched, checkpoint 2

- `packages/cards/src/wave3/gam/gamora-obligation-nemesis.test.ts` — new `it.fails` pinning the Waylay finding
  (Finding 6).
- `packages/cards/src/wave3/gmw/escape-the-museum.test.ts` — new passing test proving the `completionLoses`
  docblock is stale (Finding 7).
- `packages/cards/src/wave3/gam/qa.test.ts` — new: Gamora + Star-Lord 2p game, Gamora expert solo.
- `packages/cards/src/wave3/drax/qa.test.ts` — extended: Drax + Venom 2p game, Drax expert solo, Venom expert solo.
- `packages/cards/src/wave3/stld/qa.test.ts` — new: Star-Lord expert solo.
- `docs/phase7-wave3-qa.md` — this report, updated.

## Resolutions

- **Finding 2 (§4 Q1), resolved in `cbc8a10`.** Simultaneous villain defeat and last elimination is a loss. Multi-target
  damage now resolves simultaneously (ruling June 2, 2026 (2) answer 1; FFG ruling May 18, 2023 on The Kraken). The
  Q1 pin was rewritten to expect the loss.
- **Finding 6 (Waylay), resolved.** `18028.when-revealed` now targets the identity titled "Gamora", not the revealer.
  The pin was also invalid: it threw during setup ("no 18028 set aside for p2") before reaching any assertion, which
  `it.fails` counted as the expected failure. It is now a passing test that stages a real 2-player villain phase in
  which P2 is dealt and reveals Waylay, confirmed to fail against the old targeting. The same file's `GAMORA_PLAYER`
  (`ownerOf(named("Gamora"))`) could resolve to Drax's Gamora ally (19020) at another seat, since `named` returns the
  first card in play with that title. It is now `controllerOf` the Gamora identity.
- **Tooling finding, resolved in `821aa2b`.** `pnpm card` reads `WAVE3_ABILITIES`.
- **Lesson for pins:** an `it.fails` test passes on _any_ throw, including a setup error. A pin must be seen failing on
  its assertion (run it once as a plain `it`) before it is committed.

## Checkpoint 3: GMW campaign mode (PR #35 step 4)

QA pass over `packages/cards/src/campaigns/gmw.ts` (`GMW_CAMPAIGN_DEFINITION`), the Market
(`wave3/gmw/market.ts`), Campaign Challenge (`wave3/gmw/campaign-challenge.ts`), and Badoon Headhunter
(`wave3/gmw/badoon-headhunter.ts`). New file: `packages/cards/src/campaigns/gmw.qa.test.ts`.

### Why this pass exists

Until `f7ec234f` ("fix(cards): query([], ...) no longer matches nothing"), `packages/engine/src/select.ts`'s
`explainQuery` treated `TargetQuery.categories: []` as an active (and unsatisfiable) filter, so every
`query([], {printedId})` call in `gmw.ts` — `revealChallengeSideScheme`'s reveal, `headhunterLadder`'s shuffle-ins,
and the Kree Supremacy reveal bridge — silently selected nothing and did nothing. `campaigns/gmw.test.ts` kept
passing throughout, because it only asserts `CampaignLog` values (units, `marketCards`, runner bookkeeping), never
the resulting `GameState`. This pass proves the fix (and everything downstream of it) with real games —
`createGame`/`startGameFromLog`, not synthetic `CampaignGameResult`s — asserting on the actual encounter deck
contents, the actual villain-area instance, and its actual threat.

### Priority 1 results

| Item                                                                                   | Test(s)                                                                                                                                                                         | Result                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every scenario's Campaign Challenge side scheme reveals in play, right face by mode    | `Priority 1 — every scenario's Campaign Challenge side scheme reveals for real, right face by mode` (9 tests: 4 scenarios × standard/expert + the 1-player Hinder scaling case) | **Pass.** Right face in `villainArea`, faceup; wrong face stays in `encounterSetAside`; threat = `startingThreat` + `Hinder × players`, correct at 1 and 2 players. |
| Kree Supremacy's "(Optional)" reveal (RRG 1.8 p. 67 errata)                            | `Priority 1 — Kree Supremacy's "(Optional)" reveal is a real group decision, not silently skipped` (3 tests: accept/decline/accept-expert)                                      | **Pass.**                                                                                                                                                           |
| Every Badoon Headhunter rung lands in the encounter deck at the right tier, not before | `Priority 1 — the Badoon Headhunter ladder lands in the encounter deck at the right tier, not before` (5 tests, one per scenario, checking both sides of each threshold)        | **Pass.**                                                                                                                                                           |
| Other cards `gmw.ts` moves by printed id — "You Stand Accused!" (116) at Ronan         | `Priority 1 — "You Stand Accused!" is dealt to the recorded Power Stone controller, and only then` (2 tests)                                                                    | 1 pass (no controller ⇒ nothing dealt), **1 bug found** (below, since fixed)                                                                                        |

A `grep` of `gmw.ts` for `query(`/`printedId` also turned up Pincer Maneuver's `mc16.s5.setup.pincer-maneuver`,
which shares "You Stand Accused!"'s bug (below) rather than the fixed one.

### Bugs found (both fixed 2026-09-23 by `CardSelector atMost`, docs/phase7-wave3.md §3.50)

> **Fixed.** `gmw.ts` now searches with `oneCopyOf(encounterCards(...))`, and both tests below run (no longer
> `it.skip`). Each also checks that the copies not taken stay in the encounter deck or discard pile. The same flaw in
> Zola (II)'s Test Subjects search (`searchAndReveal`, 04123 ×2) and Peter Quill's Element Gun setup (17007 ×2) was
> fixed with them.

1. **"You Stand Accused!" (16116) is dealt three times, not once.** `16116` has `quantityInSet: 3`
   (`packages/content/src/data/gmw/cards.ts`). `mc16.s5.setup.you-stand-accused`'s
   `selectCards("accused", encounterCards(["deck", "discard"], { printedId: YOU_STAND_ACCUSED }))` matches every
   copy — `CardSelector`'s `encounter` variant has no "at most N matches" concept, only `top` (a _positional_
   deck-top limiter that does nothing useful across "deck and discard" together, spec.ts's own docstring). MC16
   p. 18 prints "search … for **one copy** … then deal **that card**" — singular. Confirmed live: the recorded
   Power Stone controller's `dealtEncounter` held three separate `16116` instances. Test:
   `gmw.qa.test.ts`'s `it.skip("a recorded Power Stone controller is dealt exactly one copy of the treachery
(MC16 p. 18)")`.
2. **Pincer Maneuver (16112) is revealed twice, not once — the more consequential twin of the same bug.** `16112`
   also has `quantityInSet: 2`; the same `selectCards`/`printedId` shape in `mc16.s5.setup.pincer-maneuver` matches
   both copies, and `revealCard(chosen("pincer"), firstPlayer)` reveals both. Confirmed live: Ronan's setup ends
   with **two** separate Pincer Maneuver side schemes in the villain area, each independently placed with the full
   "3 minus Evasion Counters" threat MC16 p. 18 describes for _the_ (singular) scheme — doubling both the total
   threat obligation and the "First Player Action: exhaust the Milano" scheme's real board presence at every
   Ronan game. Test: `gmw.qa.test.ts`'s `it.skip("only one Pincer Maneuver side scheme is revealed and placed
(MC16 p. 18)")`.

Both bugs share one root cause: `CardSelector`'s `encounter`/`scenarioDeck`/`separateDeck` variants (spec.ts) have
no "select at most N of the matches" primitive, only `top` (positional, single-zone). Filed for `game-rules-
architect` (if the fix belongs in the `CardSelector` shape itself) and `ability-scripting-engineer` (if `gmw.ts`
should instead be rewritten against an existing primitive, e.g. a deterministic "first match" reducer) — which
owns the fix isn't resolved yet, so both are named rather than guessing.

### A design note surfaced while writing these tests (not a bug)

`applyCampaignResult`'s synthetic-record technique (`trors.qa.test.ts`'s own documented shortcut, reused here) has
a sharp edge worth recording for future campaign QA: a `record`-kind victory instruction with no matching entry in
`CampaignGameResult.records` is skipped outright, but a **`betweenGames`-kind** victory instruction (e.g. MC16
p. 10's Collection bonus, `mc16.s2.victory.collection-bonus`) is _not_ gated by `records` at all and evaluates its
`CampaignValue` combinators for real against whatever the working log actually holds. Since The Collection starts
empty, "1[per_hero] or fewer" is vacuously true, so winning Infiltrate the Museum synthetically (with no override)
still awards 1 real unit per seat — which in turn makes every later scenario's own Market/heal offers real
questions that a script must answer, not skip. `gmw.qa.test.ts`'s `declineMarketAndHeal` helper exists because of
this; a QA test that assumes "no override ⇒ no side effect" for _every_ victory instruction will intermittently
throw ("no scripted answer for …") depending on which instructions a scenario happens to print.

### What this pass did not test

- Every other value the "You Stand Accused!"/Pincer Maneuver bugs interact with downstream (e.g., whether a
  doubled Pincer Maneuver breaks the "First Player Action: exhaust the Milano" scheme text, or whether a
  triple-dealt "You Stand Accused!" can be played/discarded three times) — out of scope once the root selector bug
  was identified; re-test once fixed.

## Checkpoint 4: GMW campaign walks, Market visits, loss/retry, Expert mechanics, log-fed setups (PR #35 step 4c)

The second pass Checkpoint 3 flagged as thin: a full standard/expert campaign walk with real games at every node,
Victory-unit boundaries, the Market across visits, loss/retry, Expert-only mechanics, and the log fields (Power
Stone, evasion counters, Galactic Artifacts) that feed a later scenario's setup. All six items below are now
covered, extending `packages/cards/src/campaigns/gmw.qa.test.ts` (same file, new `describe`s after the Priority 1
ones) rather than a new file.

| #   | Item                                                                                                                                   | Tests                                                                                                                                                                                                                                                                                                                                                                                            | Result                                                                                                                                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Full standard + expert campaign, real game at every node                                                                               | `"MC16 p. 3/p. 4 — a full standard and a full expert campaign, real game at every node"` (3 tests: standard stage/threat, expert stage/threat incl. Ronan's +1[per_hero], the full walk completing "won")                                                                                                                                                                                        | **Pass.** Villain stage index and main scheme starting threat read off a real `GameState` at all 5 nodes, both modes.                                                                                                                                                                                                  |
| 2   | Victory units: base, 3-cap, and each scenario bonus at its boundary                                                                    | `'MC16 p. 8 — Scenario 1 victory units: "up to 3" caps at the boundary'`, `'MC16 p. 8 — "1 if there are no minions in play" and "1 if the main scheme is on stage 1B"'`, `'MC16 p. 10 — "1 if there is no threat on the main scheme"'`, `'MC16 p. 10 — "1 unit for each player if there are 1[per_hero] or fewer cards in The Collection"'`, `'MC16 p. 12 — "for every 2 Galactic Artifacts …"'` | **Pass, with one bug found (below).** Cap and no-minions/no-threat bonuses proven at their boundary from a real, staged `GameState` folded through `campaignResultOf`/`applyCampaignResult`; the Collection and Galactic Artifacts `betweenGames` bonuses proven at their boundary via `CampaignGameResult.logWrites`. |
| 3   | The Market: several purchases in one visit, one copy across visits, carried units, legal + deck-size-exempt later                      | `"MC16 p. 5 — the Market: several purchases in one visit, one copy across visits, and carried units"` (4 tests)                                                                                                                                                                                                                                                                                  | **Pass.**                                                                                                                                                                                                                                                                                                              |
| 4   | Loss and retry: what's kept vs. discarded                                                                                              | `'MC16 p. 4 — "reset the scenario and try again with no penalty"'` (3 tests)                                                                                                                                                                                                                                                                                                                     | **Pass.** A Market purchase made during the lost attempt's own setup is undone (`retryBaseline: "nodeStart"`); the Headhunter ladder (only ever written by a win) is untouched by a loss; the retry composes the identical deck the first attempt did.                                                                 |
| 5   | Expert: HP carry/restore, the heal boundary, the Collection choice, Ronan's expert-only loss, the deck freeze, elimination-and-victory | `"MC16 p. 5/p. 10 — Expert campaign: remaining HP is recorded, then really restored"`, `'MC16 p. 10 — the optional 1-unit heal'` (3 tests), `"MC16 p. 18 — Ronan's expert-campaign-only loss"` (2 tests), `'MC16 p. 5 — the expert deck freeze'`                                                                                                                                                 | **Mostly pass, two gaps found (below).** HP restore, heal boundary (unaffordable/declined/accepted), Ronan's expert-vs-standard loss, and the deck freeze (a resized non-campaign line refused, a Market grant still accepted) all pass against a real `GameState` or a real `validateDeck` call.                      |
| 6   | Log fields feeding later setups: Power Stone control, evasion counters, Galactic Artifacts                                             | `"MC16 p. 15 — Power Stone Control is recorded from a real attachment"`, `'MC16 p. 18 — Pincer Maneuver's "3 minus Evasion Counters" threat'` (2 tests), `"MC16 p. 12/p. 14 — Galactic Artifacts recorded in the victory display are pulled into Nebula's own deck"`                                                                                                                             | **Pass.** Power Stone control derived from a real staged attachment (not the log-shortcut Checkpoint 3 used); Pincer Maneuver's threat floor proven at 3 and past it (5); all four Galactic Artifacts effects (evasion counter, dealt card, boost, tough) confirmed landing in a real Nebula game.                     |

### Bugs and gaps found this checkpoint

1. **`gmw.ts`'s "main scheme is on stage 1B" bonus is dead code in every real game (content bug).** `TERRESTRIAL_INVASION_1B = cardId("16061b")` (scenario 1) and `ART_OF_EVASION_1B = cardId("16091b")` (Nebula) name `CardId`s that do not exist anywhere in `WAVE3_CARDS` — `packages/content/src/data/gmw/cards.ts` models each of these main schemes as _one_ card record (`16061a`, `16091a`) with a `stages` array; a stage's A/B face text lives in that stage's own `text`/`aSide` fields, never as a second top-level `cardId()`. Which face is showing is `CardInstance.flipped`, not a different `instance.cardId`. Since `TargetQuery.printedId` matches `instance.cardId` directly (`select.ts:343`), `atLeast(cardsInPlay({categories:["mainScheme"], printedId: TERRESTRIAL_INVASION_1B}), 1)` can never be true — MC16 p. 8's and p. 14's "1 unit if the main scheme is on stage 1B" bonuses always award 0, in every real game, standard or expert. Test: `gmw.qa.test.ts`'s `it.skip("met: the main scheme is actually on stage 1B (Terrestrial Invasion) awards the bonus — ENGINE/CONTENT GAP")`. Owner: `game-rules-architect` (a `TargetQuery` that can read stage identity/`flipped` needs to exist first) then `ability-scripting-engineer` (rewrite `gmw.ts` against it). **Not fixed** — the fix needs a new query shape, not a one-line content edit. **Fixed since:** `CampaignGameQuery` `mainSchemeStageNumber` + `equals` (design §11, "MC16 QA (step 4d)"); both bonuses are `equals(mainSchemeStageNumber, 1)` and the test runs as `"met: the main scheme is still on stage 1B …"` plus a stage-2 miss.
2. **The Collection's "choose 1 card from hand" (RRG 1.8 p. 67 errata) — diagnosed, not a bug.** Driving a real, 2-seat Infiltrate the Museum game (expert campaign) to its first player-phase pause found **4** cards in `state.scenarioAreas["The Collection"]`, not the 2 (1 per seat) `mc16.s2.setup.collection` alone should ever add, and neither seat's hand had shrunk from a hardcoded expectation of 4. Tracing every `cardMoved` event into the area shows the instruction itself fires exactly once per seat, each moving the one card `chooseCards` bound from that seat's own hand — the missing baseline was Infiltrate the Museum's own main scheme, The Grand Collection 1A, whose printed `Setup: Create "The Collection" game area. Put the top card of each player's deck faceup into The Collection` (`packages/cards/src/wave3/gmw/museum.ts`'s `16073a.setup`) runs earlier, at `resolveScenarioSetup`, and already seeds the area with 1 card per seat from the deck — a second, independent, and correct source into the same shared area, not the Collector's discard redirect (nothing discards during setup) and not a double-fire. A 2-seat expert game legitimately ends setup with 4 cards in The Collection (2 from the main scheme's own setup, 2 from this instruction); the "hand unchanged at 5" was likewise measured against a hardcoded absolute (4) rather than each seat's own actual post-mulligan hand size (6). Test: `gmw.qa.test.ts`'s `describe('RRG 1.8 p. 67 errata "When setup ends" — The Collection's hand-card choice')`, now driving the real game and asserting the instruction's own delta (one hand-to-Collection `cardMoved` per seat, in seat order, hand length down by exactly 1) rather than an absolute count. No code change was needed in `gmw.ts`/`museum.ts`; the earlier report's own assertions were the bug.
3. **MC16 p. 5 "Elimination and Victory" is not implemented at the engine level (confirmed engine gap, not new this checkpoint but now proven with a real staged game).** `packages/engine/src/campaign/result.ts`'s `seatsFor` — the function deciding which seats a `record` instruction's `"each"`/`"self"` write applies to — reads only `state.campaign?.seats`; it never consults `PlayerState.eliminated` (`state.ts:175`). A player defeated mid-scenario in a game the team still wins is handed every "each" Victory write exactly like a seat that survived the whole game, the opposite of MC16 p. 5's "does not participate in the Victory steps of that scenario." Ruling June 2, 2026 (3) #1 additionally specifies the healing half explicitly ("Heal identity to printed HP at no cost" for a player defeated in Brotherhood of Badoon, entering Infiltrate the Museum) — a rule `hpSetSetup`'s plain `remainingHitPointsCappedAtBase` read cannot express either, since a defeated identity's own "remaining HP" from that lost attempt is not what the next scenario should read at all. Test: `gmw.qa.test.ts`'s `describe.skip('MC16 p. 5 "Elimination and Victory" — a defeated player skips this scenario's Victory steps (ENGINE GAP)')`. Owner: `game-rules-architect`. **Fixed since:** `CampaignDefinition.elimination` (design §11, "MC16 QA (step 4d)"), declared by `gmw.ts` for expert campaigns with the free rejoin at printed HP; the group runs un-skipped with three tests.

### Rulings checked

- **June 2, 2026 (3)**: all four sub-answers read against `gmw.ts`/the engine. #1 (heal to printed HP at no cost for
  a player defeated in a won scenario) is the uncovered half of Finding 3 above. #2 (campaign setup finishes before
  Collector II's own When Revealed damage) — not independently tested this checkpoint (would need a full Escape the
  Museum setup-into-play drive; flagged, not verified). #3 (multiple copies of the same title in The Collection are
  recorded individually) is consistent with `collection`'s field being a plain `cardList` `append` with no
  title-dedup, but not proven with a live 2-copies-of-one-title case (the Collection hand-choice discrepancy,
  Finding 2, made staging that scenario unreliable this checkpoint). #4 (Escape the Museum removes a _count_ of
  cards from The Collection, not necessarily the exact same instances) matches `gmw.ts`'s own
  `moveCards(campaignLogCards("collection"), "removedFromGame")` reading, not independently re-verified for the
  duplicate-title edge case.

### Files touched, Checkpoint 4

- `packages/cards/src/campaigns/gmw.qa.test.ts` — extended: 6 new `describe` groups (one per item above), ~50 new
  tests. Originally 3 `it.skip`/`describe.skip` findings (stage-1B dead bonus, the Collection discrepancy, the
  elimination gap); all three are now un-skipped (see "Fixed since" notes above and step 4d's own diagnosis of the
  Collection finding).
- `docs/phase7-wave3-qa.md` — this section.

### What this pass did not test

- The full MC16 end-to-end campaign walk with **real, engine-driven** wins at every one of the 5 nodes (this
  checkpoint's own Item 1 drives real games at every node for _setup inspection_, but still advances between nodes
  with a synthetic `winNode`/`applyWin`, the same documented shortcut `trors.qa.test.ts` uses — a genuine,
  engine-recognized win chained across all 5 nodes, the way `trors.qa.test.ts`'s own Crossbones test does for one
  node, was not attempted for all 5 GMW scenarios this pass; time budget).
- Ruling June 2, 2026 (3) #2 and #3 (see "Rulings checked" above) — read against the code, not independently driven.
- Every other value the Collection-choice discrepancy (Finding 2) might also be corrupting (e.g., whether the
  quadrupled Collection area then breaks scenario 3's own `mc16.s3.setup.collection-remove` "search deck/discard/hand
  for each card recorded" instruction) — out of scope once the discrepancy itself couldn't be diagnosed confidently.
