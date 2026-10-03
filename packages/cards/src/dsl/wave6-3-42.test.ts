/**
 * docs/phase7-wave6.md §3.42: the DSL side of playing a card chosen in the cost (Wolverine's Claws 35002) and reading
 * how it was played (Lunging Strike 35010). The engine's `play-chosen-card-via.test.ts` drives the behavior.
 */

import { describe, expect, it } from "vitest";
import { chooseCardCost, exhaustThis, heroAction, takeDamageCost } from "./abilities.js";
import { playFromHandIgnoringCost } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, playedVia, printedCostOf, query, self, you } from "./values.js";

describe("§3.42 builders", () => {
  it("chooseCardCost picks a card into a slot; takeDamageCost takes a value", () => {
    expect(chooseCardCost("event", { zone: "hand", player: "you" }, { playableIgnoringCost: true })).toEqual({
      chooseCard: { slot: "event", from: { zone: "hand", player: "you" }, playableIgnoringCost: true },
    });
    expect(chooseCardCost("event", { zone: "hand", player: "you" })).toEqual({
      chooseCard: { slot: "event", from: { zone: "hand", player: "you" } },
    });
    expect(takeDamageCost(printedCostOf(chosen("event")))).toEqual({
      damageSelf: { kind: "printedCost", of: { kind: "slot", slot: "event" } },
    });
  });

  it("playFromHandIgnoringCost carries card, via and whileResolving; playedVia is a predicate", () => {
    expect(
      playFromHandIgnoringCost(you, {
        card: chosen("event"),
        via: self,
        whileResolving: [{ kind: "attackKeywords", keywords: ["piercing"], via: { inSlot: "event" } }],
      }),
    ).toEqual({
      kind: "playFromHand",
      player: you,
      ignoreCost: true,
      card: { kind: "slot", slot: "event" },
      via: { kind: "self" },
      whileResolving: [{ kind: "attackKeywords", keywords: ["piercing"], via: { inSlot: "event" } }],
    });
    expect(playedVia(query("upgrade", { name: "Wolverine's Claws" }))).toEqual({
      kind: "playedVia",
      card: { categories: ["upgrade"], name: "Wolverine's Claws" },
    });
  });

  it("the cost's slot is bound for the effects, and two components cannot share it", () => {
    const pick = chooseCardCost("event", { zone: "hand", player: "you" });
    const effect = playFromHandIgnoringCost(you, { card: chosen("event") });
    expect(validateDefinition(heroAction({ cost: [exhaustThis, pick] }, effect))).toEqual([]);
    expect(validateDefinition(heroAction(effect))).not.toEqual([]);
    const clash = {
      chooseCard: { slot: "discard", from: { zone: "hand", player: "you" } },
      discardFromHand: { min: 1 },
    };
    expect(validateDefinition({ ...heroAction(), cost: clash } as never).join()).toContain("same slot");
  });
});
