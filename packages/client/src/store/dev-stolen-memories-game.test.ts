import { expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import { STOLEN_MEMORIES, startStolenMemoriesDevGame } from "./dev-stolen-memories-game.js";
import { SessionStore } from "./session-store.js";

test("Black Panther in alter-ego form, Stolen Memories in play, two [mental] cards and a wild in hand", async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startStolenMemoriesDevGame(store);
  const game = store.state.game!;
  const me = game.players[0]!;
  expect(me.identity.form).toBe("alterEgo");
  expect(me.playArea.some((id) => codeOf(game, id) === STOLEN_MEMORIES)).toBe(true);
  const hand = me.hand.map((id) => codeOf(game, id));
  expect(hand).toEqual(expect.arrayContaining(["01091", "01078", "01043d"]));
  const legal = store.state.legal?.actions;
  expect(legal?.kind).toBe("turn");
  if (legal?.kind !== "turn") return;
  expect(
    legal.legal.some(
      (entry) => entry.action.kind === "useAbility" && entry.action.abilityId.startsWith(STOLEN_MEMORIES),
    ),
  ).toBe(true);
}, 60_000);
