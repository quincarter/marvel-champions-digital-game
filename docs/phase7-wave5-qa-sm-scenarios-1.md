# Phase 7 wave 5 rules-QA pass — Sandman, Venom, Mysterio scenario setup and play (1 of N)

Companion to `docs/phase7-wave5-qa-sm-villains.md` (card-by-card audit). This doc covers the scenario-level setup
audit (villain stages, main-scheme stages, set-aside cards, standard vs. expert) against the MC27 rulebook, and the
standalone-play coverage added by this pass: a 2-player and an expert game per scenario, each played to a real
outcome and replayed to a deep-equal final state.

Rulebook source: `docs/campaign-modes/markdown/mc27_sinister_motives.md` (the transcript of
`mc27_sinister_motives_rules_v5-compressed.pdf`; the PDF itself could not be rendered directly in this worktree —
`pdftoppm`/`pdftotext` are not installed — so page-numbered quotes below cite the transcript's own page headers,
which mirror the PDF's page numbers 1:1).

## 1. Setup audit: standalone (non-campaign) play

Each scenario's _standalone_ setup — the only mode this pass plays, since `campaigns/` is out of scope — is driven
entirely by the villain's 1A Setup and the main scheme's own printed instructions, not by the rulebook's "CAMPAIGN
INSTRUCTIONS" boxes (Public Outcry, Smear Campaign, Community Service side schemes, reputation-track nodes — those
are campaign-only and correctly untouched by `wave5Scenario`/`ghostSpiderScenario` outside campaign mode).

| Scenario | Villain deck (rulebook)                                     | Main scheme deck (rulebook)                       | Required encounter sets (rulebook)                                       | Matches `SM_SCENARIOS`?                                                                                                                                                             |
| -------- | ----------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sandman  | Sandman (I), Sandman (II); expert removes (I), adds (III)   | Hapless Pedestrians (1A/1B)                       | Sandman, City in Chaos, Down to Earth (removable), Standard              | Yes — `sandman/scenario.test.ts` confirms stage (0,1) standard / (1,2) expert; `encounterSetIds` names `sandman`+`city_in_chaos`, `recommendedModularSetIds` offers `down_to_earth` |
| Venom    | Venom (I), Venom (II); expert removes (I), adds (III)       | "Leave Us Alone!" (1A/1B)                         | Venom, Symbiotic Strength, Down to Earth (removable), Standard           | Yes — same stage-index shape; `venom` + `symbiotic_strength` required, `down_to_earth` recommended                                                                                  |
| Mysterio | Mysterio (I), Mysterio (II); expert removes (I), adds (III) | Maze of Mirrors (1A/1B) → Edge of Reality (2A/2B) | Mysterio, Personal Nightmare, Whispers of Paranoia (removable), Standard | Yes — same stage-index shape; `mysterio` + `personal_nightmare` required, `whispers_of_paranoia` recommended                                                                        |

(Rulebook citations: Sandman page 9 lines 479–485, Venom page 11 lines 531–537, Mysterio page 13 lines 591–599 of
the transcript.)

Confirmed in `wave5Scenario`'s test coverage for all three (`describe("wave5Scenario('<id>')")` blocks in each
scenario's own `scenario.test.ts`, already present before this pass):

- Standard mode starts each villain at stage (I)-(II) (`stageIndex`/`lastStageIndex` = `[0, 1]`); expert starts at
  (II)-(III) (`[1, 2]`) — matches "Remove [villain] (I) and add [villain] (III) for expert mode" verbatim for all
  three.
- Expert mode adds Core's Expert encounter set to the deck; standard does not (RRG 1.8 "Modes of Play", Expert
  Mode) — this is a general engine rule, not scenario-specific, but it's re-asserted per scenario since each
  scenario builds its own deck.
- Each scenario's own required non-Standard encounter set(s) are actually in the assembled deck (`City Streets`
  environment with 4 sand counters for Sandman, `Bell Tower` on its Quiet/unflipped side for Venom, a Shifting
  Apparition minion engaged with each player for Mysterio) — these are each scenario's own 1A Setup effect, not the
  campaign box, and they match the card scans read in `docs/phase7-wave5-qa-sm-villains.md` §1.

No standalone-setup discrepancy found against the rulebook for any of the three.

## 2. Playtests added by this pass

`docs/phase7-wave5.md` §2.2 and the existing `scenario.test.ts` files already carried one solo game per scenario
with each hero's own real precon (Ghost-Spider, Spider-Man/Miles Morales) plus one solo game with a Core precon
(Captain Marvel/Leadership), each played by the card-name-agnostic greedy driver (`testing/driver.ts`) to a real
outcome and replayed to a deep-equal final state. **Missing per the task's testing bar: a 2-player game and an
expert-mode game per scenario, each also played to outcome and replay-checked.** Added in this pass (all in the
existing `scenario.test.ts` files, `sandman`/`venom`/`mysterio`):

| Scenario | New test                                                | Seed | Result (`GameOutcome`)      | Rounds | Commands |
| -------- | ------------------------------------------------------- | ---- | --------------------------- | ------ | -------- |
| Sandman  | 2p: Ghost-Spider + Spider-Man (Miles Morales), standard | 2028 | loss, `mainSchemeCompleted` | 6      | 128      |
| Sandman  | solo expert: Ghost-Spider                               | 2029 | loss, `allPlayersDefeated`  | 2      | 26       |
| Venom    | 2p: Ghost-Spider + Spider-Man (Miles Morales), standard | 2028 | loss, `mainSchemeCompleted` | 9      | 176      |
| Venom    | solo expert: Ghost-Spider                               | 2029 | loss, `allPlayersDefeated`  | 3      | 45       |
| Mysterio | 2p: Ghost-Spider + Spider-Man (Miles Morales), standard | 2028 | loss, `mainSchemeCompleted` | 9      | 228      |
| Mysterio | solo expert: Ghost-Spider                               | 2029 | loss, `allPlayersDefeated`  | 5      | 47       |

Every one of these 6 new games: reaches a non-null `GameOutcome`, plays at least 1 round, and its logged session
replays (`replay(session.log, WAVE5_DEPS)`) to a state that is `toEqual` the live session's final state — the same
determinism/replay-fidelity bar the existing solo tests already used (`wave4/mts/thanos-e2e.test.ts`'s shape).

**All 6 new games end in a loss, not a win.** This is expected and not a signal of a scripting bug: the greedy
driver (`testing/driver.ts`'s own docblock) "knows no card names" and plays a fixed, simple heuristic (recover/change
form, play cheapest-payable cards, use actions, basic thwart/attack, end turn) — it isn't a competent Marvel
Champions player, and every other e2e test in this codebase that uses it (`thanos-e2e.test.ts`, the Sinister Six
`scenario.test.ts`'s own solo/2-player games, the other wave 5 QA passes' own playthroughs) accepts a loss as a valid
outcome for the same reason. What these tests actually prove is that a full game — villain-phase activations, boost
cards moving on and off identities, side-scheme completion, main-scheme stage flips, expert-mode stat/threat
differences, indirect/overkill damage rules — runs start to finish without an engine crash or an illegal-state
assertion, and that the exact same sequence of commands replays to the exact same final state. That is real
regression coverage for "did this change alter behavior," even though it says nothing about scenario difficulty
balance.

Command counts and round counts differ meaningfully between standard and expert games in the expected direction
(expert games end in far fewer rounds and commands — 2–5 rounds vs. 6–9 — because the greedy driver, with no
form-change or defensive strategy beyond its fixed heuristic, gets run over faster by boosted expert-mode stats and
extra threat/HP). This is a weak but real signal that expert mode is actually harder in the engine's own simulation,
not just cosmetically labeled — consistent with RRG 1.8's Expert Mode description.

## 3. Findings list

No engine bugs, card-script bugs, or unresolved rules conflicts were found in the three scenarios' own setup,
villain stages, main schemes, or required modular sets (City in Chaos, Symbiotic Strength, Personal Nightmare) in
this pass. One item is flagged, not fixed, per the task's scope boundary:

1. **Doc-naming discrepancy, not a rules bug.** The task named this audit's first deliverable
   `docs/phase7-wave5-qa-sm-heroes.md`; that file already exists (committed 46e9e7c6) and covers Ghost-Spider/Miles
   Morales's own hero kits, a different scope. Wrote the villain/scenario audit to
   `docs/phase7-wave5-qa-sm-villains.md` instead rather than overwrite a completed, differently-scoped pass.
2. **Campaign-mode rules question (not fixed — `campaigns/`/engine campaign files are out of this pass's scope, and
   this file doesn't touch them): the reputation track's shared "search for a scenario-specific side scheme" Setup
   node has nothing to find during the Mysterio scenario**, since Mysterio's own encounter set genuinely has no side
   scheme (confirmed against MarvelCDB's own `sm` set listing, not just our data — see
   `docs/phase7-wave5-qa-sm-villains.md` §1.4 for the full writeup and a recommended default). Reported for whoever
   owns campaign scenario-specific-side-scheme handling (`packages/engine/src/scenario-specific-query.test.ts`
   exists in this worktree already, mid-edit by a concurrent agent — not read or touched by this pass since it's
   outside this task's scope, but plausibly the right place to route this finding).
3. No `it.fails`/`KNOWN_SKIPPED` was added by this pass — no gap was found in these three scenarios' own scripts that
   needed one.

## 4. Test/commit record

- Added 6 tests (2-player + expert-mode playthrough, each with replay deep-equal) across
  `packages/cards/src/wave5/sm/{sandman,venom,mysterio}/scenario.test.ts`.
- Full `@mc/cards` suite before this pass's changes: 313 files, 3525 passed, 1 expected fail (pre-existing, unrelated
  to this scope). After adding the 6 new tests: 22/22 passing in the three touched files, run in isolation
  (`pnpm exec vitest run src/wave5/sm/{sandman,venom,mysterio}/scenario.test.ts`), each finishing well under its
  180s timeout (slowest: 3.0s, the Venom 2-player game).
