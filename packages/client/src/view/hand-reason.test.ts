import { describe, expect, test } from "vitest";
import { NEUTRAL_PLAY_TAG, noTargetTag } from "./hand-reason.js";

/** Every `no_valid_target` play message in `packages/engine/src/actions.ts` (and `attach-cost.ts`) this tag knows. */
const MAPPED: readonly (readonly [string, string])[] = [
  ["play only if your identity has the Hero trait", "needs Hero"],
  ["play only if you control a Avenger character", "needs Avenger in play"],
  ["play only if you control an Elite character", "needs Elite in play"],
  ["this card's play restriction is not met", "restricted"],
  ["this event's condition is not met", "condition unmet"],
  ["this event has no valid target", "no target"],
  ["upgrade has no valid host", "no target"],
  ["nothing in play to attach Mjolnir to", "no target"],
  ["nothing in play to deal damage to for the cost", "no target"],
];

describe("noTargetTag", () => {
  test.each(MAPPED)("maps %j to %j", (message, tag) => {
    expect(noTargetTag(message)).toBe(tag);
  });

  test("a message it does not know reads neutral, never a guess", () => {
    expect(noTargetTag("nothing to attack")).toBe(NEUTRAL_PLAY_TAG);
    expect(noTargetTag("you cannot play that card right now")).toBe("can't play");
    expect(noTargetTag("play only if your hero is the Hero trait now")).toBe("can't play");
  });
});
