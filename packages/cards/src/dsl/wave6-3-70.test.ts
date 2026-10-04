/**
 * docs/phase7-wave6.md §3.70: playing a card searched from your deck. `playFromDeckIgnoringCost` emits the
 * `playFromHand { from: "deck" }` the engine resolves (`play-from-deck.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { forEachPlayer, playFromDeckIgnoringCost } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { eachPlayer, thatPlayer } from "./values.js";

describe("§3.70 `playFromDeckIgnoringCost`", () => {
  it("Fetch Quest's shape: in player order, each player may search their deck and play a card, ignoring its cost", () => {
    const effect = forEachPlayer(eachPlayer, playFromDeckIgnoringCost(thatPlayer));
    expect(validateDefinition({ trigger: { kind: "whenDefeated" }, effects: [effect] })).toEqual([]);
    expect(effect).toEqual({
      kind: "forEachPlayer",
      players: { kind: "each" },
      effects: [{ kind: "playFromHand", player: { kind: "scoped" }, from: "deck", ignoreCost: true, optional: true }],
    });
  });

  it("`optional: false` makes the play required; a filter is carried through", () => {
    expect(playFromDeckIgnoringCost(undefined, { optional: false, filter: { categories: ["ally"] } })).toEqual({
      kind: "playFromHand",
      player: { kind: "controller" },
      from: "deck",
      ignoreCost: true,
      filter: { categories: ["ally"] },
    });
  });
});
