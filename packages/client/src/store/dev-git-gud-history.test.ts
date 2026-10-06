/**
 * Git Gud 44028 reads whether the seat won its previous game (docs/phase7-wave7.md §4.1 Q48). A game started after a
 * recorded win or loss carries the fact in its stored config and its setup state, and a replay of its log is the same game.
 */
import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { codeOf } from "./dev-game-steps.js";
import { deadpoolQaConfig, startDeadpoolQaGame } from "./dev-qa-deadpool-game.js";
import { SessionStore } from "./session-store.js";

/** A storage whose profile holds one finished game with `result`. */
const afterGame = async (result: "won" | "lost" | "abandoned" | null): Promise<MemoryGameStorage> => {
  const storage = new MemoryGameStorage();
  if (result) {
    await new EngineSessionCore({ storage, newId: () => "earlier" }).start(deadpoolQaConfig("blackout"));
    await storage.setStatus("earlier", result);
  }
  return storage;
};

/** What the board asks for Git Gud with nothing paid: the engine's own "Needs N resource" refusal. */
const gitGudCost = async (store: SessionStore): Promise<number> => {
  const game = store.state.game!;
  const card = game.players[0]!.hand.find((id) => codeOf(game, id) === "44028")!;
  const turn = store.state.legal!.actions;
  if (turn.kind !== "turn") throw new Error("expected a turn");
  const entry = turn.legal.find((e) => e.action.kind === "playCard" && e.action.instanceId === card)!;
  if (await store.dispatch({ ...entry.example, payment: [] } as never)) return 0;
  return Number(/Needs (\d+) resource/.exec(store.state.error ?? "")![1]);
};

const played = async (storage: MemoryGameStorage) => {
  const store = new SessionStore(new LocalEngineHost(storage));
  await startDeadpoolQaGame(store, "gitGud");
  return store;
};

describe("Git Gud after a recorded result", () => {
  test("after a win it costs 2, after a loss or with no history it is free", async () => {
    const won = await played(await afterGame("won"));
    expect(won.state.game!.players[0]!.outsideFacts?.wonPreviousGame).toBe(true);
    expect(await gitGudCost(won)).toBe(2);

    const lost = await played(await afterGame("lost"));
    expect(lost.state.game!.players[0]!.outsideFacts?.wonPreviousGame).not.toBe(true);
    expect(await gitGudCost(lost)).toBe(0);

    const none = await played(await afterGame(null));
    expect(none.state.game!.players[0]!.outsideFacts).toBeUndefined();
    expect(await gitGudCost(none)).toBe(0);

    const abandoned = await played(await afterGame("abandoned"));
    expect(abandoned.state.game!.players[0]!.outsideFacts).toBeUndefined();
  });

  test("the fact is in the saved config, and a resumed game replays to the same state", async () => {
    const storage = await afterGame("won");
    const store = await played(storage);
    const saved = (await storage.list()).find((meta) => meta.status === "active")!;
    expect(saved.config.outsideFacts).toEqual([{ wonPreviousGame: true }]);
    const resumed = await new EngineSessionCore({ storage }).resume(saved.id);
    const { cardPool: _a, ...fromStore } = store.state.game!;
    const { cardPool: _b, ...fromResume } = resumed.snapshot.state as typeof resumed.snapshot.state & {
      cardPool?: unknown;
    };
    expect(fromResume).toEqual(fromStore);
    expect(resumed.snapshot.state.players[0]!.outsideFacts).toEqual({ wonPreviousGame: true });
  });

  test("a guided run takes no facts", async () => {
    const storage = await afterGame("won");
    const core = new EngineSessionCore({ storage });
    const started = await core.start({
      ...deadpoolQaConfig("blackout"),
      guided: { kind: "tutorial", tutorialId: "t" } as never,
    });
    expect(started.snapshot.state.players[0]!.outsideFacts).toBeUndefined();
  });
});
