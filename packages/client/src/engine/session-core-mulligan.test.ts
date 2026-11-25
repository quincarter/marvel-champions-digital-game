import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
  seed: 2026,
  watchable: true,
  room: "room00000001",
  roomPlayMode: "host",
};

describe("a guest seat answering its setup mulligan", () => {
  test("Keep (no cards) and a swap are both accepted from the seat that holds the deciding hero", async () => {
    for (const swap of [false, true]) {
      const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
      const first = await core.start(CONFIG);
      const choice = first.snapshot.state.pendingChoice!;
      expect(choice.prompt.kind).toBe("mulligan");
      expect(first.snapshot.state.step.phase).toBe("setup");
      const picked = swap ? [choice.options[0]!.optionId, choice.options[1]!.optionId] : [];
      const answer = {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: picked,
      };
      const result = core.dispatchProposal(answer, 0, core.liveChecksum(), [choice.playerId as string]);
      expect(result).toMatchObject({ ok: true });
      expect(core.liveGame()!.game.commands).toHaveLength(1);
    }
  });
});

import { headerOf } from "../live/live-publisher.js";
import { SeatCore } from "../live/seat-core.js";
import { loadedPacks } from "../packs/pack-registry.js";

describe("a seat's stamp at the opening", () => {
  test("matches the host's, so its first proposal is not read as stale", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const first = await core.start(CONFIG);
    const live = core.liveGame()!.game;
    const seat = new SeatCore();
    const opened = seat.open(
      { header: headerOf(live), commands: live.commands, checksums: live.checksums ?? {}, packs: loadedPacks() },
      "open",
    );
    expect(opened.snapshot.version).toBe(0);
    expect(seat.stampAt(0)).toBe(core.liveChecksum());
    void first;
  });
});
