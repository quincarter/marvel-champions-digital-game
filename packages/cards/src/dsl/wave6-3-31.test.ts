/**
 * docs/phase7-wave6.md §3.31: rules on an ally's consequential damage. `takesConsequentialDamage` and
 * `preventConsequentialDamage` emit `reduceDamageTaken` / `increaseDamageTaken` / `preventAllDamage` with a
 * `consequential` scope (`consequential-damage-rules.test.ts` in the engine drives them).
 */

import { describe, expect, it } from "vitest";
import { constant, heroAction, preventConsequentialDamage, rule, takesConsequentialDamage } from "./abilities.js";
import { applyRuleUntil, modifyConsequentialDamage } from "./effects.js";
import { allOf, query, refMatches, varAtLeast } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.31 consequential damage rules", () => {
  it("'-1 consequential damage after he attacks' is a scoped reduceDamageTaken", () => {
    const definition = constant(rule(takesConsequentialDamage({ self: true }, -1, { from: "attack" })));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "reduceDamageTaken", target: { self: true }, amount: 1, consequential: { from: "attack" } }],
    });
  });

  it("'+1 consequential damage' is a scoped increaseDamageTaken, from either power by default", () => {
    expect(takesConsequentialDamage({ self: true }, 1)).toEqual({
      kind: "increaseDamageTaken",
      target: { self: true },
      amount: 1,
      consequential: { from: "any" },
    });
  });

  it("Group Assault's shape: prevent all consequential damage from attacking until the end of the phase", () => {
    const definition = heroAction(
      applyRuleUntil(preventConsequentialDamage({ categories: ["ally"] }, { from: "attack" }), "endOfPhase"),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "applyRuleUntil",
        rule: { kind: "preventAllDamage", target: { categories: ["ally"] }, consequential: { from: "attack" } },
        until: "endOfPhase",
      },
    ]);
  });

  it("an `if` may read the attack's reported `attack.*` vars and slots; anything else is still unbound", () => {
    const cannonball = constant(
      rule(
        takesConsequentialDamage({ self: true }, -1, {
          from: "attack",
          if: allOf(
            varAtLeast("attack.defeated"),
            refMatches({ kind: "slot", slot: "attack.damaged" }, query("minion"), { anywhere: true }),
          ),
        }),
      ),
    );
    expect(validateDefinition(cannonball)).toEqual([]);
    const stray = constant(rule(takesConsequentialDamage({ self: true }, -1, { if: varAtLeast("nope") })));
    expect(validateDefinition(stray)).toEqual(['constant: var "nope" is read before it is bound']);
  });
});

describe("§3.31 `modifyConsequentialDamage`, the one-shot change", () => {
  it("'Dust takes +1 consequential damage after this attack': the ability's own card by default, a signed amount", () => {
    expect(modifyConsequentialDamage(1)).toEqual({
      kind: "modifyConsequentialDamage",
      character: { kind: "self" },
      amount: { kind: "const", value: 1 },
    });
    expect(validateDefinition(heroAction(modifyConsequentialDamage(-1)))).toEqual([]);
  });
});
