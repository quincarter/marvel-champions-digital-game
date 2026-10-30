import { cardOf } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { artFor } from "../art/art-source.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { boardModel } from "../view/board-model.js";
import { POOL_DEPS } from "../content/pool.js";
import { VICTORY_DEV_CARD, startVictoryDevGame } from "./dev-victory-game.js";
import { SessionStore } from "./session-store.js";

describe("the victory display dev game", () => {
  test("Specialized Training sits in the victory display and the board shows its pile", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startVictoryDevGame(store);
    const game = store.state.game!;
    expect(game.victoryDisplay.map((id) => game.instances[id]!.cardId as string)).toEqual([VICTORY_DEV_CARD]);
    const model = boardModel(game, store.state.perspectiveId!, POOL_DEPS);
    expect(model.victoryDisplay).toEqual(game.victoryDisplay);
    expect(model.victoryDisplayTop).toEqual(artFor(cardOf(game, game.victoryDisplay[0]!), { kind: "front" }));
  });
});
