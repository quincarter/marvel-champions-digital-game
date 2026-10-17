/**
 * Mutant Education (37021) with nothing to resolve (FFG ruling May 22, 2023 - Ruling 9, answers 3 and 4, on the same
 * script shape as X-Men Instruction; RRG 1.8 'Target' p. 42): with no identity-specific card in the discard pile and no
 * X-Mansion in play, neither sentence can resolve, so the event cannot be played.
 */
import { cardId } from "@mc/content";
import { applyCommand, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, moveToHand, patchInstance, payWith, play, playerOf } from "../testing/harness.js";
import { moveToDiscard } from "../testing/staging.js";
import { gambitGame } from "../wave6/gambit/gambit/support.js";
import { WAVE6_DEPS } from "../wave6/index.js";

const staged = (discardCode?: string) => {
  const base = gambitGame("rhino", { seed: 1 }); // alter-ego form, empty discard pile, no X-Mansion
  const top = playerOf(base, P1).deck[0]!;
  const hand = moveToHand(patchInstance(base, top, { cardId: cardId("37021") }), P1, "37021");
  const [id] = hand.ids as [InstanceId];
  const state = discardCode ? moveToDiscard(hand.state, P1, discardCode).state : hand.state;
  return applyCommand(state, play(P1, id, payWith(state, P1, 0, [id])), WAVE6_DEPS);
};

describe("Mutant Education (37021) with nothing to resolve", () => {
  it("no identity-specific card in the discard pile and no X-Mansion in play: cannot be played", () => {
    expect(staged().ok).toBe(false);
  });

  it("an identity-specific card in the discard pile: can be played (choosing none is allowed)", () => {
    expect(staged("37006").ok).toBe(true);
  });
});
