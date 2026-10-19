/**
 * docs/phase7-wave11-scenarios.md §S7 E27: `forEachPlayerInChosenOrder`, "each player …" where the first player
 * orders the players (RRG 1.8 "Each Player", p. 17). The engine's behaviour is pinned in
 * `packages/engine/src/for-each-player-order.test.ts`; this pins the builder's output.
 */

import { describe, expect, it } from "vitest";
import { dealEncounterCard, eachPlayer, forEachPlayer, forEachPlayerInChosenOrder, thatPlayer } from "./index.js";

describe("§S7 E27 forEachPlayerInChosenOrder", () => {
  it("is a forEachPlayer with order firstPlayerChooses, its effects flattened", () => {
    expect(forEachPlayerInChosenOrder(eachPlayer, [dealEncounterCard(thatPlayer)])).toEqual({
      kind: "forEachPlayer",
      players: eachPlayer,
      effects: [dealEncounterCard(thatPlayer)],
      order: "firstPlayerChooses",
    });
  });

  it("forEachPlayer itself is unchanged: no order, so player order", () => {
    expect(forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer))).not.toHaveProperty("order");
  });
});
