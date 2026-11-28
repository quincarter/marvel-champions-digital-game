import { describe, expect, it } from "vitest";
import { stopOrderOf } from "./stop-order.js";

describe("stopOrderOf", () => {
  it("keeps document order, with the first player's Random after the last seat", () => {
    const keys = [
      "back",
      "difficulty:standard",
      "modular:random-draw",
      "modular:bomb_scare",
      "first-player:random",
      "first-player:0",
      "first-player:1",
      "seed",
      "reroll",
      "watch",
      "deal-it-out",
    ];
    expect(stopOrderOf(keys)).toEqual([
      "back",
      "difficulty:standard",
      "modular:random-draw",
      "modular:bomb_scare",
      "first-player:0",
      "first-player:1",
      "first-player:random",
      "seed",
      "reroll",
      "watch",
      "deal-it-out",
    ]);
  });

  it("leaves the order alone when Random is already last among the seats, or there is no Random or no seat", () => {
    const ordered = ["back", "first-player:0", "first-player:random", "deal-it-out"];
    expect(stopOrderOf(ordered)).toEqual(ordered);
    expect(stopOrderOf(["back", "deal-it-out"])).toEqual(["back", "deal-it-out"]);
    expect(stopOrderOf(["first-player:random", "deal-it-out"])).toEqual(["first-player:random", "deal-it-out"]);
  });
});
