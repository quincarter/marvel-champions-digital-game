/**
 * docs/phase7-wave6.md §3.43: the DSL side of a lasting bonus for basic attacks against one enemy (Jubilee 35003).
 * The engine's `basic-attack-bonus-against-enemy.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { on, response } from "./abilities.js";
import { anEnemy, modifyStatOf } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { attackInProgress, ifElse, theAffectedCard, titled } from "./values.js";

describe("§3.43 builders", () => {
  it("attackInProgress carries `basic`; theAffectedCard is the engine's affected slot", () => {
    expect(attackInProgress({ attacker: theAffectedCard, basic: true })).toEqual({
      kind: "attackInProgress",
      attacker: { inSlot: "affected" },
      basic: true,
    });
  });

  it("the affected slot is readable in a lasting stat change's amount, and nowhere else", () => {
    const bonus = ifElse(
      attackInProgress({ attacker: theAffectedCard, target: { inSlot: "enemy" }, basic: true }),
      2,
      0,
    );
    const jubilee = response(
      on.phaseBeginning("player"),
      anEnemy("enemy"),
      modifyStatOf("atk", bonus, titled("Jubilee"), "endOfPhase"),
    );
    expect(validateDefinition(jubilee)).toEqual([]);
    const misplaced = response(
      on.phaseBeginning("player"),
      anEnemy("enemy"),
      modifyStatOf("atk", 2, { ...titled("Jubilee"), inSlot: "affected" }, "endOfPhase"),
    );
    expect(validateDefinition(misplaced).join()).toContain('slot "affected"');
  });
});
