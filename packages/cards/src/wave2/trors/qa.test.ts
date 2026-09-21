import { cardId } from "@mc/content";
import { createGame } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  settle,
  toHero,
} from "../../testing/harness.js";
import { stackSetAsideBehindBoost } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game } from "../testing.js";

/**
 * rules-qa-engineer wave 2 pass over `trors` (docs/phase7-wave2-qa.md has the full report). Bugs proven here are
 * reported to their owning specialist, not fixed here (see that doc's CLAUDE.md-mandated ownership boundary).
 */

const hawkeyeVsRhino = () =>
  startWave2Game(wave2Scenario("rhino", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 11 }));

/**
 * Ruling-tied regression: Feb 28, 2026 ruling ("Marked for Death & Mister Knife Surge Timing", answer 1 —
 * superseding an older, outdated ruling) on Marked for Death (04028, errata RRG 1.8 p. 66): "When Marked for Death
 * is revealed, search only for Clint Barton's identity-specific Mockingbird and tuck her underneath. While tucked,
 * she is out of play and does not affect uniqueness. When defeated, only the tucked Mockingbird returns to hand."
 *
 * `hawkeye.test.ts` already pins the *reveal* half against this exact ruling (both "finds her in the deck" and
 * "finds her already in play, takes her out of it, and tucks the resulting instance" — the case the ruling exists
 * to answer, since an older ruling apparently blocked exactly this). Nothing pins the *second* sentence — "when
 * defeated, only the tucked Mockingbird returns to hand" — at all: `04028.when-defeated` is
 * `whenDefeated(moveCards(tuckedUnder(self), "hand"))` (`hawkeye-obligation-nemesis.ts`), which reads the tucked
 * card off Marked for Death itself rather than searching for "a" Mockingbird again, so it can only ever return the
 * one that was actually tucked — this test proves that end to end (reveal, tuck, defeat, hand) rather than trusting
 * the shape of the effect alone.
 */
test("Marked for Death (04028): When Defeated returns the tucked Mockingbird to hand (ruling, Feb 28, 2026, answer 1; errata RRG 1.8 p. 66)", () => {
  const staged = stackSetAsideBehindBoost(hawkeyeVsRhino(), "04028");
  const hero = runWave2(staged, toHero());
  const revealed = settle(runWave2(hero, endTurn()), firstLegal, undefined, WAVE2_DEPS);
  const marked = instancesOf(revealed, "04028").find((id) => revealed.villainArea.includes(id));
  if (!marked) throw new Error("Marked for Death never entered play");
  const tucked = inst(revealed, marked).tucked;
  expect(tucked).toHaveLength(1);
  const mockingbird = tucked[0]!;

  // Defeat the scheme (a real basicThwart, not surgery, so the engine's own defeat/When Defeated pipeline runs):
  // patch its threat down to Hawkeye's printed THW so a single thwart finishes it, isolating the When Defeated
  // effect from the thwart itself, the same pattern `crossbones.test.ts` uses.
  const identity = identityOf(revealed);
  const ready = patchInstance(patchInstance(revealed, marked, { threat: 1 }), identity, { exhausted: false });
  const defeated = settle(
    runWave2(ready, { type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: marked }),
    firstLegal,
    undefined,
    WAVE2_DEPS,
  );
  expect(playerOf(defeated, P1).hand).toContain(mockingbird);
  expect(inst(defeated, mockingbird).cardId).toBe(cardId("04004"));
});

/**
 * BLOCKER — card script (owner: `ability-scripting-engineer`, card 04146 "Hydra Jet-Trooper",
 * `packages/cards/src/wave2/trors/red-skull.ts`): its Boost ability causes unbounded recursion that crashes the
 * game in ordinary, non-adversarial solo play, in *any* scenario that includes the `hydra_assault` modular set
 * (Crossbones and Red Skull both do — `packages/content/src/data/trors/scenarios.ts`'s `recommendedModularSetIds`).
 *
 * **Corrected diagnosis** — a previous pass at this same file blamed this crash on Crossbones' Assault (04070)'s
 * `whenDefeated` and the engine's `additionalResolution` trigger-matching guard (`triggers.ts:26`). That diagnosis
 * was independently re-checked and is wrong: `crossbones.test.ts`'s own unit test defeats 04070 in isolation and
 * passes cleanly (no recursion), and instrumenting `pushFrames` (a temporary `vi.spyOn` over
 * `packages/engine/src/ctx.ts`, removed after use) on both cited seeds (3001 and 4001) shows the actual repeating
 * ability at the moment of the crash is `04146.boost`, not `04070.when-defeated`, in both cases. 04070 is not
 * involved in the crash at all; the two are coincidentally similar-shaped card texts (both script an
 * out-of-sequence villain attack) in the same pack.
 *
 * Printed text (04146, "Hydra Jet-Trooper", minion, `hydra_assault` encounter set, quantity 2, star-icon Boost):
 * "Quickstrike.\n[star] Boost: If you are in hero form, the villain attacks you after this activation. Do not deal
 * any boost cards for that attack." Scripted (`red-skull.ts` `04146.boost`) as
 * `boost(ifThen({ kind: "form", player: you, form: "hero" }, enemyAttack(theVillain, { against: you })))` — a
 * plain `enemyAttack` with none of the printed text's two extra clauses applied: not "after this activation" (the
 * engine's `EffectSpec.enemyAttack.after: "currentActivation"`, `packages/engine/src/spec.ts` line ~818, "the
 * newly initiated activation resolves after the current activation has finished resolving") and not "do not deal
 * any boost cards for that attack" (`EffectSpec.enemyAttack.boost: false`, `spec.ts` line ~809, "'That attack does
 * not get a boost card' (Escaped Convict) / 'do not give the villain a boost card' (I See You)"). The `enemyAttack`
 * DSL wrapper in `dsl/effects.ts` doesn't expose either field, which is exactly why a `wave1/twc/local.ts` helper,
 * `enemyAttackAfterThisNoBoost`, already exists for the *identically worded* Escaped Convict (07009, "Surge. [star]
 * Boost: … If you are in hero form, that villain attacks you after this attack. That attack does not get a boost
 * card.") — `wrecker.ts`'s `"07009.boost": boost(setActiveVillain(leastThreatVillain), ifThen(isHero(),
 * enemyAttackAfterThisNoBoost(theVillain, you)))`. 04146 needed the same treatment and didn't get it.
 *
 * Why the missing `boost: false` is exactly what recurses: 04146.boost resolves *while a boost card is being
 * counted for an ongoing villain attack* (`packages/engine/src/resolve/enemy-activation.ts`'s `stepBoostCard`,
 * `flipBoosts` stage). Its own effect starts a brand-new villain attack with no `boost: false`, so that new
 * attack's own `giveBoost` stage deals *it* a boost card too (Crossbones `getsBoostCard`, RRG 1.8 "Boost, Boost
 * Icon" p. 11: "the villain is given one facedown card from the encounter deck"). Confirmed by instrumenting
 * `pushFrames`: every single cycle re-deals and re-flips the exact same 04146 copy (instance `i70` in seed 3001,
 * `i71` in seed 4001) as that new attack's own boost card, whose Boost ability is Hydra Jet-Trooper's own — which,
 * in hero form, starts yet another un-de-boosted attack, forever. And independently confirmed causal, not just
 * correlated: patching *only* `04146.boost`'s effect in a throwaway `EngineDeps` (adding `boost: false` and
 * `after: "currentActivation"`, nothing else) made seed 3001 finish cleanly (a loss, 33 commands, round 4) instead
 * of crashing.
 *
 * Observed (unpatched): driving a plain, deterministic solo Crossbones game (`../../testing/driver.ts`'s
 * card-name-agnostic greedy player — no adversarial or hand-picked inputs) with seed 3001 succeeds for 31 commands,
 * then the 32nd command (a `resolveChoice`) returns `internal_error: flow did not settle at
 * villain/revealEncounterCards` (`packages/engine/src/flow.ts`'s `MAX_STEPS_PER_COMMAND` = 5000 safety valve
 * firing). Seed 4001 hits the same pattern at a different outer context (`villain/enemyActivations`). In an
 * 11-seed sample of otherwise-ordinary solo Crossbones games, 2 hit this (seeds 3001, 4001) — not a rare edge case
 * once Hydra Jet-Trooper is in the encounter deck and a hero is in hero form when it comes up as a boost card.
 *
 * Authority: the card's own printed text is the rule being implemented, and it already states the fix ("do not
 * deal any boost cards for that attack") — this is a card-script omission, not an engine gap or a disputed ruling.
 *
 * Fixed 2026-09-21: `04146.boost` now passes `afterCurrentActivation` and `noBoost` (`dsl/effects.ts`'s
 * `enemyAttack`). This was a `test.fails` until then; it stays as the regression.
 */
test("Crossbones (standard), solo, seed 3001: a deterministic greedy game does not crash on Hydra Jet-Trooper's Boost (04146)", () => {
  const config = wave2Scenario("crossbones", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 3001 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  expect(result.outcome).not.toBeNull();
}, 60_000);
