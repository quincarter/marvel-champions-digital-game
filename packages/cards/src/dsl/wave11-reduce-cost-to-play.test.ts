/**
 * Wave 11 hero packs: `reduceCostToPlay(query, n, player?)`, "until the end of the phase, reduce the cost to play each
 * Team-Up card by 1" (Defend Our City 61029). The engine's `play-cost-modifier-rule.test.ts` drives the rule.
 */

import { describe, expect, it } from "vitest";
import { action, reduceCostToPlay } from "./abilities.js";
import { applyRuleUntil } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { TEAM_UP_CARD, countOf, you } from "./values.js";

describe("reduceCostToPlay (Defend Our City 61029)", () => {
  it("is a play cost rule for every player by default, lasting through applyRuleUntil", () => {
    expect(reduceCostToPlay(TEAM_UP_CARD, 1)).toEqual({
      kind: "playCostModifier",
      player: { kind: "each" },
      appliesTo: { withKeyword: "teamUp" },
      delta: -1,
    });
    const definition = action(applyRuleUntil(reduceCostToPlay(TEAM_UP_CARD, 1), "endOfPhase"));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "applyRuleUntil", rule: reduceCostToPlay(TEAM_UP_CARD, 1), until: "endOfPhase" },
    ]);
  });

  it("control: one player only, and a live amount is negated rather than read now", () => {
    expect(reduceCostToPlay(TEAM_UP_CARD, 2, you)).toMatchObject({ player: { kind: "controller" }, delta: -2 });
    const live = countOf({ categories: ["ally"] });
    expect(reduceCostToPlay(TEAM_UP_CARD, live)).toMatchObject({
      delta: { kind: "product", values: [{ kind: "const", value: -1 }, live] },
    });
  });

  it("a negative reduction is refused by the validator; 0 is allowed", () => {
    const raised = action(applyRuleUntil(reduceCostToPlay(TEAM_UP_CARD, -1), "endOfPhase"));
    expect(validateDefinition(raised).join(" | ")).toMatch(/reduceCostToPlay needs a reduction of 0 or more, not -1/);
    expect(validateDefinition(action(applyRuleUntil(reduceCostToPlay(TEAM_UP_CARD, 0), "endOfPhase")))).toEqual([]);
  });
});
