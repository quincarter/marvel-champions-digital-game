/**
 * docs/phase7-wave7.md §3.50: `inVictoryDisplay(constant(…))`, a constant that applies while its card is in the victory
 * display, and the validation that keeps the mark to what the engine reads from there. The engine's
 * `victory-display-constant.test.ts` drives the compiled definition.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  action,
  cannotRecover,
  constant,
  costModifier,
  countsAs,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  gets,
  inHand,
  inVictoryDisplay,
  on,
} from "./abilities.js";
import { dealDamage } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { inForm, query, you, YOUR_IDENTITY, yourIdentity } from "./values.js";

const PSIONIC = trait("PSIONIC");
const HERO_FORM = { while: inForm("hero") };

describe("§3.50 a constant active from the victory display", () => {
  it("inVictoryDisplay marks a constant: the trait for both forms, the stats while in hero form", () => {
    const definition = inVictoryDisplay(
      constant(
        gainsTrait(PSIONIC, YOUR_IDENTITY),
        gets("thw", 1, YOUR_IDENTITY, HERO_FORM),
        gets("atk", 1, YOUR_IDENTITY, HERO_FORM),
        gets("def", 1, YOUR_IDENTITY, HERO_FORM),
      ),
    );
    const heroOnly = { kind: "form", player: { kind: "controller" }, form: "hero" };
    const yours = { categories: ["identity"], controller: "you" };
    expect(definition).toEqual({
      trigger: {
        kind: "constant",
        traitGrants: [{ trait: PSIONIC, target: yours }],
        modifiers: [
          { stat: "thw", amount: 1, target: yours, while: heroOnly },
          { stat: "atk", amount: 1, target: yours, while: heroOnly },
          { stat: "def", amount: 1, target: yours, while: heroOnly },
        ],
      },
      effects: [],
      activeIn: "victoryDisplay",
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("a keyword grant and an activeRules rule validate too, and the mark replaces inHand's", () => {
    const definition = inVictoryDisplay(
      constant(gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY), cannotRecover(you)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(inVictoryDisplay(inHand(definition)).activeIn).toBe("victoryDisplay");
  });

  it("only a constant: a triggered ability or an action marked for the victory display is rejected", () => {
    const response = inVictoryDisplay(forcedResponse(on.youChangeIdentityForm(), dealDamage(1, yourIdentity)));
    expect(validateDefinition(response)).toEqual([
      "only a constant ability works from the victory display (inVictoryDisplay on a response ability)",
    ]);
    const used = inVictoryDisplay(action(dealDamage(1, yourIdentity)));
    expect(validateDefinition(used)).toEqual([
      "only a constant ability works from the victory display (inVictoryDisplay on an action ability)",
    ]);
  });

  it("a part of a constant the engine does not read from out of play is rejected", () => {
    const costs = inVictoryDisplay(constant(costModifier({ delta: -1, appliesTo: query("ally") })));
    expect(validateDefinition(costs)).toEqual([
      "a victory display constant cannot carry costModifiers: not read from out of play",
    ]);
    const counts = inVictoryDisplay(constant(countsAs(YOUR_IDENTITY, ["ally"])));
    expect(validateDefinition(counts)).toEqual([
      "a victory display constant cannot carry a countsAs rule: read from play only",
    ]);
  });

  it("the same constant unmarked is an ordinary in-play constant", () => {
    const definition = constant(gainsTrait(PSIONIC, YOUR_IDENTITY));
    expect(definition.activeIn).toBeUndefined();
    expect(validateDefinition(definition)).toEqual([]);
  });
});
