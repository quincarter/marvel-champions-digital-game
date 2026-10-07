/**
 * The Inspect cost for a per player icon (design frames 08B, L06B, 14B): the scaled price leads and the printed rate
 * explains it. Break Time (44046) costs 3 per player; Core Set cards cost what they print.
 */
import { CORE_DEPS } from "@mc/cards";
import type { InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { startBreakTimeDevGame, BREAK_TIME_CARD } from "../store/dev-break-time-game.js";
import { codeOf } from "../store/dev-game-steps.js";
import { SessionStore } from "../store/session-store.js";
import { inspectModel } from "./inspect-model.js";

async function breakTime(players: 1 | 2) {
  const store = new SessionStore(new LocalEngineHost());
  await startBreakTimeDevGame(store, players);
  const state = store.state.game!;
  const me = store.state.perspectiveId!;
  const hand = state.players.find((player) => player.playerId === me)!.hand;
  const card = hand.find((id) => codeOf(state, id) === BREAK_TIME_CARD)!;
  const other = hand.find((id) => id !== card)!;
  const model = (id: InstanceId) => inspectModel(state, id, store.state.legal?.actions ?? null, me, CORE_DEPS);
  return { card: model(card), other: model(other) };
}

describe("a per player cost in Inspect", () => {
  test("one player: 3 per player × 1 player is 3", async () => {
    const { card } = await breakTime(1);
    expect(card.cost).toBe(3);
    expect(card.currentCost).toBe(3);
    expect(card.perPlayerCost).toEqual({
      rate: 3,
      players: 1,
      scaled: 3,
      rateLabel: "3 per player",
      countLabel: "× 1 player",
      line: "3 per player × 1 player",
    });
  });

  test("two players: 3 per player × 2 players is 6, on the badge and the Play button", async () => {
    const { card } = await breakTime(2);
    expect(card.cost).toBe(6);
    expect(card.currentCost).toBe(6);
    expect(card.perPlayerCost).toMatchObject({ rate: 3, players: 2, scaled: 6, line: "3 per player × 2 players" });
    expect(card.perPlayerCost!.rateLabel).toBe("3 per player");
    expect(card.perPlayerCost!.countLabel).toBe("× 2 players");
  });

  test("a flat cost has no per player line", async () => {
    const { other } = await breakTime(2);
    expect(other.perPlayerCost).toBeNull();
    expect(other.cost).toBe(other.currentCost);
  });
});
