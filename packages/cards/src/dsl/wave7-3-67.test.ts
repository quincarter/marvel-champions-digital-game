/**
 * docs/phase7-wave7.md §3.67: "ignore each boost icon and each 'Boost' ability for this attack"
 * (`ignoreBoostForThisAttack`, a rule lasting until the end of the attack) and the standing rule `ignoreBoost`. The
 * engine's `ignore-boost.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { constant, heroInterrupt, ignoreBoost, on } from "./abilities.js";
import { ignoreBoostForThisAttack, modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.67 an attack whose boost icons and Boost abilities are ignored", () => {
  it("ignoreBoostForThisAttack is the ignoreBoost rule until the end of the attack in progress", () => {
    expect(ignoreBoostForThisAttack()).toEqual({
      kind: "applyRuleUntil",
      rule: { kind: "ignoreBoost" },
      until: "endOfAttack",
    });
  });

  it("the card's shape: a (defense) hero interrupt to any enemy's attack, against any player", () => {
    const definition = heroInterrupt(
      on.enemyAttacks({ categories: ["villain", "minion"] }),
      { label: "defense" },
      ignoreBoostForThisAttack(),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.label).toEqual(["defense"]);
    expect(definition.trigger).toMatchObject({ kind: "interrupt", forced: false, form: "hero" });
    // Not "attacks you": no player is named on the pattern.
    expect(definition.trigger).not.toHaveProperty("on.playerIs");
    expect(definition.effects).toEqual([ignoreBoostForThisAttack()]);
  });

  it("is not the withheld boost card of modifyAttack({ noBoost: true })", () => {
    expect(ignoreBoostForThisAttack()).not.toEqual(modifyAttack({ noBoost: true }));
  });

  it("ignoreBoost as a constant rule, for every enemy or the ones a query names", () => {
    expect(constant(ignoreBoost()).trigger).toMatchObject({ kind: "constant", rules: [{ kind: "ignoreBoost" }] });
    expect(constant(ignoreBoost({ categories: ["minion"] })).trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "ignoreBoost", enemy: { categories: ["minion"] } }],
    });
  });
});
