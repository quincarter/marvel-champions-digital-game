/**
 * docs/phase7-wave9.md §3.47: `doesNotExhaustToDefend` / `defendsWithoutExhausting`, "Hero Response: After the villain
 * phase begins, discard Draw Their Fire → Falcon does not exhaust to defend until the end of the phase" (`falcon`
 * 53011). The engine's `defends-without-exhausting.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import {
  after,
  constant,
  defendsWithoutExhausting,
  discardThis,
  doesNotExhaustToDefend,
  heroResponse,
} from "./abilities.js";
import { applyRuleUntil } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { inForm, query, YOUR_HERO } from "./values.js";

describe("§3.47 `doesNotExhaustToDefend`", () => {
  it("is the rule, naming the characters it covers, with an optional condition", () => {
    expect(doesNotExhaustToDefend(YOUR_HERO)).toEqual({ kind: "defendsWithoutExhausting", character: YOUR_HERO });
    const whileHero = inForm("hero");
    expect(doesNotExhaustToDefend(query("ally", { controller: "you" }), { while: whileHero })).toEqual({
      kind: "defendsWithoutExhausting",
      character: { categories: ["ally"], controller: "you" },
      while: whileHero,
    });
  });

  it("builds Draw Their Fire: a hero response to the villain phase beginning, discarding itself, until the end of the phase", () => {
    const definition = heroResponse(
      after.phaseBeginning("villain"),
      { cost: discardThis },
      applyRuleUntil(doesNotExhaustToDefend(YOUR_HERO), "endOfPhase"),
    );
    expect(definition).toMatchObject({
      trigger: { kind: "response", form: "hero", on: { on: "phaseBeginning", eventIs: { phase: "villain" } } },
      cost: { discardSelf: true },
      effects: [
        {
          kind: "applyRuleUntil",
          rule: { kind: "defendsWithoutExhausting", character: YOUR_HERO },
          until: "endOfPhase",
        },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("is a constant's part too", () => {
    const definition = constant(defendsWithoutExhausting(YOUR_HERO));
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "defendsWithoutExhausting", character: YOUR_HERO }],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
