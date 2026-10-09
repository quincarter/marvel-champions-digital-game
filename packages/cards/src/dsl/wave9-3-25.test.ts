/**
 * docs/phase7-wave9.md §3.25 (Aerial Dogfight, `aos` 50159): "Reduce the damage each Aerial character takes from each
 * attack by 2 unless the attacker or attack has the Aerial trait, or the attack has ranged." `reducesAttackDamageTaken`
 * carries the same three exceptions `takesDamageOnlyFromAttacks` does (`attacker-keyword-damage-rules.test.ts` drives
 * them in the engine).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { constant, reducesAttackDamageTaken } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { query } from "./values.js";

const AERIAL = trait("AERIAL");

describe("§3.25 `reducesAttackDamageTaken` with the attack's own exceptions", () => {
  it("Aerial Dogfight's shape: all three exceptions on a reduceDamageTaken from attacks", () => {
    const part = reducesAttackDamageTaken(query("character", { trait: AERIAL }), 2, {
      exceptAttacker: { trait: AERIAL },
      exceptAttackCard: { trait: AERIAL },
      exceptAttackKeyword: "ranged",
    });
    const definition = constant(part);
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      rules: [
        {
          kind: "reduceDamageTaken",
          target: { categories: ["character"], trait: AERIAL },
          amount: 2,
          fromAttack: true,
          exceptAttacker: { trait: AERIAL },
          exceptAttackCard: { trait: AERIAL },
          exceptAttackKeyword: "ranged",
        },
      ],
    });
  });

  it("without them the rule carries no exception fields (Wide Stance's shape, unchanged)", () => {
    const definition = constant(reducesAttackDamageTaken({ self: true }, 1));
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "reduceDamageTaken", target: { self: true }, amount: 1, fromAttack: true }],
    });
    const [rule] = (definition.trigger as { rules: readonly object[] }).rules;
    expect(Object.keys(rule!).sort()).toEqual(["amount", "fromAttack", "kind", "target"]);
  });
});
