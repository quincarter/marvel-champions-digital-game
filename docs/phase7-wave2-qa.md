# Phase 7 wave 2 rules-QA pass

`rules-qa-engineer` independent QA pass over wave 2 (cycle 1: `trors`, `toafk`, `ant`, `wsp`, `qsv`, `scw`), building
on a prior interrupted pass whose uncommitted e2e/qa test files this pass reviewed, corrected, and completed. Per
the standing ownership boundary: this pass finds and proves bugs with tests; it does not fix engine or card-script
code. Every finding below cites the printed text and the authority (RRG 1.8 page or a dated post-1.7 ruling) it
was checked against.

## Coverage

### Smoke games (task item 1)

Every wave 2 hero precon and every `trors` scenario now has at least one seeded, headless, full game to a real win
or loss, replayed from its log to a deep-equal final state (`replay(...)` vs. the live session state), with no
stuck `PendingChoice` and no engine-invariant error — except the one proven blocker below.

| Pack | Hero(es) | Scenario(s) | Games | File |
|---|---|---|---|---|
| `trors` | Hawkeye, Spider-Woman | Rhino (Core) | 2 solo | `trors/e2e.test.ts` |
| `trors` | Hawkeye, Spider-Woman | Crossbones (standard) | 1 setup-only + 1 2-player outcome | `trors/e2e.test.ts` |
| `trors` | Spider-Woman, Hawkeye | Absorbing Man, Taskmaster, Zola, Red Skull (standard) | 4 solo | `trors/e2e.test.ts` |
| `trors` | Hawkeye | Absorbing Man (**expert**) | 1 solo | `trors/e2e.test.ts` |
| `toafk` | Hawkeye; Hawkeye + Spider-Woman | Kang (standard) | 1 solo + **1 2-player** | `toafk/e2e.test.ts` (new this pass) |
| `ant` | Ant-Man | Rhino (Core) | 1 solo | `ant/e2e.test.ts` (pre-existing, verified) |
| `wsp` | Wasp | Rhino (Core) | 1 solo | `wsp/e2e.test.ts` (new this pass) |
| `qsv` | Quicksilver | Rhino (Core) | 1 solo | `qsv/e2e.test.ts` (new this pass) |
| `scw` | Scarlet Witch | Rhino (Core) | 1 solo | `scw/e2e.test.ts` (new this pass) |

Crossbones (standard, solo, seeds 3001/4001) is the one scenario that does **not** reach an outcome — see Finding 1.
2-player coverage exists for Kang (task's explicit requirement) and for Crossbones; the other four `trors`
scenarios and `ant`/`wsp`/`qsv`/`scw` are solo-only this pass (time budget; flagged under "not checked" below).

### Card text vs. script audits (task item 2)

Full line-by-line `pnpm card` vs. script comparisons, all clean (target, "you" vs. "each player", may/must, timing
word, cost vs. effect, keyword):

- **Ant-Man kit**, all three identity faces + kit (12001a/b/c, 12002–12010, 12020, `ant/kit.ts`) — every form-change
  and Giant/Tiny-gated ability matches printed text exactly.
- **Wasp kit** (13001a/b/c, 13002–13006, `wsp/kit.ts`) — same, including the divided-power (`Wasp Sting`/`Giant
  Help`) and interrupt-timed form-change (`Rapid Growth`) cards.
- **Crossbones' Assault** (04070) and **Hydra Jet-Trooper** (04146) — see Findings below; both audited to the
  point of a minimal, causally-confirmed repro, not just a text read.
- **Marked for Death** (04028) — audited against its own errata (RRG 1.8 p. 66) and the ruling below; both halves
  ("When Revealed" search/tuck and "When Defeated" return-to-hand) now have a passing test.
- **Twisted Reality** (04135, `red-skull.ts`) — its own docblock admits scripting a printed "Forced Interrupt" as a
  `forcedResponse` (RRG's `schemeDefeated` isn't in the engine's interruptible-event list). Re-checked: the effect
  ("deal the first player an encounter card") has nothing to prevent or redirect about the defeat it reacts to, so
  a response produces the same observable outcome a moment later — verified correct, not a bug. Flagged only as a
  "watch" item: if a future card ever wants a genuine Interrupt on the *same* `schemeDefeated` event to prevent or
  redirect something, the timing gap (interrupt-vs-response priority) would matter then, in a way it doesn't for
  this card today.
- **Kang's stage structure and villain uniqueness across game areas** (`toafk/kang.ts`, `packages/engine/src/
  unique.ts`, `packages/engine/src/resolve/game-areas.ts`) — deep dive (see Finding 3 / "not checked" below): Kang
  (I) (11001) and Kang (III) (11006) print the identical unique title "Kang (The Conqueror)". Re-checked against
  the Jan 26, 2026 ruling ("Kang Titles") and RRG 1.8's own "Unique Icon" text (transcribed verbatim in `unique.ts`):
  the RRG's "cannot enter play" clause enumerates only player cards and non-villain encounter cards, so villains are
  categorically exempt from uniqueness-blocking — confirmed in the engine (`addVillains` never calls
  `matchingCardInPlay`; `duplicateUniqueFrames`'s own area-merge sweep explicitly skips `card.type === "villain"`).
  **No bug** — the design is sound — but see the coverage gap noted below: nothing exercises this with the real
  cards end to end.

### Ruling-tied regression tests (task item 3)

Searched `marvel-champions-rulings-post-rrg-1-7.md` for entries naming or clearly bearing on wave 2 content
(grepped every wave 2 hero/villain/pack name; did not read all 1139 lines end to end — see "not checked").

| Ruling | Bears on | Result |
|---|---|---|
| Jan 26, 2026, Ruling 4, answer 6 ("Kang Titles") | Kang (I)/(III) both "Kang (The Conqueror)", `toafk` | Verified consistent with engine design (see above). No new test added — the existing design has no test exercising the real cards in this exact configuration; noted as a gap, not pinned as a passing regression, since building the real multi-area state was out of this pass's budget. |
| Feb 28, 2026, Ruling 7, answer 1 ("Marked for Death & Mister Knife Surge Timing") | Marked for Death (04028), `trors`/Hawkeye nemesis set | **New passing test**: `trors/qa.test.ts`, "Marked for Death (04028): When Defeated returns the tucked Mockingbird to hand". The reveal half (search/tuck, including "already in play" — the exact case an older, now-superseded ruling used to block) was already pinned in `hawkeye.test.ts`; nothing covered the defeat/return-to-hand half at all. |

## Findings

**Finding 1 was fixed on 2026-09-21**, the same day it was proven: `04146.boost` now passes `afterCurrentActivation` and `noBoost` through `dsl/effects.ts`'s `enemyAttack`, and its test in `trors/qa.test.ts` is a plain `test` again (cards: 715 passed, no expected fails). The row is kept as the record of what was wrong. No open blocker remains from this pass.

| # | Card / mechanism | Printed text | Observed | Authority | Owner | Test | Ships? |
|---|---|---|---|---|---|---|---|
| 1 | **04146 "Hydra Jet-Trooper"** (`hydra_assault` modular set, `trors/red-skull.ts`) | "Quickstrike. [star] Boost: If you are in hero form, the villain attacks you after this activation. Do not deal any boost cards for that attack." | `04146.boost` starts a new villain attack with no `boost: false` and no `after: "currentActivation"`. That new attack's own `giveBoost` step deals it a boost card, which can be the same/another copy of 04146, whose Boost fires again — unbounded recursion, crashing the game (engine's `MAX_STEPS_PER_COMMAND` safety valve fires, `internal_error`). Reproduced deterministically (seeds 3001, 4001 of a plain, non-adversarial solo Crossbones game), and confirmed causal (not merely correlated) by patching only this one ability's effect in a throwaway `EngineDeps` — the patched version finishes the same seed cleanly. | Card's own printed text (the missing clauses); RRG 1.8 "Boost, Boost Icon" p. 11 (villains get a boost card at every activation, no printed exception unless the source says so). Not a disputed ruling — the card text already states the needed exception. | `ability-scripting-engineer` — script `04146.boost`'s effect with `boost: false` and `after: "currentActivation"`, e.g. reusing/mirroring `wave1/twc/local.ts`'s `enemyAttackAfterThisNoBoost` (already built for the *identically worded* Escaped Convict, 07009). | `trors/qa.test.ts`, `test.fails(...)` | **BLOCKER** — affects any scenario recommending `hydra_assault` (Crossbones **and** Red Skull, both live `trors` scenarios), in ordinary solo play, not an edge case. |
| 2 | (meta-finding, not a card bug) Prior QA pass's diagnosis of Finding 1 | — | The interrupted pass's `qa.test.ts` blamed the same crash on Crossbones' Assault (04070)'s `whenDefeated` and an engine trigger-matching guard (`triggers.ts:26`), assigning it to `game-rules-architect`. Re-checked independently: 04070 in isolation (`crossbones.test.ts`'s own unit test) defeats cleanly with no recursion; instrumenting `pushFrames` (temporary `vi.spyOn`, removed) on both cited seeds shows the actually-repeating ability is `04146.boost` in both cases, never `04070.when-defeated`. | — | — corrected in place, not routed anywhere | `trors/qa.test.ts` docblock rewritten with the corrected diagnosis and the instrumentation/patch evidence | N/A — this is a report correction: **do not** hand Finding 1 to `game-rules-architect`; it is a card-script fix. |
| 3 | Kang's stage-2→3 "separate game areas" split (`toafk/kang.ts`, `11008a`/`11008b`) | "Each player reveals a random stage 3A in turn order" / "Create your own game area…" | Not exercised end to end by any test with the real cards. `packages/engine/src/game-areas.test.ts` proves the *primitive* with a synthetic stub scenario; both this pass's Kang e2e games (solo, 2-player) end in an early `allPlayersDefeated` loss (round 2 / round 5) well before Kang (I)'s large per-player HP pool is worn down enough to trigger the split. | RRG 1.8 "Activation"/"Unique Icon" (as engaged above); no ruling conflict found | `rules-qa-engineer` (this pass) — coverage gap, not a bug | none added this pass | **Non-blocker, but flagged**: the scenario's single most novel mechanic has no integration-level proof with real content, only a synthetic engine stub. Recommend a follow-up test that patches Kang's HP down (mirroring `zzz-debug`-style surgery already used to verify Finding 1) to cheaply force the split and assert both a same-named villain in two areas and the eventual area-merge duplicate-discard sweep. |
| 4 | Twisted Reality (04135) Interrupt-as-Response | "Forced Interrupt: when attached side scheme is defeated" | Scripted as `forcedResponse`, per the card's own docblock (justified: `schemeDefeated` isn't in the engine's interruptible-event list, and the effect has nothing to prevent/redirect). Re-checked and confirmed correct today. | RRG 1.8 pp. 5, 38 (timing windows) | — | none needed (already correct) | **Non-blocker** — watch item only, for future cards on the same event. |

## What could not be checked (time budget)

- **Quicksilver and Scarlet Witch kits**: smoke-tested only (one Rhino solo game each); no line-by-line printed-text
  audit this pass, unlike Ant-Man/Wasp/Hawkeye.
- **Taskmaster, Absorbing Man, Zola, Red Skull**: spot-checked a handful of stage/main-scheme abilities each
  (enough to rule out the same `boost: false`/`after` recursion pattern elsewhere in the pack — confirmed 04146 is
  the *only* `enemyAttack`/`enemyScheme` usage in all of wave 2 that resolves from inside another activation's own
  `flipBoosts` window; every other usage is from a `whenRevealed`/hero-action/`whenDefeated` context and is not at
  risk of the same recursion) but not a full stage-by-stage text diff the way Crossbones/Kang got.
- **2-player games** for Absorbing Man, Taskmaster, Zola, Red Skull, and for `ant`/`wsp`/`qsv`/`scw`: solo-only
  this pass.
- **Kang expert mode** (11040–11051): unscripted by the pack's own docblock admission; out of scope.
- **Full rulings-doc read**: searched by name (every wave 2 hero/villain), not read start to finish; a ruling that
  bears on a shared keyword (Toughness, Retaliate, boost/star-icon mechanics in general) without naming a wave 2
  card by name could have been missed.
- **Finding 3's own repro**: identified as a gap, not built into a passing/failing test — would need either a long
  driven game or new HP-patching surgery, and the effort budget favored the two confirmed, causally-proven findings
  above over a third partially-built one.

## Test counts

- `pnpm --filter @mc/cards typecheck` — clean.
- `pnpm --filter @mc/cards test` — **714 passed, 1 expected fail** (91 files). The expected fail is Finding 1
  (`trors/qa.test.ts`, `test.fails`).
- `pnpm --filter @mc/engine test` — **754 passed** (62 files), untouched by this pass.

## Files touched this pass

- `packages/cards/src/wave2/trors/qa.test.ts` — corrected Finding 1's diagnosis/citation (was misattributed to
  04070/engine by the interrupted prior pass) and added the new Marked for Death ruling regression.
- `packages/cards/src/wave2/trors/e2e.test.ts` — updated the one comment that repeated the old misdiagnosis.
- `packages/cards/src/wave2/{qsv,scw,toafk,wsp}/e2e.test.ts` — reviewed as-is from the prior pass (unchanged); `ant`
  already had one.
- `docs/phase7-wave2-qa.md` — this report (new).
