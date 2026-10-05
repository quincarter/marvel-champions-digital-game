import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { UNCANNY_CARD, startUncannyDevGame, startUncannySoloDevGame } from "./dev-uncanny-game.js";
import { SessionStore } from "./session-store.js";

const playOf = (store: SessionStore) => {
  const game = store.state.game!;
  const actions = store.state.legal!.actions;
  if (actions.kind !== "turn") throw new Error("not a turn");
  return actions.legal.find(
    (e) => e.action.kind === "playCard" && (game.instances[e.action.instanceId]?.cardId as string) === UNCANNY_CARD,
  );
};

describe("the Uncanny X-Men dev game", () => {
  test("Storm and Wolverine: Uncanny X-Men in Storm's hand, playable under either seat", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startUncannyDevGame(store);
    expect(playOf(store)?.controllers).toHaveLength(2);
  });

  test("Storm alone: one seat, so the engine lists no choice of controller", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startUncannySoloDevGame(store);
    expect(playOf(store)?.controllers ?? []).toHaveLength(1);
  });
});
