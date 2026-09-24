import { cardId } from "@mc/content";
import { createGame, type GameState } from "@mc/engine";
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
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { stackSetAsideBehindBoost } from "../../testing/staging.js";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";
import { runWave2, startWave2Game } from "../testing.js";

/**
 * Wave 3 §3.2's own docblock (docs/phase7-wave3.md §3.2, "Wave 2 bug found on the way") flagged this as a live bug:
 * three `trors` main schemes scripted "After resolving step one of the villain phase" as
 * `on.threatPlaced(query("mainScheme"))` (None Shall Pass 1B `04079b`, Hunting Down Heroes `04096b`, The Mad
 * Doctor 2B `04113b`) instead of the villain-phase-round-structure primitive built for exactly this wording this
 * wave, `on.villainStepResolved("placeThreat")` (`villainStepResolved { step: "placeThreat" }` in the engine,
 * docs/phase7-wave3.md §3.2, landed, commit `6ebb61f`). `on.threatPlaced` fired on *every* threat placement on the
 * main scheme (any source, any step), not once per villain phase.
 *
 * Printed text (Red Skull rulebook, spoiler edition, p. 10, Taskmaster's Hunting Down Heroes): "Forced Response:
 * After resolving step one of the villain phase, each hero must choose to either place 1 threat on Hunting Down
 * Heroes or take 1 damage." That is a single event per villain phase (RRG 1.8 "Round Overview" p. 4, "step one"),
 * so the Forced Response resolves exactly once per villain phase — RRG 1.8 "Forced" (p. 20): a forced ability
 * "must be triggered" by its triggering condition, which here is the villain phase's step one, not any later
 * `placeThreat` on the same card (Hunting Down Heroes' own "place 1 threat here" branch places threat on itself,
 * so on the old wiring it *retriggered its own Forced Response* the moment that branch was chosen; None Shall
 * Pass's delay counters and The Mad Doctor's test counters likewise accumulated on any threat placed on the main
 * scheme by any other source in the same villain phase, not only once).
 *
 * **Fixed** (docs/phase7-wave3.md §5): all three now trigger on `on.villainStepResolved()`
 * (`absorbing-man.ts`/`taskmaster.ts`/`zola.ts`). The tests below replace the earlier structural `test.fails` pin
 * with live, full-game repros of exactly the three properties the fix has to hold: fires once per villain phase,
 * ignores threat placed by another source in the same phase, and (Hunting Down Heroes specifically) doesn't
 * retrigger from its own "place 1 threat here" branch.
 */
describe("trors step-one main schemes fire on villainStepResolved, not on every threatPlaced(mainScheme)", () => {
  const ADVANCE = "01186";
  /** "When Revealed: Discard an upgrade or support you control. If no cards were discarded this way, this card
   * gains surge." No threat effect of its own and no form condition — a clean step-two filler for exact-count
   * assertions, so the only main-scheme threat in the round is step one's acceleration plus the ability under test. */
  const CLEAN_FILLER = "01188";

  it("None Shall Pass (04079b.none-shall-pass-forced-response): places exactly 1 delay counter per villain phase", () => {
    const start = startWave2Game(
      wave2Scenario("absorbing-man", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    const scheme = start.mainScheme.instanceId;
    const stacked = stackEncounterDeck(start, ADVANCE, CLEAN_FILLER);
    expect(inst(stacked, scheme).counters.delay ?? 0).toBe(0);
    const afterRound1 = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(afterRound1, scheme).counters.delay ?? 0).toBe(1);
  });

  it("None Shall Pass (04079b.none-shall-pass-forced-response): does not fire again when Steel Kick (04087) places threat on the main scheme outside step one", () => {
    const start = startWave2Game(
      wave2Scenario("absorbing-man", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    const scheme = start.mainScheme.instanceId;
    // Steel Kick's Alter-Ego reveal places 2-3 threat on the main scheme itself, from a real step-two encounter
    // card reveal (not a direct ability invocation) — no `toHero()`, so the player stays in alter-ego form.
    const stacked = stackEncounterDeck(start, ADVANCE, "04087");
    const settled = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(settled, scheme).counters.delay ?? 0).toBe(1);
    // Confirm Steel Kick's own threat placement actually happened, so the delay count of 1 isn't a no-op.
    expect(inst(settled, scheme).threat).toBeGreaterThanOrEqual(2 + 2);
  });

  /**
   * Drives a real game to its next `resolveChoice`-by-`resolveChoice` conclusion (like `settle`, but counting
   * along the way instead of discarding the trace): how many times Hunting Down Heroes' own Forced Response
   * offered its choice ("Place 1 threat here" / "Take 1 damage") this villain phase. A retrigger — the old wiring's
   * exact bug, whether from the ability's own "place 1 threat" branch or from another source's threat placement —
   * shows up directly as this count exceeding 1, sidestepping any other card's own effect on the main scheme's
   * threat total (the ability's own `placeThreat` isn't the only thing that moves it in a real game — step one's
   * acceleration does too, every round).
   */
  const countHuntingDownHeroesPrompts = (state: GameState): { readonly count: number; readonly final: GameState } => {
    let current = state;
    let count = 0;
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 200) throw new Error("choices did not settle");
      const labels = current.pendingChoice.options.map((o) => o.label);
      if (labels.length === 2 && labels[0] === "Place 1 threat here" && labels[1] === "Take 1 damage") count++;
      current = runWave2(current, {
        type: "resolveChoice",
        playerId: current.pendingChoice.playerId,
        choiceId: current.pendingChoice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    return { count, final: current };
  };

  it("Hunting Down Heroes (04096b.hunting-down-heroes-forced-response): fires exactly once per villain phase and does not retrigger from its own 'place 1 threat here' branch", () => {
    const start = startWave2Game(
      wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    const scheme = start.mainScheme.instanceId;
    expect(inst(start, scheme).threat).toBe(1); // startingThreat: perPlayer 1
    const stacked = stackEncounterDeck(start, ADVANCE, CLEAN_FILLER);
    // firstLegal always takes a mandatory choice's first option — Hunting Down Heroes' own text lists "Place 1
    // threat here" before "Take 1 damage", so this drives exactly the branch that used to retrigger the ability:
    // the old wiring saw that very placement as a fresh `threatPlaced(mainScheme)` and asked again, without bound.
    const { count, final } = countHuntingDownHeroesPrompts(runWave2(stacked, toHero(), endTurn()));
    expect(count).toBe(1);
    // start (1) + step one's own acceleration (1, perPlayer 1) + the Forced Response's own "place 1 threat" (1).
    expect(inst(final, scheme).threat).toBe(3);
  });

  it("Hunting Down Heroes (04096b.hunting-down-heroes-forced-response): does not fire again when Hunted by Hydra (04106) is revealed and places threat on the main scheme outside step one", () => {
    const start = startWave2Game(
      wave2Scenario("taskmaster", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    const scheme = start.mainScheme.instanceId;
    const handBefore = playerOf(start, P1).hand.length;
    // Hunted by Hydra: a real step-two encounter card reveal (not a direct ability invocation), carrying Incite 1
    // (places 1 threat on the main scheme the instant it's revealed, outside step one) and its own When Revealed
    // (each hero-form player takes 1 damage and discards a card — confirms the reveal actually happened).
    const stacked = stackEncounterDeck(start, ADVANCE, "04106");
    const { count, final } = countHuntingDownHeroesPrompts(runWave2(stacked, toHero(), endTurn()));
    expect(count).toBe(1);
    expect(playerOf(final, P1).hand.length).toBeLessThan(handBefore); // Hunted by Hydra's own reveal actually fired
    // Regardless of how much threat Hunted by Hydra's own Incite adds on top, the Forced Response's own
    // contribution is capped at the single firing above: start (1) + step one's acceleration (1) + one placement
    // (1) is the floor: a retrigger would add at least 1 more on top of whatever Incite itself contributes.
    expect(inst(final, scheme).threat).toBeGreaterThanOrEqual(3);
  });

  it("The Mad Doctor (04113b.the-mad-doctor-forced-response): places exactly 1 test counter per villain phase", () => {
    const start = startWave2Game(
      wave2Scenario("zola", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    // Test-only surgery to reach stage 2 ("The Mad Doctor") directly, the same pattern this suite already uses to
    // reach a specific card/state without depending on a real scheme-completion grind (`absorbing-man.test.ts`'s
    // `withoutBioServant`, this file's own `patchInstance` uses below). `04112a`'s stages array has stage 1 at
    // index 0, stage 2 ("The Mad Doctor") at index 1; a real `advanceMainScheme` also resets the instance's threat
    // to the new stage's starting threat (`packages/engine/src/resolve/defeat.ts`), reproduced here directly.
    const schemeId = start.mainScheme.instanceId;
    const onStage2 = {
      ...patchInstance(start, schemeId, { threat: 1, counters: {} }), // startingThreat: perPlayer 1
      mainScheme: { ...start.mainScheme, stageIndex: 1 },
    };
    expect(inst(onStage2, schemeId).counters.test ?? 0).toBe(0);
    const stacked = stackEncounterDeck(onStage2, ADVANCE, CLEAN_FILLER);
    const afterRound1 = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    expect(inst(afterRound1, schemeId).counters.test ?? 0).toBe(1);
  });

  it("The Mad Doctor (04113b.the-mad-doctor-forced-response): does not fire again when Technological Enhancements' Incite (04121) places threat on the main scheme outside step one", () => {
    const start = startWave2Game(
      wave2Scenario("zola", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 }),
    );
    const schemeId = start.mainScheme.instanceId;
    const onStage2 = {
      ...patchInstance(start, schemeId, { threat: 1, counters: {} }),
      mainScheme: { ...start.mainScheme, stageIndex: 1 },
    };
    // Technological Enhancements: Incite 1 (places 1 threat on the main scheme when revealed) plus its own When
    // Revealed, which also places 1 *test* counter — a retrigger of the Forced Response would add a second test
    // counter from the same phase (reaching the 3-counter spawn threshold in one round instead of three).
    const stacked = stackEncounterDeck(onStage2, ADVANCE, "04121");
    const settled = settle(runWave2(stacked, endTurn()), firstLegal, undefined, WAVE2_DEPS);
    // The Forced Response's own counter (1) + Technological Enhancements' own When Revealed counter (1) = 2, not 3
    // — so the "3+ test counters" spawn branch does not fire this round.
    expect(inst(settled, schemeId).counters.test ?? 0).toBe(2);
  });
});

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
