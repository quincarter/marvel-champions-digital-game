/**
 * docs/phase7-wave6.md §3.39: `modifyStat(..., { nextBasic })`, "That ally gets +2 THW and +2 ATK for its next basic
 * thwart or attack action this phase" (Psychic Kicker, 34034). The engine's `next-basic-power-bonus.test.ts` drives it.
 */

import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { modifyStat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self } from "./values.js";

describe("§3.39 `modifyStat(..., { nextBasic })`", () => {
  it("Psychic Kicker's shape: both bonuses wait on the next basic thwart or attack", () => {
    const definition = action(
      modifyStat("thw", 2, self, { nextBasic: ["attack", "thwart"] }),
      modifyStat("atk", 2, self, { nextBasic: ["attack", "thwart"] }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "modifyStatUntil",
        stat: "thw",
        amount: { kind: "const", value: 2 },
        target: { kind: "self" },
        until: { kind: "nextBasicPower", powers: ["attack", "thwart"] },
      },
      {
        kind: "modifyStatUntil",
        stat: "atk",
        amount: { kind: "const", value: 2 },
        target: { kind: "self" },
        until: { kind: "nextBasicPower", powers: ["attack", "thwart"] },
      },
    ]);
  });

  it("a clock duration is unchanged", () => {
    expect(modifyStat("atk", 1, self, "endOfPhase")).toMatchObject({ until: "endOfPhase" });
  });
});
