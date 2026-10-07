import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import {
  BARELY_A_SCRATCH,
  EVER_VIGILANT,
  KATANA,
  RESTRICTED,
  WARPATH,
  startScreensQaGame,
} from "./dev-qa-screens-game.js";
import { SessionStore } from "./session-store.js";

const start = async (which: Parameters<typeof startScreensQaGame>[1]) => {
  const store = new SessionStore(new LocalEngineHost());
  await startScreensQaGame(store, which);
  expect(store.state.error).toBeNull();
  return { store, game: store.state.game! };
};

describe("the wave 7 screens QA dev games", () => {
  test("restricted: two restricted upgrades attached, a third in hand with cards to pay", async () => {
    const { game } = await start("restricted");
    const me = game.players[0]!;
    expect(me.identity.form).toBe("hero");
    const attached = game.instances[me.identity.instanceId]!.attachments.filter((id) => codeOf(game, id) === KATANA);
    expect(attached).toHaveLength(2);
    expect(me.hand.some((id) => codeOf(game, id) === RESTRICTED)).toBe(true);
    expect(me.hand.length).toBeGreaterThanOrEqual(3);
  });

  test("warpath: Warpath in play, Ever Vigilant in hand, round 2, hero form", async () => {
    const { game } = await start("warpath");
    const me = game.players[0]!;
    expect(game.round).toBeGreaterThanOrEqual(2);
    expect(me.identity.form).toBe("hero");
    expect(me.playArea.some((id) => codeOf(game, id) === WARPATH)).toBe(true);
    expect(me.hand.some((id) => codeOf(game, id) === EVER_VIGILANT)).toBe(true);
  });

  test("defenseLock: P1's turn in round 2, both in hero form, P2 holds Barely a Scratch", async () => {
    const { store, game } = await start("defenseLock");
    expect(game.round).toBeGreaterThanOrEqual(2);
    expect(store.state.legal?.playerId).toBe(game.players[0]!.playerId);
    expect(game.players[0]!.identity.form).toBe("hero");
    expect(game.players[1]!.identity.form).toBe("hero");
    expect(game.players[1]!.hand.some((id) => codeOf(game, id) === BARELY_A_SCRATCH)).toBe(true);
  });

  test("replacement: Deadpool in hero form with 2 or fewer hit points left", async () => {
    const { game } = await start("replacement");
    const me = game.players[0]!;
    expect(me.identity.form).toBe("hero");
    expect(game.instances[me.identity.instanceId]!.damage).toBeGreaterThanOrEqual(7);
    expect(game.outcome).toBeFalsy();
  });
});
