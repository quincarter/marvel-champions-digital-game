/**
 * `on.enemyAttacks(…, { atDamage, undefended })`: the interrupt window at an enemy attack's damage step (`TriggerEvent
 * enemyAttackDamageStep`; RRG 1.8 "Attack (Enemy Activation)", pp. 8-9, "Damage", p. 14; owner decision 2026-10-16).
 * `attack-damage-step-interrupt.test.ts` drives the engine side; Robert Kelly (`mut_gen` 32066) is the card.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query, self } from "./values.js";

describe("`on.enemyAttacks` at the damage step", () => {
  it("atDamage + undefended + againstYou: the damage-step event, the attack's target player, nobody defending", () => {
    expect(on.enemyAttacks(query("enemy"), { againstYou: true, atDamage: true, undefended: true })).toEqual({
      on: "enemyAttackDamageStep",
      sourceIs: query("enemy"),
      playerIs: "controller",
      eventAtLeast: { undefended: 1 },
    });
  });

  it("without atDamage, undefended is the finished attack's result (a response)", () => {
    expect(on.enemyAttacks("self", { undefended: true })).toEqual({
      on: "enemyAttack",
      selfIs: "source",
      requireResults: { undefended: 1 },
    });
    expect(on.enemyAttacks("self", { damages: true })).toEqual({
      on: "enemyAttack",
      selfIs: "source",
      requireResults: { damage: 1 },
    });
  });

  it("a forced interrupt there redirecting the damage to this ally validates", () => {
    const definition = forcedInterrupt(
      on.enemyAttacks(query("enemy"), { againstYou: true, atDamage: true, undefended: true }),
      modifyAttack({ damageTo: self }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "modifyAttack", damageTo: { kind: "self" } }]);
  });
});
