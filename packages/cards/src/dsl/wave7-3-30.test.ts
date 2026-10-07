/**
 * docs/phase7-wave7.md §3.30: damage rules that read the attacker or the attack. `takesDamageOnlyFromAttacks`,
 * `reducesAttackDamageTaken` and `ignoresRetaliate` emit the rules the engine reads
 * (`attacker-keyword-damage-rules.test.ts` drives them); `on.youIgnore` hears an ignored retaliate.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  constant,
  ignoresRetaliate,
  on,
  reducesAttackDamageTaken,
  response,
  takesDamageOnlyFromAttacks,
} from "./abilities.js";
import { draw } from "./effects.js";
import { validateDefinition } from "./validate.js";

const AERIAL = trait("AERIAL");
const TINY = trait("TINY");

describe("§3.30 attacker and attack-keyword damage rules", () => {
  it("'cannot take damage unless the attacker or attack has the [AERIAL] trait, or the attack has ranged'", () => {
    const definition = constant(
      takesDamageOnlyFromAttacks(
        { categories: ["villain"] },
        { attacker: { trait: AERIAL }, attackCard: { trait: AERIAL }, attackKeyword: "ranged" },
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "cannotTakeDamage",
          target: { categories: ["villain"] },
          exceptAttacker: { trait: AERIAL },
          exceptAttackCard: { trait: AERIAL },
          exceptAttackKeyword: "ranged",
        },
      ],
    });
  });

  it("'reduce the damage taken from each attack by 1 unless the attacker has the [TINY] trait'", () => {
    const definition = constant(reducesAttackDamageTaken({ self: true }, 1, { exceptAttacker: { trait: TINY } }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "reduceDamageTaken",
          target: { self: true },
          amount: 1,
          fromAttack: true,
          exceptAttacker: { trait: TINY },
        },
      ],
    });
    // Without the exception it is the plain "from each attack" reduction.
    expect(constant(reducesAttackDamageTaken({ self: true }, 2)).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "reduceDamageTaken", target: { self: true }, amount: 2, fromAttack: true }],
    });
  });

  it("'ignores the retaliate keyword while attacking a non-[AERIAL] character', and hearing it", () => {
    const definition = constant(ignoresRetaliate({ hostOfSelf: true }, { against: { withoutTrait: AERIAL } }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [
        {
          kind: "characterIgnores",
          target: { hostOfSelf: true },
          ignores: ["retaliate"],
          against: { withoutTrait: AERIAL },
        },
      ],
    });
    expect(constant(ignoresRetaliate({ self: true })).trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "characterIgnores", target: { self: true }, ignores: ["retaliate"] }],
    });
    const heard = response(on.youIgnore(["retaliate"]), draw(1));
    expect(validateDefinition(heard)).toEqual([]);
    expect(heard.trigger).toMatchObject({ on: { on: "keywordIgnored", eventIs: { ignored: ["retaliate"] } } });
  });
});
