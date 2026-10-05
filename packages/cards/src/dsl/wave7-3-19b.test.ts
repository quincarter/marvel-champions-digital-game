/**
 * docs/phase7-wave7.md §3.19 (b): "Hero Action: Attached villain attacks you → discard this card" with the
 * `enemyAttacksYouCost` builder, which compiles to the engine's `AbilityCost.enemyAttack`. The engine's
 * `enemy-attack-cost.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { enemyAttacksYouCost, heroAction, resource } from "./abilities.js";
import { discard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { host, self } from "./values.js";

describe("§3.19 (b) enemyAttacksYouCost", () => {
  it("compiles to the engine's cost: the named enemy attacks the paying player", () => {
    expect(enemyAttacksYouCost(host)).toEqual({ enemyAttack: { enemy: { kind: "host" }, against: "you" } });
  });

  it("the hero action's shape validates: the attached villain attacks you, then this card is discarded", () => {
    const definition = heroAction({ cost: enemyAttacksYouCost(host) }, discard(self));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({ kind: "action", form: "hero" });
    expect(definition.cost).toEqual({ enemyAttack: { enemy: { kind: "host" }, against: "you" } });
    expect(definition.effects).toEqual([{ kind: "discardFromPlay", target: { kind: "self" } }]);
  });

  it("is rejected on a resource ability, which is paid in the middle of another payment", () => {
    const onResource = resource({ wild: 1 }, { cost: enemyAttacksYouCost(host) });
    expect(validateDefinition(onResource)).toContain("cost enemyAttack: not on a resource ability");
  });
});
