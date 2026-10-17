/**
 * Rules audit chunk 28 (rulings June 2 - August 3, 2026).
 *
 * Clarity of Purpose (`spdr` 31029): "Hero Resource: Exhaust this card and deal 1 damage to attached character ->
 * generate a [wild] resource."
 *
 * RRG 1.8 "Cost" (p. 14): "If dealing damage is a cost, that cost is considered paid even if some or all of that
 * damage is prevented." Rulings June 25, 2026 (6) and July 9, 2026 (2): damage dealt as a cost that is reduced or
 * prevented to 0 still pays the cost (Luke Cage + Clarity of Purpose + Metal Bracelet). The script uses
 * `damageCardsCost`, the "taking damage" cost ("not considered paid unless all of that damage was taken"), so a
 * character holding a tough status card (which prevents the damage) cannot pay it.
 */

import { describe, expect, it } from "vitest";
import { applyCommand, type GameState, type InstanceId } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  resourceAbility,
  settle,
  toHero,
} from "../testing/harness.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../wave5/testing.js";
import { spdrScenarioWithExtras } from "../wave5/spdr/support.js";

describe("audit 28: Clarity of Purpose pays a dealt-damage cost even when the damage is prevented", () => {
  it("a tough status card on the attached character does not stop Clarity generating its resource (RRG 1.8 p. 14; Jun 25, 2026 (6))", () => {
    const hero = runWave5(
      startWave5Game(spdrScenarioWithExtras("rhino", { seed: 1, extraCodes: ["31029"] })),
      toHero(P1),
    );
    const identity = identityOf(hero, P1);
    const given1 = moveToHand(hero, P1, "31029");
    const [clarity] = given1.ids as [InstanceId];
    const withClarity = settle(
      runWave5(
        given1.state,
        play(P1, clarity, payWith(given1.state, P1, 1, [clarity]), { attachToInstanceId: identity }),
      ),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(withClarity, clarity).attachedTo).toBe(identity);
    const base = patchInstance(withClarity, identity, {
      exhausted: true,
      statuses: { ...inst(withClarity, identity).statuses, tough: 1 },
    });
    const given = moveToHand(base, P1, "31023"); // Limitless Stamina, cost 1
    const [stamina] = given.ids as [InstanceId];
    const result = applyCommand(
      given.state as GameState,
      play(P1, stamina, [], { abilities: [resourceAbility(clarity, "31029.clarity-of-purpose-resource")] }),
      WAVE5_DEPS,
    );
    expect(result.ok).toBe(true);
  });
});
