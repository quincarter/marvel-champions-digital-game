import { createGame, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, answer, firstLegal, inst, settle, settleUntil } from "../../../testing/harness.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * RRG 1.8 "Each Player" (p. 17), docs/phase7-wave11-scenarios.md §S7 E29: 60142a's setup says "each player discards
 * ... until a Prisoner minion", with no order printed, so the first player orders the players. The order decides which
 * Prisoner each player gets (the deck is discarded through in turn).
 */
function toOrderPrompt(seed: number): GameState {
  const config = wave11Scenario("the-raft-breakout", {
    villainSetId: "hammerhead",
    players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
    seed,
    difficulty: "standard",
  } as never);
  const created = createGame(config as never, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settleUntil(created.state, "orderPlayers", firstLegal, WAVE11_DEPS);
}

function prisonerOf(s: GameState, player: typeof P1): InstanceId {
  const found = cardsInPlay(s).filter((i) => inst(s, i).engagedWith === player);
  expect(found).toHaveLength(1);
  return found[0]!;
}

describe("The Raft Breakout 60142a setup: the first player orders the players", () => {
  it("asks the first player, and the chosen order decides which Prisoner each player reveals", () => {
    const asked = toOrderPrompt(1);
    expect(asked.pendingChoice?.prompt).toEqual({ kind: "orderPlayers", reason: "forEachPlayer" });
    expect(asked.pendingChoice?.playerId).toBe(asked.firstPlayerId);

    const inOrder = settle(answer(asked, [P1, P2], WAVE11_DEPS), firstLegal, undefined, WAVE11_DEPS);
    const reversed = settle(answer(asked, [P2, P1], WAVE11_DEPS), firstLegal, undefined, WAVE11_DEPS);

    // The first player in the order discards through the deck first: the same two Prisoners, swapped.
    expect(prisonerOf(reversed, P2)).toBe(prisonerOf(inOrder, P1));
    expect(prisonerOf(reversed, P1)).toBe(prisonerOf(inOrder, P2));
    expect(prisonerOf(inOrder, P1)).not.toBe(prisonerOf(inOrder, P2));
  });
});
