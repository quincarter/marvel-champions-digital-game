import { describe, expect, test } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import { MemoryGameStorage, type SaveMeta } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice", deckName: "My secret deck name" }],
  seed: 2026,
  watchable: true,
};

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0]!;
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error("nothing legal");
  return (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0]!).example;
}

describe("EngineSessionCore live stream", () => {
  test("a game that is not watchable is never streamed", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    await core.start({ ...CONFIG, watchable: undefined } as unknown as SessionConfig);
    expect(core.liveGameKey()).toBeNull();
    expect(core.liveGame()).toBeNull();
  });

  test("the live game leaves out deck names and the watchable flag, and carries checksums from the start", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(CONFIG);
    core.dispatch(anyLegalCommand(core.legalActions(started.snapshot.legal!.playerId)));
    const live = core.liveGame();
    expect(live).not.toBeNull();
    const text = JSON.stringify(live!.game.config);
    expect(text).not.toContain("My secret deck name");
    expect(live!.game.config).not.toHaveProperty("watchable");
    expect(live!.game.commands).toHaveLength(1);
    expect(Object.keys(live!.game.checksums ?? {})).toEqual(["0"]);
  });

  test("the game key is stable across a resume, so the same game keeps its room", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(CONFIG);
    first.dispatch(anyLegalCommand(first.legalActions(started.snapshot.legal!.playerId)));
    const key = first.liveGameKey();
    const meta = (await storage.latestActive()) as SaveMeta;
    const second = new EngineSessionCore({ storage });
    await second.resume(meta.id);
    expect(second.liveGameKey()).toBe(key);
    expect(second.liveGame()?.game.commands).toHaveLength(1);
  });

  test("without storage two games of one scenario and seed still get different keys", async () => {
    let t = 1000;
    const core = new EngineSessionCore({ now: () => t });
    await core.start(CONFIG);
    const a = core.liveGameKey();
    t += 5;
    await core.start(CONFIG);
    expect(core.liveGameKey()).not.toBe(a);
  });
});
