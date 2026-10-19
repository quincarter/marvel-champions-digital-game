import { describe, expect, it } from "vitest";
import { eitherCost, exhaustCardsCost, heroAction, spend } from "./abilities.js";
import { exhaust } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query } from "./values.js";

/** A slot picked inside an either/or cost branch is readable by the effects (Disasters 60177 to 60179). */
describe("either-cost branch picks", () => {
  const cost = eitherCost(spend({ mental: 2 }), exhaustCardsCost(query("ally")));
  it("a slot picked in a branch is readable", () => {
    expect(validateDefinition(heroAction({ cost }, exhaust(chosen("exhausted"))))).toEqual([]);
  });
  it("a slot no branch picks is still refused", () => {
    const problems = validateDefinition(heroAction({ cost }, exhaust(chosen("nothing"))));
    expect(problems.join("\n")).toContain('slot "nothing" is read before it is bound');
    expect(validateDefinition(heroAction({ cost: spend({ mental: 2 }) }, exhaust(chosen("exhausted")))).length).toBe(1);
  });
});
