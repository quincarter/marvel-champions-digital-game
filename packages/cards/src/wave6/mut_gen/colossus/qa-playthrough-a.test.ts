import type { GameEvent, GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { applyOk, moveToHand, P1 } from "../../../testing/harness.js";
import { WAVE6_DEPS } from "../../index.js";
import { colossusGame } from "./support.js";

/**
 * Wave 6 QA playthrough A (2026-10-04), Colossus vs Sabretooth, round 2: Armor Up played on the villain's activation
 * flipped Colossus to hero form, then the villain SCHEMED (6 threat on the main scheme) instead of attacking him.
 *
 * RRG 1.8 "Activation" (p. 6): "If the identity of the player resolving the activation is in hero form, the villain
 * initiates an attack against that player's identity." Armor Up's erratum (RRG 1.8 p. 68, "Added 'would'") makes it an
 * interrupt to the activation, so the form is read after it: the villain must attack the hero. Today
 * `activateEnemy` (`packages/engine/src/villain/phase.ts`) decides attack-or-scheme before announcing
 * `enemyActivating`, and `continueActivation` replays that stale decision.
 */
describe("Armor Up (32010) QA playthrough A", () => {
  it.fails("after Armor Up flips him to hero form during the villain's activation, the villain attacks him", () => {
    const state: GameState = moveToHand(colossusGame(), P1, "32010").state;
    // End the turn and let the villain phase run, playing Armor Up and Steel Skin when offered.
    const events: GameEvent[] = [];
    let step = applyOk(state, { type: "endTurn", playerId: P1 }, WAVE6_DEPS);
    events.push(...step.events);
    for (let guard = 0; step.state.pendingChoice && !step.state.outcome && guard < 60; guard++) {
      const choice = step.state.pendingChoice;
      const picked =
        choice.prompt.kind === "chooseTriggers"
          ? choice.options.map((o) => o.optionId)
          : choice.prompt.kind === "declareDefender"
            ? ["decline"]
            : choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      step = applyOk(
        step.state,
        { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: picked },
        WAVE6_DEPS,
      );
      events.push(...step.events);
    }
    expect(
      events.some((e) => e.type === "formChanged" && e.to === "hero"),
      "Armor Up was offered and played",
    ).toBe(true);
    expect(
      events.some((e) => e.type === "schemeResolved"),
      "the villain did not scheme against the hero",
    ).toBe(false);
    expect(
      events.some((e) => e.type === "attackResolved"),
      "the villain attacked",
    ).toBe(true);
  });
});
