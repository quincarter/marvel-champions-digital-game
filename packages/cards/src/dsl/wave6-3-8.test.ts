/**
 * docs/phase7-wave6.md §3.8: "After you ignore guard / patrol / the crisis icon" (`keywordIgnored`). `on.youIgnore`
 * emits the pattern the engine matches (`packages/engine/src/keyword-ignored.test.ts` drives it): one event per card
 * whose keyword or icon would otherwise have stopped the attack or thwart, after it (§4.1 Q6).
 */

import { describe, expect, it } from "vitest";
import { exhaustThis, on, response } from "./abilities.js";
import { dealDamage, removeThreat } from "./effects.js";
import { eventTarget } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.8 `on.youIgnore`", () => {
  it("Acute Control's shape: after you ignore guard or patrol on a minion, exhaust → 2 damage to that minion", () => {
    const definition = response(on.youIgnore(["guard", "patrol"]), { cost: exhaustThis }, dealDamage(2, eventTarget));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: false,
      on: { on: "keywordIgnored", eventIs: { ignored: ["guard", "patrol"] }, playerIs: "controller" },
    });
  });

  it("Intangible Interference's shape: after you ignore the crisis icon, remove 2 threat from that scheme", () => {
    const definition = response(on.youIgnore(["crisis"]), { cost: exhaustThis }, removeThreat(2, eventTarget));
    expect(validateDefinition(definition)).toEqual([]);
    expect(on.youIgnore(["crisis"])).toEqual({
      on: "keywordIgnored",
      eventIs: { ignored: ["crisis"] },
      playerIs: "controller",
    });
  });
});
