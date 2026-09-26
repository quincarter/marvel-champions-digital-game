/**
 * A hand card shows what it generates right now, not only its printed icons: Band Together (`mts` 21018) prints none
 * and "generates [wild] for each ally you control (to a maximum of 3)" (docs/phase7-wave4.md §3.38). Reported
 * 2026-09-26: Band Together looked like it generated nothing.
 */
import { cardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { handCardView } from "./board-model.js";

async function spectrumGame(): Promise<GameState> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "spectrum-leadership" }],
    seed: 6,
  });
  return store.state.game!;
}

/** Moves the first copy of each code from P1's deck to where it is asked for (test surgery). */
function stage(state: GameState, toHand: string[], toPlay: string[]): { state: GameState; hand: InstanceId[] } {
  const p1 = state.players[0]!;
  const hand: InstanceId[] = [];
  const play: InstanceId[] = [];
  const taken = new Set<InstanceId>();
  const take = (code: string) => {
    const id = p1.deck.find((i) => !taken.has(i) && state.instances[i]?.cardId === cardId(code))!;
    taken.add(id);
    return id;
  };
  for (const code of toHand) hand.push(take(code));
  for (const code of toPlay) play.push(take(code));
  const instances = { ...state.instances };
  for (const id of play) instances[id] = { ...instances[id]!, controllerId: p1.playerId, faceup: true };
  return {
    hand,
    state: {
      ...state,
      instances,
      players: state.players.map((p) =>
        p === p1
          ? {
              ...p,
              deck: p.deck.filter((i) => !taken.has(i)),
              hand: [...p.hand, ...hand],
              playArea: [...p.playArea, ...play],
            }
          : p,
      ),
    },
  };
}

describe("hand card resource icons", () => {
  test("Band Together shows one [wild] per ally Spectrum controls, capped at 3", async () => {
    const game = await spectrumGame();
    const none = stage(game, ["21018"], []);
    expect(handCardView(none.state, none.hand[0]!, "p1" as never, POOL_DEPS).resourceIcons).toEqual([]);

    const two = stage(game, ["21018"], ["21019", "21013"]);
    expect(handCardView(two.state, two.hand[0]!, "p1" as never, POOL_DEPS).resourceIcons).toEqual(["wild", "wild"]);

    const four = stage(game, ["21018"], ["21019", "21013", "21012", "21005"]);
    expect(handCardView(four.state, four.hand[0]!, "p1" as never, POOL_DEPS).resourceIcons).toEqual([
      "wild",
      "wild",
      "wild",
    ]);
  });
});
