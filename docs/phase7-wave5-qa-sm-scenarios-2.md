# Phase 7 wave 5 rules-QA pass — The Sinister Six and Venom Goblin scenario setup and play (2 of N)

Companion to `docs/phase7-wave5-qa-sm-villains-2.md` (card-by-card audit) and the mirror of
`docs/phase7-wave5-qa-sm-scenarios-1.md`'s format/depth for the box's two remaining scenarios. Covers the
scenario-level setup audit (villain stages, main-scheme stages, set-aside cards, standard vs. expert) against the
MC27 rulebook, plus the standalone-play coverage this pass adds. Out of scope, per the task's boundary:
`campaigns/`, engine files, client files, and `spdr/sinister-syndicate.*` (another agent's work).

Rulebook source: `docs/campaign-modes/markdown/mc27_sinister_motives.md` (the transcript of
`mc27_sinister_motives_rules_v5-compressed.pdf`, page-numbered quotes below cite the transcript's own page headers,
which mirror the PDF's page numbers 1:1).

## 1. Setup audit: standalone (non-campaign) play

| Scenario         | Villain deck (rulebook)                                                                                                                                                         | Main scheme deck (rulebook)                                                               | Required encounter sets (rulebook)                                                                                                  | Matches `SM_SCENARIOS`?                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Sinister Six | Doctor Octopus (I), Electro (I), Hobgoblin (I), Kraven the Hunter (I), Scorpion (I), Vulture (I) — no expert-mode swap; the box's only scenario with several one-stage villains | Sinister Synchronization (1A/1B) → Sinister Beatdown (2A/2B)                              | The Sinister Six, Guerrilla Tactics, Standard                                                                                       | Yes — `sinister-six/scenario.test.ts` confirms `players+1` villains random into play, the lowest activation order holding the counter, 4/5/6 set aside by player count, `victory: "cardAbility"`; `SM_SCENARIOS`'s own `encounterSetIds` names `sinister_six` + `guerrilla_tactics`, `recommendedModularSetIds: []` (matches "no modular set is listed" — rulebook line 663) |
| Venom Goblin     | Venom Goblin (I), Venom Goblin (II); expert removes (I), adds (III)                                                                                                             | Skies Over New York (A) → Lower Manhattan (B), Midtown Manhattan (C), Upper Manhattan (D) | Venom Goblin, **Symbiotic Strength (required, not just recommended)**, Goblin Gear (removable via scenario customization), Standard | Yes — `venom-goblin/scenario.test.ts` confirms stage 1/2 standard/expert, Lower/Midtown/Upper in play with the glider on Midtown; `SM_SCENARIOS`'s `encounterSetIds` correctly names `venom_goblin` + `symbiotic_strength` (both always-required), `recommendedModularSetIds: [goblin_gear]` (removable, matching rulebook line 735's own wording exactly)                   |

(Rulebook citations: The Sinister Six page 15 line 663; Venom Goblin page 17 lines 731–735.)

**Confirmed correct: Venom Goblin's required-vs-recommended encounter-set split.** The rulebook's own line 735 —
"The Goblin Gear modular set can be removed from this scenario and/or added to other scenarios when using scenario
customization rules. The Symbiotic Strength modular set can be used in other scenarios but is required while
playing the Venom Goblin scenario." — is a real, easy-to-miss distinction (most of the box's other scenarios list
one always-required set), and `packages/content/src/data/sm/scenarios.ts`'s `venom-goblin` record gets it right:
`symbiotic_strength` lives in `encounterSetIds` (always built in, regardless of any `modularSetIds` override a
caller passes), while `goblin_gear` is only `recommendedModularSetIds` (the default when no override is given, but
replaceable). Checked directly against `wave5Scenario`'s own `buildSmSingleVillain`: `sets = [...encounterSetIds,
...(options.modularSetIds ?? recommendedModularSetIds), ...difficultyEncounterSetIds]` — an override to
`modularSetIds` can only ever replace the Goblin Gear slot, never drop Symbiotic Strength. No bug found here; flagged
in this doc because it is exactly the kind of "looks like a modular set but is actually required" trap this
project's testing bar asks to prioritize.

No other standalone-setup discrepancy found against the rulebook for either scenario. Both correctly skip the
rulebook's own "CAMPAIGN INSTRUCTIONS" boxes (reputation-track nodes, Waking Nightmare, the "Expert Campaign Only"
loss-the-campaign clause at Venom Goblin page 17 line 763) — none of that is built by `wave5Scenario` outside
campaign mode, matching `-scenarios-1.md`'s own finding for the first three scenarios.

## 2. Playtests added by this pass

Both scenarios already carried, before this pass: a solo game with each hero's own real precon (Ghost-Spider) and a
solo game with a Core precon (Captain Marvel/Leadership), plus a 2-player game (Ghost-Spider + Spider-Man/Miles
Morales, standard) — all played by the card-name-agnostic greedy driver (`testing/driver.ts`) to a real outcome and
replayed to a deep-equal final state. **Missing per the task's testing bar: an expert-mode game per scenario.**
Added in this pass (both in the existing `scenario.test.ts` files):

| Scenario         | New test                  | Seed | Result (`GameOutcome`)        | Rounds | Notes                                                                                                                                                                            |
| ---------------- | ------------------------- | ---- | ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Sinister Six | solo expert: Ghost-Spider | 2029 | `loss`, `mainSchemeCompleted` | 4      | Exercises expert-only incite/surge text on Frequent Flyers, High Fashion, Robotic Enhancements, Surprise!, and Life-Size Decoy's toughness, and Core's own Expert encounter set. |
| Venom Goblin     | solo expert: Ghost-Spider | 2032 | `loss`, `mainSchemeCompleted` | 5      | Reaches Venom Goblin (III)'s Retaliate 1/Stalwart/Toughness and its own 3-facedown-encounter-card When Revealed, and Symbiotic Strength/Goblin Gear's expert-only clauses.       |

Both new games: reach a non-null `GameOutcome`, play at least 1 round, and their logged sessions replay
(`replay(session.log, WAVE5_DEPS)`) to a state `toEqual` the live session's final state — the same
determinism/replay-fidelity bar `-scenarios-1.md` used. Both end in a loss, for the same reason `-scenarios-1.md`
§2 documents at length for its own six games: the greedy driver is a fixed, simple heuristic, not a competent
player, and every e2e test in this codebase that uses it accepts a loss as a valid outcome. What these two games
prove is that a full expert-mode game — set-aside villains entering and leaving play (The Sinister Six), the
Ambush! interrupt firing with no villain in play, the glider counter moving between several main schemes each
villain-phase step one (Venom Goblin), expert-only incite/surge/toughness text — runs start to finish without an
engine crash or an illegal-state assertion, and replays exactly.

## 3. Findings list

No engine bugs, card-script bugs, or unresolved rules conflicts were found in either scenario's own setup, villain
stages, main scheme, required encounter sets, or the modular sets this pass covers (Guerrilla Tactics, Goblin Gear,
Osborn Tech, Sinister Assault, Down to Earth, Whispers of Paranoia — see
`docs/phase7-wave5-qa-sm-villains-2.md` for the card-by-card audit). Nothing needed an `it.fails`/`KNOWN_SKIPPED`
pin in this pass's scope.

## 4. Test/commit record

- Added 2 tests (expert-mode playthrough with replay deep-equal) in `packages/cards/src/wave5/sm/sinister-six/
scenario.test.ts` and `packages/cards/src/wave5/sm/venom-goblin/scenario.test.ts`.
- Full suite for the scope this pass touched, run in isolation
  (`pnpm exec vitest run packages/cards/src/wave5/sm/{sinister-six,venom-goblin,modulars}`): 17 files, 206 tests
  passing before this pass's additions (all pre-existing coverage, unmodified); 208 passing after (22/22 in the
  two touched `scenario.test.ts` files specifically), each run well within its own timeout (slowest new test: the
  Venom Goblin expert game at 1.6s).
- `pnpm --filter @mc/cards typecheck` clean.
