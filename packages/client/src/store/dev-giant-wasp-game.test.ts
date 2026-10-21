import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import {
  GIANT_WASP_THWART_DEV_CONFIG,
  giantWaspReached,
  giantWaspThwartReached,
  startGiantWaspDevGame,
} from "./dev-giant-wasp-game.js";
import { SessionStore } from "./session-store.js";

class NoopWorker {
  addEventListener(): void {}
  removeEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}
(globalThis as unknown as { Worker: unknown }).Worker = NoopWorker;

describe("the Giant Wasp dev game", () => {
  test("stops on Wasp's own turn in Giant form with two Hydra Mercenaries engaged", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startGiantWaspDevGame(store);
    const game = store.state.game!;
    expect(giantWaspReached(game)).toBe(true);
    expect(store.state.legal?.actions.kind).toBe("turn");
  });
});

describe("the Giant Wasp thwart dev game", () => {
  test("stops on Wasp's own turn in Giant form with Breakin' & Takin' and the main scheme holding threat", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startGiantWaspDevGame(store, GIANT_WASP_THWART_DEV_CONFIG, giantWaspThwartReached);
    expect(giantWaspThwartReached(store.state.game!)).toBe(true);
    expect(store.state.legal?.actions.kind).toBe("turn");
  });
});
