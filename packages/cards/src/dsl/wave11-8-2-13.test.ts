import { describe, expect, it } from "vitest";
import { removeAccelerationToken, removeAnAccelerationToken } from "./effects.js";
import { firstPlayer, self } from "./index.js";

/**
 * docs/phase7-wave11.md §8.2 task 13: "Remove an acceleration token from play" (De-escalation 60024) is a choice among
 * the cards holding one, then one token off the chosen card (engine behavior: `remove-acceleration-token.test.ts`).
 */
describe("removeAnAccelerationToken", () => {
  it("binds a holder of an acceleration token, chosen by the controller, and removes one from it", () => {
    expect(removeAnAccelerationToken()).toEqual([
      {
        kind: "chooseTarget",
        slot: "accelerationToken",
        query: { hasAccelerationToken: true },
        chooser: { kind: "controller" },
      },
      { kind: "removeAccelerationToken", from: { kind: "slot", slot: "accelerationToken" } },
    ]);
  });

  it("takes another chooser and slot", () => {
    expect(removeAnAccelerationToken({ chooser: firstPlayer, slot: "t" })).toMatchObject([
      { kind: "chooseTarget", slot: "t", chooser: firstPlayer },
      { from: { kind: "slot", slot: "t" } },
    ]);
  });

  it("removeAccelerationToken: absent `from` is the central main scheme, as before", () => {
    expect(removeAccelerationToken()).toEqual({ kind: "removeAccelerationToken" });
    expect(removeAccelerationToken(self)).toEqual({ kind: "removeAccelerationToken", from: { kind: "self" } });
  });
});
