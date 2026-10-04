/**
 * docs/phase7-wave6.md §3.36: an enemy attack's damage dealt to another enemy. `modifyAttack({ damageTo })` emits the
 * `modifyAttack.damageTo` the engine reads at the attack's damage step (`attack-damage-to-enemy.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { heroInterrupt, on } from "./abilities.js";
import { chooseTarget, modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventSource, query } from "./values.js";

describe("§3.36 `modifyAttack({ damageTo })`", () => {
  it("Psychic Misdirection's shape: 'choose a different enemy → damage from that attack is dealt to the chosen enemy'", () => {
    const definition = heroInterrupt(
      on.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
      { label: ["defense"] },
      chooseTarget("enemy", query("enemy", { excluding: eventSource })),
      modifyAttack({ damageTo: chosen("enemy") }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects.at(-1)).toEqual({ kind: "modifyAttack", damageTo: { kind: "slot", slot: "enemy" } });
  });

  it("absent, no damageTo key is emitted", () => {
    expect(modifyAttack({ atkBonus: 1 })).not.toHaveProperty("damageTo");
  });
});
