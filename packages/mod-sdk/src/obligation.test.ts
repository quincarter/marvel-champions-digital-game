import { PLAYABLE_DEPS, discardAtRandom, surge } from "@mc/cards";
import { describe, expect, it } from "vitest";
import { packObligation } from "./obligation.js";

describe("packObligation", () => {
  it("builds the same definition as the base game's own Eviction Notice (01165)", () => {
    const built = packObligation("Peter Parker", {
      label: "Discard 1 card at random from your hand; this card gains surge",
      effects: [discardAtRandom(1), surge()],
    });
    expect(built).toEqual(PLAYABLE_DEPS.abilities["01165.obligation"]);
  });
});
