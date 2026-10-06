import { expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { startAssaultSchemeGame } from "./dev-assault-game.js";
import { codeOf } from "./dev-game-steps.js";
import { SessionStore } from "./session-store.js";

test("the assault dev game stops on She-Hulk's hero turn with Keep Them Busy in hand and threat on the main scheme", async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startAssaultSchemeGame(store);
  expect(store.state.error).toBeNull();
  const game = store.state.game!;
  const me = game.players[0]!;
  expect(me.identity.form).not.toBe("alterEgo");
  expect(me.hand.some((id) => codeOf(game, id) === "43018")).toBe(true);
  expect(game.instances[game.mainScheme.instanceId]!.threat).toBeGreaterThan(0);
});
